import { createApp } from './app.js';
import { ingestPr, listOpenPrs } from './ingestion.js';
import type { RiskLevel } from './models.js';
import { RISK_LEVELS } from './models.js';
import { getSettings } from './settings.js';
import { getPr, listPrs, upsertPr } from './storage.js';

const USAGE = `Usage:
  tsx src/cli.ts ingest <pr_number>
  tsx src/cli.ts ingest-open [--limit N]
  tsx src/cli.ts show <pr_number>
  tsx src/cli.ts list [--risk LEVEL]
  tsx src/cli.ts serve [--host H] [--port P]
`;

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  const settings = getSettings();

  switch (command) {
    case 'ingest': {
      const prNumber = Number(args[0]);
      if (!Number.isInteger(prNumber)) {
        console.error('Error: ingest requires a PR number');
        console.error(USAGE);
        process.exit(1);
      }
      // console.log(`Ingesting PR #${prNumber} from ${settings.github_repo} …`);
      const record = await ingestPr(prNumber, settings);
      upsertPr(record, settings);
      // console.log(`✓  Risk: ${record.overall_risk}  |  Heuristics: ${record.risk_heuristics.length}`);
      break;
    }

    case 'ingest-open': {
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 20 : 20;
      // console.log(`Fetching up to ${limit} open PRs from ${settings.github_repo} …`);
      const records = await listOpenPrs(settings, limit);
      for (const r of records) upsertPr(r, settings);
      // console.log(`✓  Ingested ${records.length} PRs.`);
      break;
    }

    case 'show': {
      const prNumber = Number(args[0]);
      const record = getPr(prNumber, settings.github_repo, settings);
      if (!record) {
        console.error(`PR #${prNumber} not found. Run \`ingest ${prNumber}\` first.`);
        process.exit(1);
      }
      // console.log(JSON.stringify(record, null, 2));
      break;
    }

    case 'list': {
      const riskIdx = args.indexOf('--risk');
      const risk = riskIdx >= 0 ? args[riskIdx + 1] : undefined;
      const riskFilter = risk && RISK_LEVELS[risk] ? (risk as RiskLevel) : undefined;
      const records = listPrs(settings, riskFilter);
      if (records.length === 0) {
        console.log('No PRs stored yet.');
        break;
      }
      for (const r of records) {
        console.log(`  #${String(r.id).padEnd(4)} [${r.overall_risk.padEnd(8)}] ${String(r.author).padEnd(20)}  ${r.title.slice(0, 55)}`);
      }
      break;
    }

    case 'serve': {
      const hostIdx = args.indexOf('--host');
      const portIdx = args.indexOf('--port');
      const host = hostIdx >= 0 ? args[hostIdx + 1] : settings.api_host;
      const port = portIdx >= 0 ? Number(args[portIdx + 1]) || settings.api_port : settings.api_port;
      const app = createApp(settings);
      app.listen(port, host, () => {
        console.log(`PR Doctor — Ingestion API listening on http://${host}:${port}`);
      });
      return;
    }

    default:
      console.error(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
