# `apps/api` — PR Doctor Ingestion Service (Express + TypeScript)

An Express + TypeScript port of the original Python service (`packages/pr-ingestion`).
It connects to GitHub, fetches pull-request data, runs a static risk analysis over
every changed file, stores results in a local JSON database, and exposes them through
both a REST API and a CLI.

The endpoints and data shapes mirror `packages/pr-ingestion` exactly, so the web app
(`apps/web`) can talk to either backend interchangeably.

---

## Quick start

### 1. Install dependencies

```bash
pnpm --filter pr-doctor-api install
```

### 2. Configure environment

```bash
cd apps/api
cp .env.example .env
# Edit .env — set GITHUB_TOKEN and GITHUB_REPO
```

`.env` contents:

```dotenv
# Required
GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere
GITHUB_REPO=owner/repo-name

# Optional — defaults shown
API_HOST=localhost
API_PORT=8000
DB_PATH=./data/pr_doctor.json
```

> **Never commit `.env`.** It is in `.gitignore`.

### 3. Run

**Development (watch mode):**
```bash
pnpm --filter pr-doctor-api dev          # tsx watch src/index.ts
```

**Production:**
```bash
pnpm --filter pr-doctor-api build        # tsc -> dist/
pnpm --filter pr-doctor-api serve        # node dist/index.js
# → http://localhost:8000
```

**CLI:**
```bash
# Ingest a single PR
pnpm --filter pr-doctor-api ingest -- 42

# Ingest all open PRs (up to limit)
pnpm --filter pr-doctor-api ingest-open

# List stored PRs (optionally filtered by risk)
pnpm --filter pr-doctor-api list

# Show one stored PR as JSON
pnpm --filter pr-doctor-api show -- 42
```

Or from the monorepo root:
```bash
pnpm api:ts:dev     # dev server
pnpm api:ts:build   # compile
pnpm api:ts:serve   # run compiled server
```

---

## Project layout

```
apps/api/
├── package.json
├── tsconfig.json
├── .env.example                  # Copy to .env and fill in
├── data/
│   └── pr_doctor.json            # JSON database (auto-created)
└── src/
    ├── index.ts                  # Entry point → starts the Express server
    ├── cli.ts                    # CLI commands (ingest, ingest-open, show, list, serve)
    ├── settings.ts               # dotenv env-var loading
    ├── models.ts                 # PRRecord, FileDiff, RiskHeuristic, RiskLevel
    ├── ingestion.ts              # GitHub fetching + risk heuristics
    ├── storage.ts                # JSON file read/write layer
    └── app.ts                    # Express application + routes
```

---

## Data models

### `RiskLevel`
`'low' | 'medium' | 'high' | 'critical'`

### `FileDiff`
| Field | Type | Description |
|---|---|---|
| `filename` | `string` | Full path |
| `status` | `string` | `added` \| `modified` \| `removed` \| `renamed` |
| `additions` | `number` | Lines added |
| `deletions` | `number` | Lines deleted |
| `patch` | `string \| null` | Raw unified diff; `null` for binary files |

### `RiskHeuristic`
| Field | Type | Description |
|---|---|---|
| `rule` | `string` | Rule identifier |
| `description` | `string` | Human-readable explanation |
| `level` | `RiskLevel` | Severity of this signal |
| `file` | `string \| null` | File that triggered the rule |

### `PRRecord`
| Field | Type | Description |
|---|---|---|
| `id` | `number` | GitHub PR number |
| `repo` | `string` | `owner/repo` |
| `title` | `string` | PR title |
| `body` | `string \| null` | PR description |
| `author` | `string` | GitHub login |
| `state` | `string` | `open` \| `closed` \| `merged` |
| `base_branch` / `head_branch` | `string` | Target / source branch |
| `created_at` / `updated_at` | `string` | ISO timestamps |
| `merged_at` | `string \| null` | |
| `files` | `FileDiff[]` | All changed files |
| `risk_heuristics` | `RiskHeuristic[]` | All triggered risk signals |
| `overall_risk` | `RiskLevel` | Worst-case across all heuristics |
| `labels` | `string[]` | GitHub labels |
| `review_comments` / `commits` | `number` | |

---

## Risk heuristics

Seven rules run over every file diff (identical to the Python port). Multiple rules
can fire on the same file.

| Rule | Level | Trigger |
|---|---|---|
| `secret_pattern` | **CRITICAL** | Patch matches a regex for passwords, tokens, api keys, etc. |
| `large_diff` | **HIGH** | A single file has > 500 added + deleted lines |
| `migration_file` | **HIGH** | Filename contains `migrat` |
| `config_change` | **MEDIUM** | `.env`, `.cfg`, `.yaml`, `.toml`, `.json` etc. was **modified** (not added) |
| `dependency_change` | **MEDIUM** | `requirements*.txt`, `pyproject.toml`, `package.json`, `go.sum`, `Gemfile.lock` was touched |
| `test_deletion` | **MEDIUM** | A `test_*` / `*_test.*` / `spec.*` file was **removed** |
| `no_tests` | **LOW** | Source files were added/modified but no test files appear anywhere in the diff |

`overall_risk` is the worst-case level across all fired heuristics:
`CRITICAL > HIGH > MEDIUM > LOW`.

---

## REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — returns `{"status": "ok"}` |
| `POST` | `/ingest/{pr_number}` | Fetch, analyse, store a single PR. Returns `PRRecord`. |
| `POST` | `/ingest/bulk/open` | Fetch all open PRs (up to `?limit=50`), store all. Returns `PRRecord[]`. |
| `GET` | `/prs` | List all stored PRs. Optional `?risk=high` filter. |
| `GET` | `/prs/{pr_number}` | Retrieve one stored PR by number. |
| `DELETE` | `/prs/{pr_number}` | Delete a stored PR record. |

---

## Storage

Records are stored in a single JSON file at `DB_PATH` (default `./data/pr_doctor.json`),
keyed by `(repo, id)` — the same PR number from two different repos never collides.
The file is created automatically on first write.

---

## Disclaimer

This is a prototype for a hackathon demo, not a production system. The REST API runs
with server-side `GITHUB_TOKEN` from the environment. Never commit `.env`.
