'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { AgentReport, FinalVerdict, Finding, Severity } from '@/lib/types';
import { Shell, mono } from '@/app/components/ui';
import { ErrorBlock, LoadingBlock, EmptyBlock } from '@/app/components/ui';

const SEV_STYLE: Record<Severity, { color: string; borderColor: string; background: string }> = {
  critical: { color: 'var(--block)', borderColor: 'var(--block)', background: 'var(--block-wash)' },
  high:     { color: 'var(--block)', borderColor: 'var(--block)', background: 'transparent' },
  medium:   { color: 'var(--caution)', borderColor: 'var(--caution)', background: 'transparent' },
  low:      { color: 'var(--muted)', borderColor: 'var(--rule-strong)', background: 'transparent' },
};

function parseDiff(raw: string): { type: 'del' | 'add' | 'ctx'; text: string }[] {
  return raw.split('\n').map(line => {
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'del', text: line };
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add', text: line };
    return { type: 'ctx', text: line };
  });
}

export default function FindingPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [verdict, setVerdict] = useState<FinalVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A real PR investigation passes its job id so we fetch the stored verdict
    // rather than the demo fixture. If none is supplied, fall back to the demo.
    const jobId = searchParams.get('job') ?? 'demo';
    fetch(`/api/verdict/${encodeURIComponent(jobId)}`)
      .then(r => r.json())
      .then(setVerdict)
      .catch(() => setError('Failed to load verdict'));
  }, [searchParams]);

  if (error) {
    return (
      <Shell maxW={1060}>
        <div style={{ paddingTop: 28 }}>
          <ErrorBlock title="Couldn't load this finding" message={error} detail="The verdict for this finding could not be retrieved." />
        </div>
      </Shell>
    );
  }

  if (!verdict) {
    return (
      <Shell maxW={1060}>
        <div style={{ paddingTop: 28 }}>
          <LoadingBlock label="Loading finding…" sub="Fetching the verdict that produced this finding." minHeight={220} />
        </div>
      </Shell>
    );
  }

  // Find the finding and its parent report
  let finding: Finding | undefined;
  let report: AgentReport | undefined;
  for (const r of verdict.reports) {
    const f = r.findings.find(f => f.id === id);
    if (f) { finding = f; report = r; break; }
  }

  if (!finding || !report) {
    return (
      <Shell maxW={1060}>
        <div style={{ paddingTop: 28 }}>
          <EmptyBlock
            label="Finding not found"
            hint={`No finding with id "${id}" exists in this verdict.`}
            actionLabel="Back to investigation"
            actionHref="/investigation"
          />
        </div>
      </Shell>
    );
  }

  const sev = SEV_STYLE[finding.severity];

  // Diff: prefer the file matching finding.file, fallback to first
  const fileChange =
    verdict.context.filesChanged.find(fc => fc.path === finding!.file) ??
    verdict.context.filesChanged[0];

  const diffLines = fileChange ? parseDiff(fileChange.diff) : [];

  return (
    <Shell maxW={1060}>
      {/* Back link */}
      <div style={{ marginBottom: 20, paddingTop: 28 }}>
        <Link href="/investigation" style={{ ...mono, fontSize: 12, color: 'var(--muted)', textDecoration: 'none', letterSpacing: '0.04em' }}>&larr; Investigation</Link>
      </div>

      {/* Triage tag wrapper */}
      <div className="ui-card" style={{ overflow: 'hidden', borderLeft: `8px solid ${sev.borderColor}`, boxShadow: 'var(--shadow-md)' }}>

        {/* Severity + title */}
        <div style={{ padding: 'clamp(18px, 3vw, 24px) clamp(18px, 3vw, 26px)', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <span className="mono" style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '4px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid', color: sev.color, borderColor: sev.borderColor,
              background: sev.background, whiteSpace: 'nowrap',
            }}>
              {finding.severity}
            </span>
            <h1 className="display" style={{ fontSize: 'clamp(19px, 2.6vw, 24px)', margin: 0, lineHeight: 1.2 }}>{finding.title}</h1>
          </div>

          {/* file:line + agent badge */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{finding.file}:{finding.line}</span>
            <span className="mono" style={{
              fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--plex)', background: 'var(--plex-wash)',
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
            }}>
              Reported by {report.displayName} · BOB {report.mode} mode
            </span>
          </div>
        </div>

        {/* OBSERVED / CONCLUDED split */}
        <div style={{ padding: 'clamp(18px, 3vw, 24px) clamp(18px, 3vw, 26px)', borderBottom: '1px solid var(--rule)' }}>
          <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* Observed */}
            <div style={{ padding: '18px 20px', background: '#FAFBFC' }}>
              <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 9 }}>Observed</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>{finding.evidence}</p>
            </div>

            {/* Gutter */}
            <div style={{ background: 'var(--rule-strong)' }} />

            {/* Concluded */}
            <div style={{ padding: '18px 20px' }}>
              <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--plex)', marginBottom: 9 }}>Concluded</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>{finding.inference}</p>
            </div>
          </div>
        </div>

        {/* Diff */}
        {diffLines.length > 0 && (
          <div style={{ padding: '0 clamp(18px, 3vw, 26px) 22px', borderBottom: '1px solid var(--rule)' }}>
            <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '18px 0 8px' }}>
              {fileChange.path}
            </div>
            <div className="mono" style={{
              background: '#F6F8F9', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)',
              padding: '14px 16px', fontSize: 12.5, lineHeight: 1.65, overflowX: 'auto', whiteSpace: 'pre',
            }}>
              {diffLines.map((line, i) => {
                const s: React.CSSProperties =
                  line.type === 'del'
                    ? { background: 'var(--block-wash)', color: 'var(--block)', display: 'block' }
                    : line.type === 'add'
                    ? { background: 'var(--clear-wash)', color: 'var(--clear)', display: 'block' }
                    : { color: 'var(--muted)', display: 'block' };
                return <span key={i} style={s}>{line.text}</span>;
              })}
            </div>
          </div>
        )}

        {/* Reaches */}
        {finding.reaches.length > 0 && (
          <div style={{ padding: '16px clamp(18px, 3vw, 26px)', borderBottom: '1px solid var(--rule)' }}>
            <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
              This finding propagates to
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {finding.reaches.map(path => (
                <span key={path} className="mono" style={{
                  fontSize: 12.5, color: 'var(--ink)', background: '#F6F8F9',
                  border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px', display: 'inline-block', alignSelf: 'start',
                }}>
                  {path}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Remediation */}
        <div style={{ padding: '16px clamp(18px, 3vw, 26px) 22px' }}>
          <div style={{ borderLeft: '4px solid var(--clear)', background: 'var(--clear-wash)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
            <span className="mono" style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--clear)', display: 'block', marginBottom: 5,
            }}>
              Remediation
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.6 }}>{finding.remediation}</span>
          </div>
        </div>

      </div>

      {/* Confidence note */}
      <div className="mono" style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', marginBottom: 80 }}>
        Finding confidence: {Math.round(finding.confidence * 100)}% — not evidence, only a hint about how hard to look.
      </div>
    </Shell>
  );
}
