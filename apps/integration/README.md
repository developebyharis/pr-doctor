# `apps/integration` — PR Doctor Integration Service

PR Doctor is a Python service that connects to GitHub, fetches pull request data,
runs a risk analysis over every changed file, stores the results locally, and exposes
them through both a REST API and a CLI. It is the data-ingestion backbone of the
PR Doctor hackathon project.

---

## Quick Start

### 1. Prerequisites

- Python 3.13+
- [`uv`](https://github.com/astral-sh/uv) (package manager)
- A GitHub personal access token with `repo` read scope

### 2. Install dependencies

```bash
cd apps/integration
uv sync
```

### 3. Configure environment

Create a `.env` file in `apps/integration/`:

```dotenv
GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere
GITHUB_REPO=owner/repo-name

# Optional — defaults shown
GITHUB_DEFAULT_BRANCH=main
API_HOST=localhost
API_PORT=8000
DB_PATH=./data/pr_doctor.json
```

> **Never commit `.env`.** It is already listed in `.gitignore` and `.bobignore`.

### 4. Run

**CLI (recommended for development):**
```bash
.venv/bin/python -m integration.cli --help
```

**REST API server:**
```bash
.venv/bin/python -m integration.cli serve
# → http://localhost:8000
# → http://localhost:8000/docs  (interactive Swagger UI)
```

---

## Project Layout

```
apps/integration/
├── pyproject.toml                  # Package metadata & dependencies
├── .python-version                 # Pins Python 3.13
├── .env                            # Local secrets (not committed)
├── data/
│   └── pr_doctor.json              # TinyDB database file (auto-created)
└── src/
    ├── main.py                     # Entry point — delegates to cli.py
    └── integration/
        ├── __init__.py
        ├── settings.py             # Environment config (pydantic-settings)
        ├── models.py               # Pydantic data models
        ├── storage.py              # TinyDB read/write layer
        ├── api.py                  # FastAPI REST application
        ├── cli.py                  # Typer CLI application
        └── ingestion/
            ├── __init__.py         # Public: ingest_pr, list_open_prs
            └── _legacy.py          # PyGithub fetching + risk heuristics
```

---

## Module Reference

### `settings.py` — Configuration

Uses `pydantic-settings` to load config from environment variables and the `.env` file.

```python
class Settings(BaseSettings):
    github_token:          str   # GITHUB_TOKEN           (required)
    github_repo:           str   # GITHUB_REPO            (required) — "owner/repo" format
    github_default_branch: str   # GITHUB_DEFAULT_BRANCH  (default: "main")
    api_host:              str   # API_HOST               (default: "localhost")
    api_port:              int   # API_PORT               (default: 8000)
    db_path:               str   # DB_PATH                (default: "./data/pr_doctor.json")

    # computed — not an env var
    repo_tree_url: str  # https://github.com/{github_repo}/tree/{github_default_branch}
```

`get_settings()` returns a module-level singleton — the `Settings` object is
constructed once and reused on every subsequent call.

---

### `models.py` — Data Models

All models are Pydantic v2 `BaseModel` subclasses.

#### `RiskLevel`
A `str` enum with four levels: `low` · `medium` · `high` · `critical`

#### `FileDiff`
Represents one changed file within a PR.

| Field | Type | Description |
|---|---|---|
| `filename` | `str` | Full path of the file |
| `status` | `str` | `added` \| `modified` \| `removed` \| `renamed` |
| `additions` | `int` | Lines added (default 0) |
| `deletions` | `int` | Lines deleted (default 0) |
| `patch` | `str \| None` | Raw unified diff text; `None` for binary files |

#### `RiskHeuristic`
A single risk signal detected in the PR.

| Field | Type | Description |
|---|---|---|
| `rule` | `str` | Rule identifier (e.g. `secret_pattern`, `large_diff`) |
| `description` | `str` | Human-readable explanation |
| `level` | `RiskLevel` | Severity of this specific signal |
| `file` | `str \| None` | File that triggered the rule (if applicable) |
| `line` | `int \| None` | Line number (reserved for future use) |

#### `PRRecord`
The complete stored representation of an ingested pull request.

| Field | Type | Description |
|---|---|---|
| `id` | `int` | GitHub PR number |
| `repo` | `str` | `owner/repo` |
| `title` | `str` | PR title |
| `body` | `str \| None` | PR description body |
| `author` | `str` | GitHub login of the PR author |
| `state` | `str` | `open` \| `closed` \| `merged` |
| `base_branch` | `str` | Target branch (e.g. `main`) |
| `head_branch` | `str` | Source branch |
| `created_at` | `datetime` | PR creation timestamp |
| `updated_at` | `datetime` | Last update timestamp |
| `merged_at` | `datetime \| None` | Merge timestamp; `None` if not merged |
| `files` | `list[FileDiff]` | All changed files |
| `risk_heuristics` | `list[RiskHeuristic]` | All triggered risk signals |
| `overall_risk` | `RiskLevel` | Worst-case risk across all heuristics |
| `labels` | `list[str]` | GitHub label names applied to the PR |
| `review_comments` | `int` | Number of review comments |
| `commits` | `int` | Number of commits in the PR |

---

### `storage.py` — Local Database

Wraps [TinyDB](https://tinydb.readthedocs.io/) with a JSON file backend and a caching
middleware layer. All writes are immediately flushed to disk. The database file is
created automatically at the path specified by `DB_PATH`.

Records are keyed by the composite `(repo, id)` pair, which means the same PR number
from two different repos will never collide.

| Function | Description |
|---|---|
| `upsert_pr(record, settings)` | Insert or update a `PRRecord`. Uses TinyDB `upsert` keyed on `(repo, id)`. |
| `get_pr(pr_number, repo, settings)` | Retrieve one `PRRecord` by number + repo. Returns `None` if not found. |
| `list_prs(settings, risk_filter)` | Return all stored `PRRecord`s. Pass a `RiskLevel` string to filter. |
| `delete_pr(pr_number, repo, settings)` | Remove a record. Returns `True` if a record was deleted, `False` otherwise. |

---

### `api.py` — REST API

A FastAPI application exposing six endpoints. Start it with `cli serve` or via `uvicorn integration.api:app`.
Interactive docs are available at `/docs` once the server is running.

#### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — returns `{"status": "ok"}` |
| `POST` | `/ingest/{pr_number}` | Fetch PR from GitHub, analyse, store, return `PRRecord` |
| `POST` | `/ingest/bulk/open` | Fetch all open PRs (up to `?limit=50`), analyse, store all |
| `GET` | `/prs` | List all stored PRs; optionally filter with `?risk=high` |
| `GET` | `/prs/{pr_number}` | Retrieve one stored PR by number |
| `DELETE` | `/prs/{pr_number}` | Delete a stored PR record |

All settings (token, repo, db path) are injected via FastAPI dependency injection using
`get_settings()`.

---

### `cli.py` — Command-Line Interface

A [Typer](https://typer.tiangolo.com/) CLI with five commands.

#### `ingest <pr_number>`
Fetch and analyse a single PR, store it, then print the risk summary to stdout.

```bash
.venv/bin/python -m integration.cli ingest 42
# Ingesting PR #42 from owner/repo …
# ✓  Risk: high  |  Heuristics: 2
#    [high] large_diff: File has 612 changed lines (>500)
#    [medium] config_change: Configuration file modified
```

#### `ingest-open [--limit N]`
Fetch all open PRs (default 20), store each, print a summary table.

```bash
.venv/bin/python -m integration.cli ingest-open --limit 10
```

#### `show <pr_number>`
Print a single stored PR as pretty-printed JSON.

```bash
.venv/bin/python -m integration.cli show 42
```

#### `list [--risk LEVEL]`
List all stored PRs in a compact table. Optionally filter by risk level.

```bash
.venv/bin/python -m integration.cli list
.venv/bin/python -m integration.cli list --risk critical
```

#### `serve [--host HOST] [--port PORT]`
Start the FastAPI REST server with hot-reload. Host and port fall back to `settings.api_host` / `settings.api_port`.

```bash
.venv/bin/python -m integration.cli serve
.venv/bin/python -m integration.cli serve --port 9000
```

---

### `ingestion/` — Fetching Engine

See [`src/integration/ingestion/README.md`](src/integration/ingestion/README.md) for
the full breakdown of the ingestion sub-package, including every risk rule, the
internal call graph, and the data flow diagram.

---

## Full Data Flow

```
User / HTTP client
       │
       ▼
  cli.py  ──or──  api.py
       │
       ▼
ingestion.ingest_pr(pr_number, settings)
       │
       ├─ PyGithub → GitHub REST API
       │     └─ PR metadata + changed file list + patches
       │
       ├─ _parse_files()        → list[FileDiff]
       ├─ _detect_heuristics()  → list[RiskHeuristic]
       └─ _overall_risk()       → RiskLevel
              │
              ▼
         PRRecord
              │
              ▼
       storage.upsert_pr()
              │
              ▼
     data/pr_doctor.json  (TinyDB)
```

---

## Dependencies

| Package | Version | Role |
|---|---|---|
| `PyGithub` | ≥2.3.0 | GitHub REST API client |
| `pydantic` | ≥2.7.0 | Data model validation |
| `pydantic-settings` | ≥2.3.0 | `.env` / environment config loading |
| `fastapi` | ≥0.111.0 | REST API framework |
| `uvicorn[standard]` | ≥0.30.0 | ASGI server for FastAPI |
| `tinydb` | ≥4.8.0 | Lightweight JSON file database |
| `typer` | ≥0.12.0 | CLI framework |
| `python-dotenv` | ≥1.0.0 | `.env` file loading |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | ✅ | — | GitHub personal access token |
| `GITHUB_REPO` | ✅ | — | Target repo in `owner/repo` format |
| `GITHUB_DEFAULT_BRANCH` | ❌ | `main` | Default branch used to build the repo tree URL |
| `API_HOST` | ❌ | `localhost` | Host the REST server binds to |
| `API_PORT` | ❌ | `8000` | Port the REST server listens on |
| `DB_PATH` | ❌ | `./data/pr_doctor.json` | Path to the TinyDB JSON file |
