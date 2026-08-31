'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AgentId, AgentStatus, BlastRadius, FinalVerdict, Finding, PRContext, Severity } from '@/lib/types';
import { allFindings } from '@/lib/types';
import type { GraphifyContextResponse } from '@/app/api/graphify/route';
import { GraphifyNetwork, graphC } from '@/app/components/GraphifyNetwork';
import { Shell } from '@/app/components/ui';
import { ErrorBlock, LoadingBlock, InfoBlock } from '@/app/components/ui';

interface JobProgress {
  agent: AgentId;
  status: AgentStatus;
  durationMs: number;
}

interface PollResponse {
  jobId: string;
  complete: boolean;
  analysisStatus: string;
  analysisError: string | null;
  progress: JobProgress[];
}

interface CachedInvestigation {
  jobId: string;
  progress: JobProgress[];
  verdict: FinalVerdict;
  // Raw snapshot of sessionStorage['pr-doctor:pr-context'] at the time this
  // investigation was cached. Used to detect "a new PR context has since
  // been set" without deleting the cache on every render.
  prContextRaw: string | null;
}

const AGENT_META: Record<AgentId, { displayName: string; mode: string }> = {
  'code-analyst':      { displayName: 'Code Analyst',                mode: 'Code' },
  'test-security':     { displayName: 'Test & Security',             mode: 'Advanced' },
  'docs-compliance':   { displayName: 'Documentation & Compliance',  mode: 'Ask' },
  'orchestrator':      { displayName: 'PR Orchestrator',             mode: 'Orchestrator' },
};

// Specialists only — orchestrator is not shown as a lane
const LANE_AGENTS: AgentId[] = ['code-analyst', 'test-security', 'docs-compliance'];

const DECISION_COLOR: Record<string, string> = {
  BLOCK:      '#B4232A',
  NEEDS_WORK: '#9A6A00',
  MERGE:      '#157A5B',
};

const SEV_STYLE: Record<Severity, { color: string; borderColor: string; background: string }> = {
  critical: { color: '#B4232A', borderColor: '#B4232A', background: '#FBEFEF' },
  high:     { color: '#B4232A', borderColor: '#B4232A', background: 'transparent' },
  medium:   { color: '#9A6A00', borderColor: '#9A6A00', background: 'transparent' },
  low:      { color: '#6B7280', borderColor: '#D4D4D1', background: 'transparent' },
};

function SeverityPill({ sev }: { sev: Severity }) {
  const s = SEV_STYLE[sev];
  return (
    <div style={{
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '3px 0',
      textAlign: 'center',
      border: '1px solid',
      color: s.color,
      borderColor: s.borderColor,
      background: s.background,
    }}>
      {sev}
    </div>
  );
}

function FindingRow({ f, agentLabel, jobId }: { f: Finding; agentLabel: string; jobId?: string | null }) {
  const href = jobId ? `/finding/${f.id}?job=${encodeURIComponent(jobId)}` : `/finding/${f.id}`;
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '78px 1fr auto',
        gap: 16,
        alignItems: 'start',
        padding: '13px 0',
        borderTop: '1px solid #E7E7E5',
        cursor: 'pointer',
      }}>
        <SeverityPill sev={f.severity} />
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, color: '#111113' }}>{f.title}</div>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>
            {f.file}:{f.line}
          </div>
        </div>
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 10.5,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#4A5568',
          background: '#F1F3F5',
          padding: '3px 7px',
          whiteSpace: 'nowrap',
          alignSelf: 'start',
        }}>
          {agentLabel}
        </div>
      </div>
    </Link>
  );
}

