'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import type { GithubPRDetail, GithubFileDiff } from '@/app/api/github/prs/[number]/route';
import type { GraphifyContextResponse } from '@/app/api/graphify/route';
import { readRepo, readToken } from '@/lib/token-store';
import { GraphifyNetwork, graphC, buildGraphLayout } from '@/app/components/GraphifyNetwork';
import { Shell, mono, display } from '@/app/components/ui';

const C = {
  bg: '#F6F6F5',
  chart: '#FFFFFF',
  ink: '#111113',
  muted: '#6B7280',
  rule: '#E7E7E5',
  ruleStrong: '#D4D4D1',
  plex: '#4A5568',
  plexWash: '#F1F3F5',
  block: '#B4232A',
  blockWash: '#FBEFEF',
  caution: '#9A6A00',
  clear: '#157A5B',
  clearWash: '#E9F5F0',
  ground: '#F6F6F5',
};

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: C.muted, ...style }}>
      {children}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusPill({ state, draft }: { state: string; draft: boolean }) {
  if (draft) return (
    <span style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.muted, border: `1px solid ${C.ruleStrong}`, borderRadius: 'var(--radius-sm)', padding: '3px 9px' }}>
      Draft
    </span>
  );
  if (state === 'open') return (
    <span style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.clear, border: `1px solid ${C.clear}`, borderRadius: 'var(--radius-sm)', padding: '3px 9px', background: C.clearWash }}>
      Open
    </span>
  );
  if (state === 'closed') return (
    <span style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.block, border: `1px solid ${C.block}`, borderRadius: 'var(--radius-sm)', padding: '3px 9px', background: C.blockWash }}>
      Closed
    </span>
  );
  return null;
}

function parseDiff(patch: string): { type: 'del' | 'add' | 'hunk' | 'ctx'; text: string }[] {
  return patch.split('\n').map(line => {
    if (line.startsWith('@@')) return { type: 'hunk', text: line };
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'del', text: line };
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add', text: line };
    return { type: 'ctx', text: line };
  });
}

