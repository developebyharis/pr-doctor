import { NextResponse } from 'next/server';
import { createJob, TOTAL_RUN_MS } from '@/lib/job-store';

export async function POST(request: Request) {
  let prUrl: string | undefined;
  try {
    const body = await request.json();
    prUrl = typeof body?.prUrl === 'string' ? body.prUrl : undefined;
  } catch {
    // No body is fine — the demo CTA sends none.
  }

  const job = createJob(prUrl);
  return NextResponse.json({ jobId: job.jobId, estimatedMs: TOTAL_RUN_MS });
}