// ── Graphify Panel ────────────────────────────────────────────────────────────
// The demo PR (acme/ledger-api) isn't part of the committed snapshot, which is
// now the real excalidraw/excalidraw monorepo (packages/*). So the panel
// honestly reports "not indexed" while showing the real snapshot stats. When the
// analyzed repo IS in the graph (a PR opened against a covered repo), it renders
// the interactive dependency graph for the PR's changed files — the same
// visualisation used on the PR detail page.
function GraphifyPanel({ files, blastRadius }: { files: string[]; blastRadius: BlastRadius }) {
  const [ctx, setCtx] = useState<GraphifyContextResponse | null>(null);
  // Depend on a stable string key, not the `files` array reference — the parent
  // creates a new array each render, which would otherwise refire the fetch
  // (and hammer the Graphify API) on every re-render.
  const filesKey = files.join(',');

  useEffect(() => {
    let cancelled = false;
    const query = filesKey.length > 0 ? `?files=${encodeURIComponent(filesKey)}` : '';
    fetch(`/api/graphify${query}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setCtx(data);
      })
      .catch(() => { /* ignore — panel just won't render */ });
    return () => {
      cancelled = true;
    };
  }, [filesKey]);

  if (!ctx) return null;

  return (
    <div style={{ padding: '20px 26px', borderTop: '1px solid #E7E7E5' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: graphC.plex }}>
          Graphify — blast radius &amp; dependency graph
        </div>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: ctx.indexed ? graphC.clear : graphC.caution, border: `1px dashed ${ctx.indexed ? graphC.clear : graphC.caution}`, padding: '2px 7px', background: ctx.indexed ? graphC.clearWash : graphC.cautionWash }}>
          {ctx.indexed ? `${ctx.indexedRepo} indexed` : 'Not indexed by Graphify'}
        </div>
      </div>

      {ctx.indexed ? (
        <>
          {/* Stats strip */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Graph nodes', value: ctx.graphStats.totalNodes },
              { label: 'Graph edges', value: ctx.graphStats.totalEdges },
              { label: 'Changed symbols', value: ctx.changedNodes.length },
              { label: 'Direct connections', value: ctx.neighbours.length },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.muted, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1, color: graphC.plex }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Blast-radius graph */}
          <div style={{ fontSize: 14, color: graphC.ink, marginBottom: 8, fontWeight: 600 }}>Blast radius</div>
          <div style={{ border: `1px solid ${graphC.rule}`, background: graphC.chart, padding: 8, marginBottom: 20 }}>
            <GraphifyNetwork ctx={ctx} />
          </div>

          {/* How it connects to the agents */}
          <div style={{ background: graphC.plexWash, border: '1px solid #D4D4D1', borderLeft: '4px solid #4A5568', padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.plex, marginBottom: 6 }}>
              How Graphify powers the agents
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: graphC.ink }}>
              Before each BOB agent runs, PR Doctor queries this graph for every changed file and extracts the 1-hop
              neighbour subgraph. That subgraph — symbols, call edges, and communities — is injected directly into the
              agent prompt, letting each role reason about actual blast radius instead of guessing from the diff.
            </div>
          </div>

          {/* Communities */}
          {ctx.touchedCommunities.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.muted, marginBottom: 8 }}>
                Communities touched
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ctx.touchedCommunities.map(c => (
                  <span key={c} style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: graphC.plex, background: graphC.plexWash, padding: '3px 8px' }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Honest indexed status for the PR being analyzed */}
          <div style={{ background: graphC.cautionWash, border: '1px solid #E7E7E5', borderLeft: '4px solid #9A6A00', padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.caution, marginBottom: 6 }}>
              This repo isn&apos;t in the graph snapshot
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: graphC.ink }}>
              None of this PR&apos;s changed files map to symbols in the committed graph — which is the{' '}
              {ctx.indexedRepo || 'excalidraw/excalidraw'} monorepo ({ctx.graphStats.totalNodes} nodes ·{' '}
              {ctx.graphStats.totalEdges} edges). In production, Graphify runs on the target repo before analysis, so
              every changed file resolves to its call sites. Nothing here is fabricated: this panel only renders a real
              blast-radius graph when the analyzed repo is actually in the snapshot.
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Graph nodes', value: ctx.graphStats.totalNodes },
              { label: 'Graph edges', value: ctx.graphStats.totalEdges },
              { label: 'Changed files queried', value: files.length },
              { label: 'Snapshot repo', value: ctx.indexedRepo || '—' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.muted, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1, color: graphC.plex }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* How it connects to the agents — the key demo talking point */}
          <div style={{ background: graphC.plexWash, border: '1px solid #D4D4D1', borderLeft: '4px solid #4A5568', padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.plex, marginBottom: 6 }}>
              How Graphify powers the agents
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: graphC.ink }}>
              Before each BOB agent runs, PR Doctor queries this graph for every changed file and extracts the 1-hop
              neighbour subgraph — symbols, call edges, and communities — and injects it directly into the agent prompt.
              This is why the analysis could pinpoint <code style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, background: '#F6F8F9', border: '1px solid #E7E7E5', padding: '1px 4px' }}>billing/refund.ts:88</code> as{' '}
              the downstream blast radius: the graph told it to look there, not the diff.
            </div>
          </div>

          <div style={{ marginTop: 14, fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: graphC.muted, borderTop: '1px solid #E7E7E5', paddingTop: 10 }}>
            In production, Graphify runs on the target repo before analysis begins. The context packet is then injected
            into every agent prompt — no agent needs to grep the codebase; the graph does that work upfront.
          </div>

          {/* Derived blast radius — analysis verdict, shown since the graph isn't indexed */}
          {blastRadius && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: graphC.muted, marginBottom: 12 }}>
                Blast radius — derived from analysis (repo not in graph)
              </div>
              <RiskGraph br={blastRadius} />
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ── Risk Graph ────────────────────────────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 44;
const CHANGED_X = 20;
const COL1_X = 280;   // distance-1 nodes
const COL2_X = 520;   // distance-2 nodes
const ROW_SPACING = 70;
const SVG_H = 300;

function RiskGraph({ br }: { br: BlastRadius }) {
  // Assign Y positions: distance-1 nodes evenly spaced, distance-2 nodes beside their parent
  const d1 = br.affected.filter(n => n.distance === 1);
  const d2 = br.affected.filter(n => n.distance === 2);

  // Centre the distance-1 column vertically
  const totalD1Height = d1.length > 0 ? (d1.length - 1) * ROW_SPACING : 0;
  const d1StartY = (SVG_H - NODE_H - totalD1Height) / 2;

  const nodePos: Record<string, { x: number; y: number }> = {};

  // Changed node: vertically centred
  const changedCY = SVG_H / 2;
  nodePos[br.changedNode] = { x: CHANGED_X, y: changedCY - NODE_H / 2 };

  d1.forEach((n, i) => {
    nodePos[n.path] = { x: COL1_X, y: d1StartY + i * ROW_SPACING };
  });

  // d2 nodes: each sits beside its d1 parent via edges. Stack siblings of the
  // SAME parent below one another — the offset counter must be per-parent,
  // not global, or every distance-2 node past the first collapses onto the
  // same Y coordinate regardless of which parent it belongs to.
  const d2SiblingIndex: Record<string, number> = {};
  d2.forEach(n => {
    const parentEdge = br.edges.find(e => e.to === n.path && nodePos[e.from] && nodePos[e.from].x === COL1_X);
    const parentKey = parentEdge?.from ?? '__unparented__';
    const parentY = parentEdge ? nodePos[parentEdge.from].y : d1StartY;
    const siblingIdx = d2SiblingIndex[parentKey] ?? 0;
    nodePos[n.path] = { x: COL2_X, y: parentY + siblingIdx * ROW_SPACING * 0.6 };
    d2SiblingIndex[parentKey] = siblingIdx + 1;
  });

  // Caption values
  const noCoverage = br.affected.filter(n => !n.hasTests).length;
  const confPct = Math.round(br.confidence * 100);

  // Shorten a path for display: last two segments
  function shortName(path: string) {
    const parts = path.split('/');
    return parts.slice(-2).join('/');
  }

  const SVG_W = d2.length > 0 ? COL2_X + NODE_W + 20 : COL1_X + NODE_W + 20;

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Dependency graph: ${br.affected.length} files affected by change to ${shortName(br.changedNode)}`}
      >
        {/* Edges — drawn first so nodes sit on top */}
        {br.edges.map((e, i) => {
          const from = nodePos[e.from];
          const to = nodePos[e.to];
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          // dashed if destination has no tests
          const dest = br.affected.find(n => n.path === e.to);
          const dashed = dest && !dest.hasTests;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#D4D4D1"
              strokeWidth="1.5"
              strokeDasharray={dashed ? '3 3' : undefined}
            />
          );
        })}

        {/* Changed node */}
        {(() => {
          const pos = nodePos[br.changedNode];
          const label = shortName(br.changedNode);
          return (
            <g key="changed">
              <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H}
                fill="#FBEFEF" stroke="#B4232A" strokeWidth="2" />
              <text x={pos.x + NODE_W / 2} y={pos.y + 16}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="12" fontWeight="600" fill="#B4232A">{label}</text>
              <text x={pos.x + NODE_W / 2} y={pos.y + 30}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="10" fill="#8C1D18">changed</text>
            </g>
          );
        })()}

        {/* Affected nodes */}
        {br.affected.map(n => {
          const pos = nodePos[n.path];
          if (!pos) return null;
          const label = shortName(n.path);
          const noTests = !n.hasTests;
          const trustBorder = n.isTrustBoundary;
          const strokeW = trustBorder ? 2.5 : 1;

          if (noTests) {
            // dashed red outline, red fill wash
            return (
              <g key={n.path}>
                <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H}
                  fill="#FBEFEF" stroke="#B4232A" strokeWidth={strokeW} strokeDasharray="5 3" />
                <text x={pos.x + NODE_W / 2} y={pos.y + 16}
                  textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                  fontSize="12" fontWeight="600" fill="#B4232A">{label}</text>
                <text x={pos.x + NODE_W / 2} y={pos.y + 30}
                  textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                  fontSize="10" fill="#8C1D18">no coverage</text>
              </g>
            );
          }

          return (
            <g key={n.path}>
              <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H}
                fill="#FFFFFF" stroke="#D4D4D1" strokeWidth={strokeW} />
              <text x={pos.x + NODE_W / 2} y={pos.y + 16}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="12" fill="#111113">{label}</text>
              <text x={pos.x + NODE_W / 2} y={pos.y + 30}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="10" fill="#6B7280">tested</text>
            </g>
          );
        })}

        {/* Caption */}
        <text x="0" y={SVG_H - 8}
          fontFamily="IBM Plex Mono, monospace" fontSize="10.5" fill="#6B7280">
          {br.affected.length} files reached · {noCoverage} without coverage · graph confidence {confPct}%
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: '#6B7280' }}>
        <span><strong style={{ fontWeight: 500, color: '#111113' }}>Solid red</strong> — changed</span>
        <span><strong style={{ fontWeight: 500, color: '#111113' }}>Dashed red</strong> — reached, no tests</span>
        <span><strong style={{ fontWeight: 500, color: '#111113' }}>Grey</strong> — reached, covered</span>
      </div>
    </div>
  );
}

