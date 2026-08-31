// Client for the Express apps/api ingestion service (apps/api).
//
// The web app proxies all GitHub PR data through this service. It is reached
// server-to-server from the Next.js API routes (not from the browser), so no
// CORS is needed. The service forwards the client-supplied token to GitHub and
// supports live pagination ("10 per page + Load More").

export interface GithubPrItemShape {
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

export interface GithubPrDetailShape extends GithubPrItemShape {
  mergedAt: string | null;
  files: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch: string | null;
  }[];
}

/** Base URL of the Express apps/api service. Override with PR_INGEST_URL. */
export function apiBaseUrl(): string {
  return process.env.PR_INGEST_URL ?? 'http://localhost:8000';
}

/** Whether the apps/api service is reachable. */
export async function isApiUp(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl()}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

interface LivePrsParams {
  token: string;
  owner: string;
  repo: string;
  page: number;
  perPage: number;
}

/** Live, paginated list of open PRs (proxies the client token to GitHub). */
export async function fetchLivePrs(params: LivePrsParams): Promise<GithubPrItemShape[]> {
  const { token, owner, repo, page, perPage } = params;
  const res = await fetch(
    `${apiBaseUrl()}/github/prs?token=${encodeURIComponent(token)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&page=${page}&per_page=${perPage}`,
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? `apps/api /github/prs ${res.status}`);
  }
  return res.json();
}

/** Live PR detail with changed files (proxies the client token to GitHub). */
export async function fetchLivePrDetail(
  token: string,
  repo: string,
  prNumber: number,
): Promise<GithubPrDetailShape> {
  const res = await fetch(
    `${apiBaseUrl()}/github/prs/${prNumber}?token=${encodeURIComponent(token)}&repo=${encodeURIComponent(repo)}`,
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? `apps/api /github/prs/${prNumber} ${res.status}`);
  }
  return res.json();
}
