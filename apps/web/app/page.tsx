import Link from 'next/link';
import type { FinalVerdict } from '@/lib/types';
import fixtureRaw from '@/fixtures/demo-pr.json';
import { Shell, SectionHeading } from '@/app/components/ui';

const fixture = fixtureRaw as unknown as FinalVerdict;

const AGENTS = [
  {
    id: 'code-analyst',
    name: 'Code Analyst',
    mode: 'Code',
    job: 'Reads the diff line-by-line, maps every call site that inherits the change, and checks whether the PR description is supported by the code.',
    output: 'Per-line findings with exact file:line locations.',
  },
  {
    id: 'test-security',
    name: 'Test & Security',
    mode: 'Advanced',
    job: 'Traces reachability through the dependency graph, checks authorization paths, and verifies test coverage on every changed function.',
    output: 'Severity-ranked security findings, coverage gaps.',
  },
  {
    id: 'docs-compliance',
    name: 'Documentation & Compliance',
    mode: 'Ask',
    job: 'Compares code behavior against documentation, changelogs, and stated policies to find contradictions.',
    output: 'Documentation drift findings and process gaps.',
  },
  {
    id: 'orchestrator',
    name: 'PR Orchestrator',
    mode: 'Orchestrator',
    job: 'Weights findings from all three specialists, resolves disagreements with explicit reasoning, and issues the final verdict.',
    output: 'MERGE / NEEDS_WORK / BLOCK with a traceable rationale.',
  },
] as const;

const STEPS = [
  {
    n: '01',
    label: 'GitHub PR',
    desc: 'Paste a PR URL. PR Doctor fetches the diff, file tree, and description.',
  },
  {
    n: '02',
    label: 'Graphify maps blast radius',
    desc: 'IBM Graphify traces every call site and dependency that the change reaches.',
  },
  {
    n: '03',
    label: 'BOB specialists investigate',
    desc: 'Three IBM BOB 2.0 agents run in parallel: Code Analyst, Test & Security, Documentation & Compliance.',
  },
  {
    n: '04',
    label: 'Orchestrator decides',
    desc: 'The Orchestrator weighs all findings, records disagreements, and issues a verdict with a full evidence chain.',
  },
] as const;

const confidencePct = `${Math.round(fixture.confidence * 100)}%`;
const totalFindings = fixture.reports.reduce((s, r) => s + r.findings.length, 0);

function severityColor(sev: string): string {
  if (sev === 'critical' || sev === 'high') return 'var(--block)';
  if (sev === 'medium') return 'var(--caution)';
  return 'var(--muted)';
}

function severityWash(sev: string): string {
  if (sev === 'critical' || sev === 'high') return 'var(--block-wash)';
  if (sev === 'medium') return 'var(--caution-wash)';
  return 'var(--plex-wash)';
}

