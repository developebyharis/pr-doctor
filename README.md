# Pointer — PR Doctor Monorepo

AI-powered pull-request reviewer built on **IBM BOB 2.0** for IBM TechXchange 2026.  
Four BOB specialists investigate a PR in parallel and return a **MERGE / NEEDS_WORK / BLOCK** verdict with a full evidence chain.

---

## Repository layout

```
Pointer/
├── apps/
│   ├── web/                  # Next.js front-end (PR Doctor UI)
│   └── api/                  # Express + TypeScript ingestion service (port of the old Python service)
├── packages/
│   └── graphify-out/         # Committed graph snapshot (nodes + edges)
├── package.json              # Root — pnpm workspace scripts
└── pnpm-workspace.yaml       # Declares apps/* as workspaces
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 11 | `npm i -g pnpm` |

---

## Quick start (demo mode — no GitHub token needed)

```bash
# 1. Install all JS dependencies from the repo root
pnpm install

# 2. Start the web app in demo/fixture mode
DEMO_MODE=fixture pnpm dev
```

Open http://localhost:3000.  
The landing page shows a pre-loaded BLOCK verdict.  
`/investigation` runs the full agent animation against the fixture.

---

## Full setup (live GitHub ingestion)

### 1. Configure the apps/api service

```bash
pnpm run install:api
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set GITHUB_TOKEN and GITHUB_REPO
```

### 2. Start the ingestion service

```bash
# Start the Express service (http://localhost:8000/health)
pnpm run api:ts:serve
```

### 3. Start the web app

```bash
pnpm dev
```

Open http://localhost:3000/connect, enter a GitHub token and `owner/repo`, and
list open PRs. The web app proxies each request through `apps/api`, which
forwards it to the GitHub API with live pagination (10 per page + Load More).

---

## Root scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start Next.js dev server (`apps/web`) |
| `pnpm build` | Production build of the web app |
| `pnpm start` | Start the production Next.js server |
| `pnpm lint` | Run ESLint on the web app |
| `pnpm validate` | Validate the fixture file against internal consistency rules |
| `pnpm run setup` | Install both workspace (pnpm) dependencies in one step |
| `pnpm run install:api` | Install the Express `apps/api` dependencies |
| `pnpm run api:ts:dev` | Run `apps/api` with `tsx watch` |
| `pnpm run api:ts:build` | Compile `apps/api` to `dist/` |
| `pnpm run api:ts:serve` | Run the compiled `apps/api` server on port 8000 |

---

## Architecture

```
Browser
  │  (encrypted token in sessionStorage)
  ▼
apps/web (Next.js)
  ├── /api/analyze        POST → creates a job
  ├── /api/job/[id]       GET  → live agent progress (polled every 800ms)
  ├── /api/verdict/[id]   GET  → FinalVerdict (calls IBM BOB or serves fixture)
  ├── /api/graphify       GET  → subgraph context for changed files
  └── /api/github/*       proxies PR list/detail to apps/api
        │
        ├── lib/bob-adapter.ts   — only file that calls `bob run`
        └── lib/graphify.ts      — reads packages/graphify-out/graph.json

apps/api (Express + TypeScript)
  ├── GET  /github/prs            Live paginated list of open PRs (proxies client token to GitHub)
  ├── GET  /github/prs/{n}        Live PR detail + changed files
  ├── POST /ingest/{pr}           Fetch PR from GitHub, analyse, store (local JSON)
  ├── GET  /prs                   List stored PRs
  └── GET  /prs/{pr}              Get a single stored PR
```

---

## Environment variables

| App | Variable | Default | Description |
|---|---|---|---|
| web | `DEMO_MODE` | *(unset)* | Set to `fixture` to skip live BOB calls and serve the demo fixture |
| web | `PR_INGEST_URL` | `http://localhost:8000` | Base URL of the `apps/api` service (server-side) |
| api | `GITHUB_TOKEN` | *(required)* | Token used by `apps/api/*/ingest` endpoints |
| api | `GITHUB_REPO` | *(required)* | `owner/repo` used by `apps/api/*/ingest` endpoints |
| api | `API_PORT` | `8000` | HTTP port for `apps/api` |
| api | `DB_PATH` | *(file next to store)* | Path to the local JSON PR store |

---

## Validate the fixture

```bash
pnpm validate
```

Runs [`apps/web/scripts/validate-fixture.mjs`](apps/web/scripts/validate-fixture.mjs) — checks that the demo JSON is internally consistent (finding ids, severity/decision rules, blast radius edges). Run this after any change to `fixtures/demo-pr.json`.
