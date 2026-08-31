import express from 'express';
import { fetchLivePrDetail, ingestPr, listLivePrs, listOpenPrs } from './ingestion.js';
import type { RiskLevel } from './models.js';
import { RISK_LEVELS } from './models.js';
import type { Settings } from './settings.js';
import { deletePr, getPr, listPrs, upsertPr } from './storage.js';

/** Parse required query params (token, owner, repo) or send a 400 and return null. */
function liveParams(req: express.Request, res: express.Response): { token: string; owner: string; repo: string } | null {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const owner = typeof req.query.owner === 'string' ? req.query.owner : '';
  const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
  if (!token || !owner || !repo) {
    res.status(400).json({ error: 'Missing required parameters: token, owner, repo' });
    return null;
  }
  return { token, owner, repo };
}

export function createApp(settings: Settings) {
  const app = express();
  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Live, paginated list of open PRs (proxies the client token to GitHub).
  app.get('/github/prs', async (req, res) => {
    const p = liveParams(req, res);
    if (!p) return;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(req.query.per_page) || 10, 1), 100);
    try {
      const items = await listLivePrs(p.token, p.owner, p.repo, page, perPage);
      res.json(items);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch PRs' });
    }
  });

  // Live PR detail with changed files (proxy client token to GitHub).
  // Accepts `owner` + `repo` OR a combined `repo` in `owner/repo` form.
  app.get('/github/prs/:prNumber', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    let owner = typeof req.query.owner === 'string' ? req.query.owner : '';
    let repo = typeof req.query.repo === 'string' ? req.query.repo : '';
    if (!owner && repo.includes('/')) {
      const [o, r] = repo.split('/');
      owner = o;
      repo = r;
    }
    if (!token || !owner || !repo) {
      res.status(400).json({ error: 'Missing required parameters: token, repo (owner/repo)' });
      return;
    }
    const prNumber = Number(req.params.prNumber);
    if (!Number.isInteger(prNumber)) {
      res.status(400).json({ error: 'Invalid PR number' });
      return;
    }
    try {
      const detail = await fetchLivePrDetail(token, owner, repo, prNumber);
      res.json(detail);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch PR detail' });
    }
  });

  // Ingest a single PR
  app.post('/ingest/:prNumber', async (req, res) => {
    const prNumber = Number(req.params.prNumber);
    if (!Number.isInteger(prNumber)) {
      res.status(400).json({ error: 'Invalid PR number' });
      return;
    }
    try {
      const record = await ingestPr(prNumber, settings);
      upsertPr(record, settings);
      res.json(record);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Ingestion failed' });
    }
  });

  // Ingest all open PRs (up to limit)
  app.post('/ingest/bulk/open', async (req, res) => {
    const limitParam = Number(req.query.limit ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);
    try {
      const records = await listOpenPrs(settings, limit);
      for (const r of records) upsertPr(r, settings);
      res.json(records);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Bulk ingestion failed' });
    }
  });

  // List stored PRs (optionally filtered by risk)
  app.get('/prs', (_req, res) => {
    const risk = _req.query.risk as string | undefined;
    const riskFilter = risk && RISK_LEVELS[risk] ? (risk as RiskLevel) : undefined;
    res.json(listPrs(settings, riskFilter));
  });

  // Get a single stored PR
  app.get('/prs/:prNumber', (req, res) => {
    const prNumber = Number(req.params.prNumber);
    const record = getPr(prNumber, settings.github_repo, settings);
    if (!record) {
      res.status(404).json({ error: `PR #${prNumber} not found in local store` });
      return;
    }
    res.json(record);
  });

  // Delete a stored PR
  app.delete('/prs/:prNumber', (req, res) => {
    const prNumber = Number(req.params.prNumber);
    const removed = deletePr(prNumber, settings.github_repo, settings);
    if (!removed) {
      res.status(404).json({ error: `PR #${prNumber} not found` });
      return;
    }
    res.json({ deleted: prNumber });
  });

  return app;
}
