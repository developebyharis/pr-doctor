import type { FileDiff, PRRecord, RiskHeuristic } from './models.js';
import { worstCaseRisk } from './models.js';
import type { Settings } from './settings.js';

const GITHUB_API = 'https://api.github.com';

const GH_HEADERS = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

// Mirrors the Python regex from packages/pr-ingestion.
const SECRET_RE = /(password|passwd|secret|token|api_?key|private_?key|auth_?key|access_?key|secret_?key)\s*[:=]\s*\S+/i;

interface GhFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface GhPull {
  number: number;
  title: string;
  user: { login: string; avatar_url?: string } | null;
  state: string;
  draft: boolean;
  body: string | null;
  base: { ref: string };
  head: { ref: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  labels: { name: string }[];
  review_comments: number;
  commits: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  html_url?: string;
}

/** Shape the web app expects for a PR list item. */
export interface GithubPrItem {
  number: number;
  repo: string;
  title: string;
  author: string;
  authorAvatar: string;
  state: string;
  draft: boolean;
  branch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
  body: string | null;
  labels: string[];
  reviewComments: number;
  commits: number;
  url: string;
}

export interface GithubPrDetail extends GithubPrItem {
  mergedAt: string | null;
  files: FileDiff[];
}

function ghItemFromPull(pr: GhPull, repo: string): GithubPrItem {
  return {
    number: pr.number,
    repo,
    title: pr.title,
    author: pr.user?.login ?? 'unknown',
    authorAvatar: pr.user?.avatar_url ?? '',
    state: pr.state,
    draft: pr.draft,
    branch: pr.head.ref,
    baseBranch: pr.base.ref,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    body: pr.body,
    labels: (pr.labels ?? []).map((l) => l.name),
    reviewComments: pr.review_comments ?? 0,
    commits: pr.commits ?? 0,
    url: pr.html_url ?? `https://github.com/${repo}/pull/${pr.number}`,
  };
}

/**
 * Live, paginated list of open PRs fetched from GitHub with the provided token.
 * Used by the web app to preserve "10 per page + Load More" behavior.
 */
export async function listLivePrs(
  token: string,
  owner: string,
  repo: string,
  page = 1,
  perPage = 10,
): Promise<GithubPrItem[]> {
  const pulls = (await ghFetch(
    token,
    `/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&page=${page}&per_page=${perPage}`,
  )) as GhPull[];
  return pulls.map((pr) => ghItemFromPull(pr, `${owner}/${repo}`));
}

/**
 * Live PR detail (with changed files/patches) fetched from GitHub with the
 * provided token. Used by the web app's PR detail page.
 */
export async function fetchLivePrDetail(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GithubPrDetail> {
  const [prRes, filesRes] = await Promise.all([
    ghFetch(token, `/repos/${owner}/${repo}/pulls/${prNumber}`),
    ghFetch(token, `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`),
  ]);
  const pr = prRes as GhPull;
  const files = (filesRes as GhFile[]).map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  }));
  return {
    ...ghItemFromPull(pr, `${owner}/${repo}`),
    mergedAt: pr.merged_at,
    files,
  };
}

async function ghFetch(token: string, path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: GH_HEADERS(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

export function detectHeuristics(files: FileDiff[]): RiskHeuristic[] {
  const heuristics: RiskHeuristic[] = [];
  let hasSrc = false;
  let hasTest = false;

  for (const f of files) {
    const name = f.filename.toLowerCase();

    if (f.patch && SECRET_RE.test(f.patch)) {
      heuristics.push({
        rule: 'secret_pattern',
        description: 'Possible secret/token in diff',
        level: 'critical',
        file: f.filename,
      });
    }

    if (f.additions + f.deletions > 500) {
      heuristics.push({
        rule: 'large_diff',
        description: `File has ${f.additions + f.deletions} changed lines (>500)`,
        level: 'high',
        file: f.filename,
      });
    }

    if (/migrat/.test(name)) {
      heuristics.push({
        rule: 'migration_file',
        description: 'Database migration file modified',
        level: 'high',
        file: f.filename,
      });
    }

    if (/\.(env|cfg|ini|yaml|yml|toml|json)$/.test(name) && f.status !== 'added') {
      heuristics.push({
        rule: 'config_change',
        description: 'Configuration file modified',
        level: 'medium',
        file: f.filename,
      });
    }

    if (/(requirements.*\.txt|pyproject\.toml|package\.json|go\.sum|Gemfile\.lock)$/.test(name)) {
      heuristics.push({
        rule: 'dependency_change',
        description: 'Dependency manifest modified',
        level: 'medium',
        file: f.filename,
      });
    }

    if (/(test_|_test\.|spec\.)/.test(name) && f.status === 'removed') {
      heuristics.push({
        rule: 'test_deletion',
        description: 'Test file deleted',
        level: 'medium',
        file: f.filename,
      });
    }

    if (/(test_|_test\.|spec\.)/.test(name)) {
      hasTest = true;
    } else if ((f.status === 'added' || f.status === 'modified') && f.additions > 0) {
      hasSrc = true;
    }
  }

  if (hasSrc && !hasTest) {
    heuristics.push({
      rule: 'no_tests',
      description: 'PR modifies/adds source code but no test files found',
      level: 'low',
      file: null,
    });
  }

  return heuristics;
}

function parseFiles(ghFiles: GhFile[]): FileDiff[] {
  return ghFiles.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  }));
}

/** Fetch a single PR from GitHub and return a fully parsed PRRecord. */
export async function ingestPr(prNumber: number, settings: Settings): Promise<PRRecord> {
  const [owner, repo] = settings.github_repo.split('/');
  const ghPr = (await ghFetch(
    settings.github_token,
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
  )) as GhPull;
  const ghFiles = (await ghFetch(
    settings.github_token,
    `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
  )) as GhFile[];

  const files = parseFiles(ghFiles);
  const heuristics = detectHeuristics(files);
  const overall = worstCaseRisk(heuristics);

  return {
    id: ghPr.number,
    repo: settings.github_repo,
    title: ghPr.title,
    body: ghPr.body,
    author: ghPr.user?.login ?? 'unknown',
    state: ghPr.state,
    base_branch: ghPr.base.ref,
    head_branch: ghPr.head.ref,
    created_at: ghPr.created_at,
    updated_at: ghPr.updated_at || ghPr.created_at,
    merged_at: ghPr.merged_at,
    files,
    risk_heuristics: heuristics,
    overall_risk: overall,
    labels: (ghPr.labels ?? []).map((l) => l.name),
    review_comments: ghPr.review_comments,
    commits: ghPr.commits,
  };
}

/** Fetch all open PRs (up to *limit*) and return parsed records. */
export async function listOpenPrs(settings: Settings, limit = 50): Promise<PRRecord[]> {
  const [owner, repo] = settings.github_repo.split('/');
  const pulls = (await ghFetch(
    settings.github_token,
    `/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${limit}`,
  )) as GhPull[];

  const records: PRRecord[] = [];
  for (const pr of pulls.slice(0, limit)) {
    records.push(await ingestPr(pr.number, settings));
  }
  return records;
}