const SESSION_KEY = 'pr-doctor:investigation';
const PR_CONTEXT_KEY = 'pr-doctor:pr-context';

/**
 * Reads sessionStorage exactly once (called from a lazy useState initializer,
 * so it never re-runs on re-render and never runs as a render-time side
 * effect). Returns the current raw pr-context string plus a validated cached
 * investigation, if any — invalidating the cache only when the pr-context has
 * genuinely changed since it was cached, not merely because it exists.
 */
function readInitialState(): { prContextRaw: string | null; cached: CachedInvestigation | null } {
  if (typeof window === 'undefined') {
    return { prContextRaw: null, cached: null };
  }

  const prContextRaw = sessionStorage.getItem(PR_CONTEXT_KEY);

  let cached: CachedInvestigation | null = null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedInvestigation;
      // Only trust the cache if it was written for the same pr-context that's
      // currently staged. If a new PR context has been set since, the cached
      // investigation belongs to a different PR and must be discarded.
      if (parsed.prContextRaw === prContextRaw) {
        cached = parsed;
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    // Corrupted cache — ignore it, don't crash the page.
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  return { prContextRaw, cached };
}

export default function InvestigationPage() {
  // Computed once, on mount, via lazy initializer — not on every render.
  const initialRef = useRef<{ prContextRaw: string | null; cached: CachedInvestigation | null } | null>(null);
  if (initialRef.current === null) {
    initialRef.current = readInitialState();
  }
  const { prContextRaw: initialPrContextRaw, cached } = initialRef.current;

  const [prContext, setPrContext] = useState<PRContext | null>(() => {
    if (!initialPrContextRaw) return null;
    try {
      return JSON.parse(initialPrContextRaw) as PRContext;
    } catch {
      return null;
    }
  });

  const [jobId, setJobId] = useState<string | null>(cached?.jobId ?? null);
  const [progress, setProgress] = useState<JobProgress[]>(cached?.progress ?? []);
  const [verdict, setVerdict] = useState<FinalVerdict | null>(cached?.verdict ?? null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against React 18 StrictMode's dev-only double-invoke of effects.
  // A `cancelled` flag in the effect closure only stops the *state update*
  // after the fact — it does not stop the fetch() from firing a second time
  // and creating a second job server-side. This ref persists across the
  // mount → cleanup → mount replay (same component instance), so only the
  // very first invocation is ever allowed to call start().
  const hasStartedAnalysisRef = useRef(false);

  const allComplete = cached?.verdict != null;
  const [barWidths, setBarWidths] = useState<Record<AgentId, number>>({
    'code-analyst': allComplete ? 100 : 0,
    'test-security': allComplete ? 100 : 0,
    'docs-compliance': allComplete ? 100 : 0,
    'orchestrator': allComplete ? 100 : 0,
  });

  // Animate running bars
  useEffect(() => {
    const tick = setInterval(() => {
      setBarWidths(prev => {
        const next = { ...prev };
        progress.forEach(p => {
          if (p.status === 'running') {
            next[p.agent] = Math.min((next[p.agent] ?? 0) + 2, 92);
          } else if (p.status === 'complete') {
            next[p.agent] = 100;
          }
        });
        return next;
      });
    }, 80);
    return () => clearInterval(tick);
  }, [progress]);

  // Start analysis on mount — skip if we already have a valid cached verdict.
  useEffect(() => {
    if (cached?.verdict) return;

    if (!prContext) {
      setError('No PR context found. Go back and start a new investigation.');
      return;
    }

    // Block the replayed invocation from StrictMode's dev double-mount.
    // Without this, both invocations pass the checks above and both call
    // start(), posting to /api/analyze twice and creating two jobs.
    if (hasStartedAnalysisRef.current) return;
    hasStartedAnalysisRef.current = true;

    async function start() {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prContext }),
        });

        if (!res.ok) {
          throw new Error(`Failed to start analysis: ${res.status}`);
        }

        const data = await res.json();
        setJobId(data.jobId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error starting analysis');
        // Allow a retry (e.g. user navigates back and returns) since this
        // attempt failed before ever getting a jobId.
        hasStartedAnalysisRef.current = false;
      }
    }

    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll once we have a jobId — skip if verdict already cached.
  useEffect(() => {
    if (!jobId || verdict) return;
    const currentJobId = jobId;

    async function poll() {
      try {
        const res = await fetch(`/api/job/${encodeURIComponent(currentJobId)}`);
        if (!res.ok) return;
        const data: PollResponse = await res.json();
        setProgress(data.progress);
        setAnalysisError(data.analysisError);

        if (data.complete) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;

          const vRes = await fetch(`/api/verdict/${currentJobId}`);
          if (!vRes.ok) return;
          const v: FinalVerdict = await vRes.json();
          setVerdict(v);

          // Persist so back-navigation restores the completed state — tagged
          // with the pr-context it was computed from, so a later, different
          // pr-context correctly invalidates this cache instead of the cache
          // invalidating itself on the next render.
          try {
            const cachePayload: CachedInvestigation = {
              jobId: currentJobId,
              progress: data.progress,
              verdict: v,
              prContextRaw: initialPrContextRaw,
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(cachePayload));
          } catch { /* storage full — ignore */ }
        }
      } catch {
        // silently retry
      }
    }

    poll(); // immediate first tick
    intervalRef.current = setInterval(poll, 800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, verdict, initialPrContextRaw]);

  const visibleFindings: Finding[] = verdict ? allFindings(verdict) : [];
  const isRunning = !verdict && !error && progress.length > 0;
  const decisionColor = verdict ? (DECISION_COLOR[verdict.decision] ?? '#111113') : '#111113';

  return (
    <Shell>
      <main style={{ padding: '28px 0 80px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ color: 'var(--plex)', marginBottom: 6 }}>Investigation</div>
          <h1 className="display" style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', margin: 0, lineHeight: 1.1 }}>
            {verdict?.context.title ?? 'Analyzing a pull request'}
          </h1>
          {verdict && (
            <div className="mono" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
              {verdict.context.repo} · PR #{verdict.context.number} · {verdict.context.author}
            </div>
          )}
        </div>

        {/* Analysis mode chip */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 18,
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderRadius: 'var(--radius-sm)',
          ...(verdict?.simulated === false
            ? { color: 'var(--clear)', border: '1px solid var(--clear)', padding: '5px 12px', background: 'var(--clear-wash)' }
            : { color: 'var(--caution)', border: '1px dashed var(--caution)', padding: '5px 12px', background: 'var(--caution-wash)' }
          ),
        }}>
          {verdict?.simulated === false
            ? 'Live IBM BOB 2.0 analysis'
            : analysisError
              ? 'Live analysis unavailable — showing fallback data'
              : verdict
                ? 'Demo mode — fixture data (BOB not available)'
                : 'Analyzing…'}
        </div>

        {/* Live-run fallback note — only when a real analysis degraded to fixture */}
        {analysisError && verdict && (
          <InfoBlock tone="caution" title="Live IBM BOB unavailable — showing fallback data">{analysisError}</InfoBlock>
        )}

        {/* Error state */}
        {error && (
          <ErrorBlock title="Couldn't start the investigation" message={error} detail="Return to the pull request and try again, or start a new analysis." />
        )}

        {/* Verdict triage tag — shown only after verdict arrives */}
        {verdict && (
          <div style={{
            position: 'relative',
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            borderLeft: `8px solid ${decisionColor}`,
            padding: 'clamp(18px, 3vw, 26px)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 26,
            alignItems: 'center',
            marginBottom: 0,
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }} className="stack-sm">
            <div style={{
              fontFamily: '"IBM Plex Sans Condensed", sans-serif',
              fontWeight: 700,
              fontSize: 52,
              lineHeight: 0.9,
              letterSpacing: '-0.01em',
              color: decisionColor,
              border: `3px solid ${decisionColor}`,
              padding: '8px 16px 10px',
              transform: 'rotate(-1.5deg)',
            }}>
              {verdict.decision}
            </div>
            <div>
              <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>
                Orchestrator verdict · IBM BOB 2.0
              </div>
              <div style={{ fontSize: 14.5, maxWidth: '48ch' }}>{verdict.rationale}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280' }}>Confidence</div>
              <div style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif', fontWeight: 700, fontSize: 34, lineHeight: 1 }}>
                {Math.round(verdict.confidence * 100)}%
              </div>
              <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: '#6B7280' }}>not evidence</div>
            </div>
          </div>
        )}

        {/* Chart body */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginTop: 16, padding: 0 }}>

          {/* PR identity */}
          {verdict && (
            <div style={{ padding: '14px 26px', borderBottom: '1px solid #E7E7E5' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: 17 }}>{verdict.context.title}</span>
                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, color: '#6B7280' }}>
                  {verdict.context.repo} · PR #{verdict.context.number} · {verdict.context.author}
                </span>
              </div>
            </div>
          )}

          {/* Agent lanes */}
          <div style={{ padding: '20px 26px', borderBottom: '1px solid #E7E7E5' }}>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 14 }}>
              Specialists — parallel investigation
            </div>

            {LANE_AGENTS.map(agentId => {
              const meta = AGENT_META[agentId];
              const prog = progress.find(p => p.agent === agentId);
              const status: AgentStatus = prog?.status ?? 'pending';
              const width = barWidths[agentId] ?? 0;

              const findingCount = verdict
                ? verdict.reports.find(r => r.agent === agentId)?.findings.length ?? 0
                : 0;

              return (
                <div key={agentId} className="stack-sm" style={{ display: 'grid', gridTemplateColumns: '190px 1fr 78px', gap: 14, alignItems: 'center', padding: '7px 0' }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {meta.displayName}
                    <span style={{ display: 'block', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10.5, color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {meta.mode}
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 12, background: '#F1F3F5', border: '1px solid #E7E7E5' }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      background: '#4A5568',
                      opacity: 0.85,
                      width: `${width}%`,
                      transition: status === 'running' ? 'none' : 'width 0.9s cubic-bezier(.2,.7,.3,1)',
                    }} />
                  </div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
                    {status === 'pending' && '—'}
                    {status === 'running' && (
                      <span style={{ color: '#4A5568' }}>running</span>
                    )}
                    {status === 'complete' && prog && (
                      <span>
                        {(prog.durationMs / 1000).toFixed(1)}s
                        {findingCount > 0 && <span style={{ display: 'block', color: '#B4232A' }}>{findingCount} findings</span>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Orchestrator row */}
            {(() => {
              const orchMeta = AGENT_META['orchestrator'];
              const orchProg = progress.find(p => p.agent === 'orchestrator');
              const orchStatus: AgentStatus = orchProg?.status ?? 'pending';
              const orchWidth = barWidths['orchestrator'] ?? 0;
              return (
                <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: '190px 1fr 78px', gap: 14, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #E7E7E5', marginTop: 6 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {orchMeta.displayName}
                    <span style={{ display: 'block', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10.5, color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {orchMeta.mode}
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 12, background: '#F1F3F5', border: '1px solid #E7E7E5' }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      background: '#111113',
                      opacity: 0.85,
                      width: `${orchWidth}%`,
                      transition: orchStatus === 'running' ? 'none' : 'width 0.9s cubic-bezier(.2,.7,.3,1)',
                    }} />
                  </div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
                    {orchStatus === 'pending' && '—'}
                    {orchStatus === 'running' && <span style={{ color: '#4A5568' }}>running</span>}
                    {orchStatus === 'complete' && orchProg && `${(orchProg.durationMs / 1000).toFixed(1)}s`}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Findings — only ever populated once the full verdict lands; the
              backend has no per-agent findings endpoint, so we don't pretend
              to show a progressive reveal that doesn't exist. */}
          {(verdict || isRunning) && (
            <div style={{ padding: '20px 26px' }}>
              <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>
                {verdict
                  ? `Findings — ${visibleFindings.length} total, highest severity first`
                  : 'Findings — investigating…'}
              </div>
              {visibleFindings.map((f, i) => {
                const agentLabel = verdict?.reports.find(r => r.findings.some(ff => ff.id === f.id))?.displayName ?? f.agent;
                return (
                  <div key={f.id} style={{ borderTop: i === 0 ? 'none' : undefined }}>
                    <FindingRow f={f} agentLabel={agentLabel} jobId={jobId} />
                  </div>
                );
              })}
              {!verdict && (
                <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: '#6B7280', padding: '10px 0' }}>
                  Findings will appear once every specialist and the orchestrator have finished.
                </div>
              )}
            </div>
          )}

          {/* Loading state — no data yet */}
          {!verdict && progress.length === 0 && !error && (
            <LoadingBlock label="Starting investigation…" sub="Spinning up the four IBM BOB 2.0 specialist agents. This takes a few seconds." minHeight={140} />
          )}

          {/* Graphify context panel — shown after verdict; renders the
              interactive blast-radius graph when the repo is indexed, otherwise
              the honest not-indexed state with the derived blast radius. */}
          {verdict && <GraphifyPanel files={verdict.context.filesChanged.map(f => f.path)} blastRadius={verdict.blastRadius} />}
        </div>

        {/* Back link */}
        <div style={{ marginTop: 20 }}>
          <Link href="/" style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: '#6B7280', textDecoration: 'none', letterSpacing: '0.04em' }}>
            &larr; Back
          </Link>
        </div>

      </div>
      </main>
    </Shell>
  );
}