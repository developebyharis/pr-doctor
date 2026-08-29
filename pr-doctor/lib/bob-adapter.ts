// The only place that talks to IBM BOB. Everything else imports analyzePR().
//
// DEMO_MODE=fixture short-circuits to committed data. Keep that path working:
// it is the fallback if a live call fails on stage.
import fixture from '../fixtures/demo-pr.json';
import type { FinalVerdict, PRContext } from './types';

const demoVerdict = fixture as unknown as FinalVerdict;

export function getFixtureVerdict(jobId: string): FinalVerdict {
  return { ...demoVerdict, jobId };
}

export function getDemoContext(): PRContext {
  return demoVerdict.context;
}

export async function analyzePR(jobId: string, _context: PRContext): Promise<FinalVerdict> {
  if (process.env.DEMO_MODE === 'fixture') {
    return getFixtureVerdict(jobId);
  }

  try {
    // TODO(Phase 5): real IBM BOB 2.0 call goes here.
    // Parse the response into FinalVerdict, then `return parsed`.
    // Do not guess the API shape — paste IBM's documented client in.
    return getFixtureVerdict(jobId);
  } catch (err) {
    console.error('[bob-adapter] live call failed, serving fixture', err);
    return getFixtureVerdict(jobId);
  }
}
