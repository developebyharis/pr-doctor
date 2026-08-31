import "dotenv/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load .env from the apps/api directory regardless of CWD.
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
// dotenv/config already ran; re-run with explicit path to be safe.
(await import("dotenv")).config({ path: resolve(projectRoot, ".env") });

export interface Settings {
  github_token: string;
  github_repo: string;
  api_host: string;
  api_port: number;
  db_path: string;
}

const DEFAULT_DB_PATH = resolve(projectRoot, "data", "pr_doctor.json");

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;
  cached = {
    github_token: process.env.GITHUB_TOKEN ?? "",
    github_repo: process.env.GITHUB_REPO ?? "",
    api_host: process.env.API_HOST ?? "localhost",
    api_port: Number(process.env.API_PORT ?? 8000),
    db_path: process.env.DB_PATH ?? DEFAULT_DB_PATH,
  };
  if (!cached.github_repo) {
    throw new Error("GITHUB_REPO is required (owner/repo format)");
  }
  return cached;
}

export function resolveDbPath(settings: Settings): string {
  return settings.db_path;
}