/* Terminal-style command demo block — the visual anchor of the hero */
function TerminalCard() {
  return (
    <div className="ui-card" style={{ overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
      {/* Terminal title bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--rule)', background: '#FAFBFC' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2B15C' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E5A3A3' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#A9C7A9' }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 8 }}>pr-doctor — review</span>
      </div>
      {/* Terminal body */}
      <div className="mono" style={{ padding: '18px 20px', fontSize: 12.5, lineHeight: 1.7, background: '#101418', color: '#D7DDE3' }}>
        <div><span style={{ color: '#7C8894' }}>$</span> pr-doctor analyze acme/ledger-api#4821</div>
        <div style={{ marginTop: 8, color: '#9CDCFF' }}>▸ Graphify · mapping blast radius… <span style={{ color: '#5FCF83' }}>✓</span></div>
        <div style={{ color: '#9CDCFF' }}>▸ Code Analyst · reviewing diff <span style={{ color: '#5FCF83' }}>✓</span></div>
        <div style={{ color: '#9CDCFF' }}>▸ Test &amp; Security · tracing reachability <span style={{ color: '#5FCF83' }}>✓</span></div>
        <div style={{ color: '#9CDCFF' }}>▸ Docs &amp; Compliance <span style={{ color: '#5FCF83' }}>✓</span></div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #232A31' }}>
          <div>verdict  <span style={{ color: '#F38BA0', fontWeight: 600 }}>BLOCK</span>  <span style={{ color: '#7C8894' }}>· 91% confidence</span></div>
          <div style={{ color: '#7C8894' }}>8 findings · 3 files reached · 1 trust boundary without tests</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Shell>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(56px, 8vw, 96px) 0 clamp(40px, 6vw, 64px)' }}>
        <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 'clamp(36px, 5vw, 64px)', alignItems: 'center' }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--plex)', marginBottom: 18 }}>
              IBM TechXchange 2026 · AI-powered code review
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(34px, 5.2vw, 56px)', lineHeight: 1.04, color: 'var(--ink)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
              Know why a pull request is dangerous — before you merge.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--muted)', maxWidth: '44ch', margin: '0 0 32px' }}>
              Four IBM BOB 2.0 specialists investigate every PR in parallel and show you the exact
              line, the exact evidence, and the exact fix.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/investigation" className="btn-hover" style={{ display: 'inline-flex', alignItems: 'center', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--ink)', padding: '13px 26px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', boxShadow: 'var(--shadow-md)' }}>
                Analyze a Pull Request
              </a>
              <a href="/connect" className="btn-hover" style={{ display: 'inline-flex', alignItems: 'center', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'transparent', padding: '13px 26px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', border: '1px solid var(--rule-strong)' }}>
                Connect GitHub
              </a>
            </div>
            <div className="mono" style={{ marginTop: 28, fontSize: 12, color: 'var(--faint)' }}>
              Open source · runs on-device · evidence-backed, not guessed
            </div>
          </div>

          <TerminalCard />
        </div>
      </section>

      {/* ── Verdict preview ──────────────────────────────────────────── */}
      <section style={{ marginTop: 8 }}>
        <SectionHeading
          eyebrow={`Demo · ${fixture.context.repo} · PR #${fixture.context.number}`}
          title="A real verdict, end to end"
          sub="The Orchestrator weighs every finding and stamps a traceable decision — separating hard evidence from inference at every step."
        />

        <div className="ui-card" style={{ overflow: 'hidden' }}>
          {/* triage tag */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 24,
            alignItems: 'center',
            padding: 'clamp(20px, 3vw, 28px)',
            borderLeft: '6px solid var(--block)',
            background: `linear-gradient(90deg, ${severityWash(fixture.reports[0]?.findings[0]?.severity ?? 'high')}, transparent 55%)`,
          }} className="stack-sm">
            <div className="display" style={{
              fontSize: 'clamp(38px, 5.5vw, 56px)', lineHeight: 0.95, color: 'var(--block)',
              border: '2px solid var(--block)', padding: '6px 16px 10px', borderRadius: 'var(--radius-sm)',
              transform: 'rotate(-1.5deg)', justifySelf: 'center',
            }}>
              {fixture.decision}
            </div>
            <div>
              <div className="eyebrow" style={{ color: 'var(--plex)', marginBottom: 8 }}>Orchestrator verdict · {confidencePct} confidence</div>
              <div style={{ fontSize: 15, maxWidth: '54ch', lineHeight: 1.6 }}>{fixture.rationale}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--rule)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>{fixture.context.title}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--plex)', background: 'var(--plex-wash)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>{totalFindings} findings</span>
              </div>
            </div>
          </div>

          {/* top findings */}
          <div style={{ borderTop: '1px solid var(--rule)', padding: '8px 28px 16px' }}>
            <div className="eyebrow" style={{ color: 'var(--muted)', margin: '16px 0 6px' }}>Top findings</div>
            {fixture.reports.flatMap(r => r.findings).slice(0, 3).map((f, idx) => (
              <div key={f.id} style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 16,
                alignItems: 'center',
                padding: '14px 0',
                borderTop: idx > 0 ? '1px solid var(--rule)' : undefined,
              }}>
                <span className="mono" style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: severityColor(f.severity), background: severityWash(f.severity),
                  border: `1px solid ${severityColor(f.severity)}`, padding: '4px 9px', borderRadius: 'var(--radius-sm)',
                }}>
                  {f.severity}
                </span>
                <div>
                  <div style={{ fontWeight: 500 }}>{f.title}</div>
                  <div className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{f.file}:{f.line}</div>
                </div>
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--plex)', background: 'var(--plex-wash)', padding: '4px 9px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                  {fixture.reports.find(r => r.findings.some(ff => ff.id === f.id))?.displayName}
                </span>
              </div>
            ))}
            <Link href="/investigation" style={{ display: 'inline-block', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: 'var(--plex)', textDecoration: 'none', letterSpacing: '0.06em', marginTop: 6 }}>
              Run live investigation →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────── */}
      <section style={{ marginTop: 32 }}>
        <div className="ui-card" style={{ display: 'flex', gap: '24px 48px', flexWrap: 'wrap', alignItems: 'center', padding: '20px 28px', justifyContent: 'center' }}>
          {['IBM BOB 2.0', 'Graphify Context', 'Evidence-Backed', 'GitHub'].map(item => (
            <span key={item} className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Four agent cards ─────────────────────────────────────────── */}
      <section style={{ marginTop: 64 }}>
        <SectionHeading
          eyebrow="Specialists"
          title="Four roles, one accountable verdict"
          sub="Three specialists investigate in parallel; the Orchestrator weighs their findings and decides — with explicit reasoning for every disagreement."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {AGENTS.map(agent => (
            <div key={agent.id} className="ui-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'transform .14s ease, box-shadow .14s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--plex)', background: 'var(--plex-wash)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {agent.mode} mode
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--plex)' }} />
              </div>
              <h3 className="display" style={{ fontSize: 19, margin: 0, letterSpacing: '-0.01em' }}>{agent.name}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, margin: 0, flex: 1 }}>{agent.job}</p>
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Output</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{agent.output}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Four-step flow ───────────────────────────────────────────── */}
      <section style={{ marginTop: 64 }}>
        <SectionHeading
          eyebrow="Pipeline"
          title="How an investigation runs"
          sub="From a raw PR to a traceable verdict in four mechanical steps — no guessing, every link documented."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {STEPS.map((step, i) => (
            <div key={step.n} className="ui-card" style={{ padding: '26px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="display" style={{ fontSize: 30, lineHeight: 1, color: 'var(--plex)', opacity: 0.35 }}>{step.n}</span>
                {i < STEPS.length - 1 && <span className="mono" style={{ color: 'var(--faint)', fontSize: 14 }}>→</span>}
              </div>
              <div className="display" style={{ fontSize: 17, margin: '0 0 8px', color: 'var(--ink)' }}>{step.label}</div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 64 }}>
        <div className="ui-card" style={{ padding: 'clamp(28px, 4vw, 44px)', textAlign: 'center', background: 'linear-gradient(135deg, var(--surface), #F1F3F5)' }}>
          <h2 className="display" style={{ fontSize: 'clamp(20px, 3vw, 28px)', margin: '0 0 8px', color: 'var(--ink)' }}>See it run on a real security regression.</h2>
          <p className="mono" style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px' }}>
            {fixture.context.repo} · PR #{fixture.context.number} · {fixture.context.title}
          </p>
          <a href="/investigation" className="btn-hover" style={{ display: 'inline-flex', alignItems: 'center', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--ink)', padding: '13px 30px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', boxShadow: 'var(--shadow-md)' }}>
            Run the demo →
          </a>
        </div>
      </section>
    </Shell>
  );
}