function FileCard({ file }: { file: GithubFileDiff }) {
  const [open, setOpen] = useState(false);
  const statusColor = file.status === 'added' ? C.clear
    : file.status === 'removed' ? C.block
    : C.caution;

  const diffLines = file.patch ? parseDiff(file.patch) : null;

  return (
    <div className="ui-card" style={{ overflow: 'hidden', marginBottom: 10, borderRadius: 'var(--radius)' }}>
      {/* File header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: open ? C.plexWash : C.chart,
          border: 'none',
          cursor: file.patch ? 'pointer' : 'default',
          textAlign: 'left' as const,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 'var(--radius-sm)', padding: '2px 6px', flexShrink: 0 }}>
            {file.status === 'added' ? 'new' : file.status === 'removed' ? 'del' : file.status === 'renamed' ? 'ren' : 'mod'}
          </span>
          <span className="mono" style={{ fontSize: 12.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {file.filename}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          {file.additions > 0 && <span className="mono" style={{ fontSize: 12, color: C.clear }}>+{file.additions}</span>}
          {file.deletions > 0 && <span className="mono" style={{ fontSize: 12, color: C.block }}>−{file.deletions}</span>}
          {file.patch && (
            <span className="mono" style={{ fontSize: 11, color: C.muted }}>{open ? '▲' : '▼'}</span>
          )}
        </div>
      </button>

      {/* Diff view */}
      {open && diffLines && (
        <div style={{ borderTop: `1px solid ${C.rule}`, overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
          <pre style={{ margin: 0, padding: '10px 0', ...mono, fontSize: 12, lineHeight: 1.6 }}>
            {diffLines.map((line, i) => {
              const bg = line.type === 'del' ? C.blockWash
                : line.type === 'add' ? C.clearWash
                : line.type === 'hunk' ? C.plexWash
                : 'transparent';
              const color = line.type === 'del' ? '#8C1D18'
                : line.type === 'add' ? '#14512F'
                : line.type === 'hunk' ? C.plex
                : C.muted;
              return (
                <span key={i} style={{ display: 'block', background: bg, color, padding: '0 16px', whiteSpace: 'pre' }}>
                  {line.text || ' '}
                </span>
              );
            })}
          </pre>
        </div>
      )}
      {open && !file.patch && (
        <div style={{ borderTop: `1px solid ${C.rule}`, padding: '12px 16px', ...mono, fontSize: 12, color: C.muted }}>
          Binary file or diff not available.
        </div>
      )}
    </div>
  );
}


function GraphifyBlastPanel({ ctx, repo }: { ctx: GraphifyContextResponse; repo: string }) {
  const layout = ctx.indexed ? buildGraphLayout(ctx) : null;
  return (
    <div className="ui-card" style={{ marginTop: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${graphC.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: graphC.plex }}>
          Graphify — blast radius &amp; dependency graph
        </div>
        <div style={{ ...mono, fontSize: 10, color: ctx.indexed ? graphC.clear : graphC.caution, border: `1px dashed ${ctx.indexed ? graphC.clear : graphC.caution}`, borderRadius: 'var(--radius-sm)', padding: '3px 8px', background: ctx.indexed ? graphC.clearWash : graphC.cautionWash }}>
          {ctx.indexed ? 'Files found in graph' : 'Repo not indexed by Graphify'}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {ctx.indexed ? (
          <>
            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 32, marginBottom: 20, flexWrap: 'wrap' as const }}>
              {[
                { label: 'Graph nodes', value: ctx.graphStats.totalNodes },
                { label: 'Graph edges', value: ctx.graphStats.totalEdges },
                { label: 'Changed symbols', value: ctx.changedNodes.length },
                { label: 'Direct connections', value: ctx.neighbours.length },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: graphC.muted, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ ...display, fontSize: 26, lineHeight: 1, color: graphC.plex }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Dependency graph */}
            <div style={{ fontSize: 14, color: graphC.ink, marginBottom: 6, fontWeight: 600 }}>
              Blast radius
            </div>
            <div style={{ ...mono, fontSize: 11, color: graphC.muted, marginBottom: 12 }}>
              {ctx.changedNodes.length} symbols across {layout?.changedFiles.length ?? 0} changed files reach {ctx.neighbours.length} direct connections across {layout?.neighbourFiles.length ?? 0} dependency files (capped to the most-connected).
            </div>

            <div style={{ border: `1px solid ${graphC.rule}`, background: graphC.chart, borderRadius: 'var(--radius)', padding: 8 }}>
              <GraphifyNetwork ctx={ctx} />
            </div>

            {/* Communities */}
            {ctx.touchedCommunities.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, color: graphC.muted, marginBottom: 8, fontWeight: 600, ...mono, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Communities touched</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {ctx.touchedCommunities.map(c => (
                    <span key={c} style={{ ...mono, fontSize: 11, color: graphC.plex, background: graphC.plexWash, borderRadius: 'var(--radius-sm)', padding: '3px 9px' }}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ background: graphC.cautionWash, border: `1px solid ${graphC.ruleStrong}`, borderLeft: `4px solid ${graphC.caution}`, borderRadius: 'var(--radius)', padding: '16px 18px' }}>
            <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: graphC.caution, marginBottom: 8 }}>
              {repo} is not in the Graphify graph snapshot
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: graphC.ink }}>
              The committed graph snapshot ({ctx.graphStats.totalNodes} nodes · {ctx.graphStats.totalEdges} edges) was
              built on a different workspace, so none of this PR&apos;s changed files map to graph symbols. In
              production, Graphify runs on the target repo before analysis so every PR&apos;s changed files resolve to
              their call sites and downstream dependencies. Nothing is fabricated here — real blast radius is only
              shown when the graph contains the files.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PRDetailPage() {
  const { number } = useParams<{ number: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [repo] = useState(() => {
    try { return searchParams.get('repo') ?? readRepo() ?? ''; } catch { return ''; }
  });
  const [token, setToken] = useState<string | null>(null);
  const [pr, setPr] = useState<GithubPRDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [graphCtx, setGraphCtx] = useState<GraphifyContextResponse | null>(null);

  useEffect(() => {
    // Decrypt the token from sessionStorage (async) once on mount.
    const t = setTimeout(() => {
      readToken()
        .then((tok) => setToken(tok))
        .catch(() => setToken(''));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const fetchDetail = useCallback(async (tok: string, r: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/github/prs/${number}?token=${encodeURIComponent(tok)}&repo=${encodeURIComponent(r)}`,
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? json?.detail ?? `GitHub API ${res.status}`);
      }
      setPr(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PR');
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => {
    if (token === null) return; // still decrypting
    if (!repo || !token) { router.push('/connect'); return; }
    const t = setTimeout(() => { fetchDetail(token, repo); }, 0);
    return () => clearTimeout(t);
  }, [router, repo, token, fetchDetail]);

  // Fetch the Graphify subgraph for this PR's changed files once it loads.
  useEffect(() => {
    if (!pr) return;
    const files = pr.files.map(f => f.filename).join(',');
    const t = setTimeout(() => {
      fetch(`/api/graphify?files=${encodeURIComponent(files)}`)
        .then(r => r.json())
        .then((data: GraphifyContextResponse) => setGraphCtx(data))
        .catch(() => setGraphCtx(null));
    }, 0);
    return () => clearTimeout(t);
  }, [pr]);

  // Store context in sessionStorage so /investigation can read it
  function handleAnalyze() {
    if (!pr) return;

    const context = {
      id: `gh-${repo}-${pr.number}`,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      branch: pr.branch,
      baseBranch: pr.baseBranch,
      repo,
      description: pr.body ?? '',
      filesChanged: pr.files.map((f) => ({
        path: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        diff: f.patch ?? '',
      })),
      createdAt: pr.createdAt,
    };

    try {
      sessionStorage.setItem('pr-doctor:pr-context', JSON.stringify(context));
      sessionStorage.removeItem('pr-doctor:investigation');
      router.push('/investigation');
    } catch (error) {
      console.error('SESSION STORAGE ERROR:', error);
    }
  }

  const visibleFiles = pr
    ? (showAll ? pr.files : pr.files.slice(0, 10))
    : [];

  return (
    <Shell maxW={1060}>
      <div style={{ paddingTop: 28 }}>

        {/* Breadcrumb */}
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 16 }}>
          <Link href="/pulls" style={{ color: C.muted, textDecoration: 'none' }}>{repo}</Link>
          <span style={{ color: C.ruleStrong }}>›</span>
          <span style={{ color: C.ink }}>#{number}</span>
        </div>

        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center', ...mono, fontSize: 13, color: C.muted }}>
            Loading PR #{number}…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '24px', ...mono, fontSize: 13, color: C.block }}>{error}</div>
        )}

        {!loading && !error && pr && (
          <>
            {/* ── Header card ─────────────────────────────────────── */}
            <div className="ui-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: 'clamp(18px, 3vw, 24px) clamp(18px, 3vw, 26px) 18px', borderBottom: `1px solid ${C.rule}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' as const }}>
                  <StatusPill state={pr.state} draft={pr.draft} />
                  <Eyebrow>#{pr.number}</Eyebrow>
                  {pr.labels.map(l => (
                    <span key={l} className="mono" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: C.plex, background: C.plexWash, borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}>
                      {l}
                    </span>
                  ))}
                </div>
                <h1 className="display" style={{ fontSize: 'clamp(20px, 3vw, 28px)', margin: '0 0 12px', lineHeight: 1.15, color: C.ink }}>
                  {pr.title}
                </h1>
                <div style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap' as const, ...mono, fontSize: 12, color: C.muted }}>
                  <span>by <strong style={{ color: C.ink }}>{pr.author}</strong></span>
                  <span>{pr.branch} → {pr.baseBranch}</span>
                  <span>opened {relativeTime(pr.createdAt)}</span>
                  <span>updated {relativeTime(pr.updatedAt)}</span>
                  {pr.reviewComments > 0 && <span>{pr.reviewComments} review comment{pr.reviewComments !== 1 ? 's' : ''}</span>}
                  <span>{pr.commits} commit{pr.commits !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ padding: '12px 26px', display: 'flex', gap: 24, flexWrap: 'wrap' as const, alignItems: 'center', borderBottom: `1px solid ${C.rule}`, background: '#FAFBFC' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <span className="mono" style={{ fontSize: 13, color: C.clear }}>+{pr.additions} additions</span>
                  <span className="mono" style={{ fontSize: 13, color: C.block }}>−{pr.deletions} deletions</span>
                  <span className="mono" style={{ fontSize: 13, color: C.muted }}>{pr.changedFiles} file{pr.changedFiles !== 1 ? 's' : ''} changed</span>
                </div>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono"
                  style={{ fontSize: 12, color: C.plex, textDecoration: 'none', marginLeft: 'auto', letterSpacing: '0.04em' }}
                >
                  View on GitHub ↗
                </a>
              </div>

              {/* Description */}
              {pr.body && (
                <div style={{ padding: '16px 26px', borderBottom: `1px solid ${C.rule}` }}>
                  <Eyebrow style={{ marginBottom: 8 }}>Description</Eyebrow>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: C.ink, whiteSpace: 'pre-wrap' as const, maxHeight: 240, overflow: 'hidden' }}>
                    {pr.body}
                  </div>
                </div>
              )}

              {/* Analyze CTA */}
              <div style={{ padding: '18px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12, background: 'var(--plex-wash)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Run PR Doctor analysis</div>
                  <div style={{ fontSize: 13, color: C.muted }}>
                    Four IBM BOB 2.0 agents investigate this PR in parallel and return a BLOCK / NEEDS_WORK / MERGE verdict.
                  </div>
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  className="btn-hover"
                  style={{
                    background: C.ink,
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: 'var(--radius-sm)',
                    ...mono,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap' as const,
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  Analyze this PR →
                </button>
              </div>
            </div>

            {/* ── Changed files ────────────────────────────────────── */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Eyebrow>Changed files ({pr.changedFiles})</Eyebrow>
                {pr.files.length > 10 && (
                  <button
                    onClick={() => setShowAll(s => !s)}
                    className="mono"
                    style={{ fontSize: 11, color: C.plex, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
                  >
                    {showAll ? 'Show fewer' : `Show all ${pr.files.length} files`}
                  </button>
                )}
              </div>
              <div>
                {visibleFiles.map(f => (
                  <FileCard key={f.filename} file={f} />
                ))}
              </div>
              {!showAll && pr.files.length > 10 && (
                <div style={{ marginTop: 8, ...mono, fontSize: 12, color: C.muted }}>
                  Showing 10 of {pr.files.length} files.{' '}
                  <button onClick={() => setShowAll(true)} className="mono" style={{ fontSize: 12, color: C.plex, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Show all
                  </button>
                </div>
              )}
            </div>

            {/* Graphify blast-radius panel (only after context loads) */}
            <div style={{ marginBottom: 80 }}>
              {graphCtx && <GraphifyBlastPanel ctx={graphCtx} repo={repo} />}
            </div>
          </>
        )}

      </div>
    </Shell>
  );
}
