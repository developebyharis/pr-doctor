import { NextRequest, NextResponse } from 'next/server';
import {
  isApiUp,
  fetchLivePrs,
  type GithubPrItemShape,
} from '@/lib/ingestion';

export type GithubPRItem = GithubPrItemShape;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const owner = req.nextUrl.searchParams.get('owner');
  const repo = req.nextUrl.searchParams.get('repo');
  const page = Math.max(parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1, 1);
  const perPage = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get('per_page') ?? '10', 10) || 10, 1),
    100,
  );

  if (!token || !owner || !repo) {
    return NextResponse.json(
      { error: 'Missing required parameters: token, owner, repo' },
      { status: 400 },
    );
  }

  const apiUp = await isApiUp();
  if (!apiUp) {
    return NextResponse.json(
      {
        error: 'apps/api service unavailable',
        detail:
          'Start the ingestion service with `pnpm api:ts:serve` (Express on http://localhost:8000).',
      },
      { status: 503 },
    );
  }

  try {
    const prs = await fetchLivePrs({ token, owner, repo, page, perPage });
    return NextResponse.json(prs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch PRs';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
