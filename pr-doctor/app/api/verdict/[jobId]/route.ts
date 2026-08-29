import { NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';
import { analyzePR, getDemoContext, getFixtureVerdict } from '@/lib/bob-adapter';

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId);

  // Serve the fixture even for an unknown job id: a reload mid-demo must not
  // dead-end. The UI already labels the data as simulated.
  if (!job) {
    return NextResponse.json(getFixtureVerdict(params.jobId));
  }

  const verdict = await analyzePR(job.jobId, getDemoContext());
  return NextResponse.json(verdict);
}
