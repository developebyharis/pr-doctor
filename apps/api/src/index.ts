import { createApp } from './app.js';
import { getSettings } from './settings.js';

const settings = getSettings();
const app = createApp(settings);

const host = settings.api_host;
const port = settings.api_port;

app.listen(port, host, () => {
  console.log(`PR Doctor — Ingestion API listening on http://${host}:${port}`);
  console.log(`  GITHUB_REPO: ${settings.github_repo}`);
  console.log(`  DB_PATH:     ${settings.db_path}`);
});
