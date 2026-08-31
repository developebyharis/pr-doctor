import { NextRequest, NextResponse } from 'next/server';
import {
  isApiUp,
  fetchLivePrDetail,
  type GithubPrDetailShape,
} from '@/lib/ingestion';

export interface GithubFileDiff {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export type GithubPRDetail = GithubPrDetailShape;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const prNumber = Number(number);
  if (!Number.isInteger(prNumber)) {
    return NextResponse.json({ error: 'Invalid PR number' }, { status: 400 });
  }

  const token = req.nextUrl.searchParams.get('token');
  const repo = req.nextUrl.searchParams.get('repo');

  if (!token || !repo || !repo.includes('/')) {
    return NextResponse.json(
      { error: 'Missing required parameters: token, repo (owner/repo)' },
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
    const detail = await fetchLivePrDetail(token, repo, prNumber);
    return NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch PR detail';
    return NextResponse.json({ error: message, detail: message }, { status: 502 });
  }
}
