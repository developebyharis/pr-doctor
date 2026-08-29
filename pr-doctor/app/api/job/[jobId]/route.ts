import { NextResponse } from 'next/server';
import { getJob, progressFor, isComplete } from '@/lib/job-store';

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found. Start a new analysis.' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    complete: isComplete(job),
    progress: progressFor(job),
  });
}
