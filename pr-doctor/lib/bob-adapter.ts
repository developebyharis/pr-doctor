// The only place that talks to IBM BOB. Everything else imports analyzePR().
//
// DEMO_MODE=fixture short-circuits to committed data. Keep that path working:
// it is the fallback if a live call fails on stage.
import fixture from '../fixtures/demo-pr.json';
import type { AgentReport, FinalVerdict, PRContext } from './types';
import { getGraphifyContext, graphifyContextToPrompt } from './graphify';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const execFile = promisify(execFileCb);

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
    const preamble = readFileSync(join(process.cwd(), 'prompts', '00-shared-preamble.md'), 'utf8');
    const codeAnalyst = readFileSync(join(process.cwd(), 'prompts', '01-code-analyst.md'), 'utf8');

    // Graphify context: find nodes/edges for changed files so the agent can
    // trace blast radius using the real dependency graph instead of guessing.
    const changedPaths = _context.filesChanged.map(f => f.path);
    const graphCtx = getGraphifyContext(changedPaths);
    const graphPrompt = graphifyContextToPrompt(graphCtx);

    const prompt =
      preamble + '\n\n' +
      codeAnalyst + '\n\n' +
      graphPrompt + '\n\n' +
      'PR CONTEXT:\n' + JSON.stringify(_context, null, 2) + '\n\n' +
      'Return ONLY valid JSON matching AgentReport. No prose. No markdown fences.';

    const { stdout } = await execFile(
      'bob',
      [
        'run',
        '--trust',
        '--accept-license',
        '--format', 'json',
        '--mode', 'ask',
        '--max-cost', '3',
        '--max-turns', '8',
        prompt,
      ],
      {
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024,
        cwd: process.cwd(),
        env: process.env,
      }
    );

    const envelope = JSON.parse(stdout.trim());
    if (envelope.status !== 'success') {
      throw new Error(`[bob-adapter] bob run status=${envelope.status}`);
    }

    console.log('[bob-adapter] duration_ms=%d session_costs=%s',
      envelope.stats?.duration_ms,
      JSON.stringify(envelope.stats?.session_costs));

    // Strip possible ``` fences
    const raw = (envelope.last_message as string)
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const liveReport: AgentReport = JSON.parse(raw);

    if (
      typeof liveReport.agent !== 'string' ||
      typeof liveReport.status !== 'string' ||
      !Array.isArray(liveReport.findings)
    ) {
      throw new Error('[bob-adapter] live report failed shape validation');
    }

    const base = getFixtureVerdict(jobId);
    return {
      ...base,
      simulated: false,
      reports: [liveReport, ...base.reports.slice(1)],
    };
  } catch (err) {
    console.error('[bob-adapter] live call failed, serving fixture', err);
    return getFixtureVerdict(jobId);
  }
}
