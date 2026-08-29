// In-memory job store. Deliberately not a database — the prototype has one job at a time.
import type { AgentId, AgentStatus } from './types';

export interface JobProgress {
  agent: AgentId;
  status: AgentStatus;
  durationMs: number;
}

export interface Job {
  jobId: string;
  startedAt: number;
  prUrl?: string;
}

const jobs = new Map<string, Job>();

/** Staggered so the three specialists visibly finish at different times. */
export const AGENT_SCHEDULE: { agent: AgentId; startMs: number; endMs: number }[] = [
  { agent: 'docs-compliance', startMs: 400, endMs: 2740 },
  { agent: 'code-analyst', startMs: 400, endMs: 3520 },
  { agent: 'test-security', startMs: 400, endMs: 5270 },
  { agent: 'orchestrator', startMs: 5270, endMs: 6600 },
];

export const TOTAL_RUN_MS = 6600;

export function createJob(prUrl?: string): Job {
  const job: Job = {
    jobId: `job_${Date.now().toString(36)}`,
    startedAt: Date.now(),
    prUrl,
  };
  jobs.set(job.jobId, job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function progressFor(job: Job, now = Date.now()): JobProgress[] {
  const elapsed = now - job.startedAt;
  return AGENT_SCHEDULE.map(({ agent, startMs, endMs }) => ({
    agent,
    status: (elapsed < startMs ? 'pending' : elapsed < endMs ? 'running' : 'complete') as AgentStatus,
    durationMs: endMs - startMs,
  }));
}

export function isComplete(job: Job, now = Date.now()): boolean {
  return now - job.startedAt >= TOTAL_RUN_MS;
}
