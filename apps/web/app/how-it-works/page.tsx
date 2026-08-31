import Link from 'next/link';
import { Shell, mono, display } from '@/app/components/ui';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function SectionHeader({ step, title, sub }: { step: string; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 6 }}>
        <span className="display" style={{ fontSize: 40, lineHeight: 1, color: 'var(--plex-bright)', opacity: 0.28 }}>{step}</span>
        <h2 style={{ ...display, fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.12, color: 'var(--ink)', margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 15, color: 'var(--muted)', margin: '4px 0 0', maxWidth: '64ch', lineHeight: 1.6 }}>{sub}</p>
    </div>
  );
}

function Panel({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="ui-card" style={{ padding: 'clamp(18px, 3vw, 28px)', marginBottom: 20 }}>
      {label && <Eyebrow>{label}</Eyebrow>}
      {children}
    </div>
  );
}

function StatGrid({ stats }: { stats: { n: string; label: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
      {stats.map(s => (
        <div key={s.label} className="ui-card" style={{ padding: '18px 18px' }}>
          <div className="display" style={{ fontSize: 30, lineHeight: 1, color: 'var(--plex-bright)', marginBottom: 4 }}>{s.n}</div>
          <div style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Step 1 diagram: PR ingestion pipeline ──────────────────────────────────── */
function IngestionDiagram() {
  const boxes = [
    { label: 'GitHub PR', sub: '#4821 · acme/ledger-api', fill: 'var(--plex-wash)', stroke: 'var(--plex)', textColor: 'var(--plex)' },
    { label: 'Integration Service', sub: 'PyGithub · _parse_files()', fill: 'var(--surface)', stroke: 'var(--rule-strong)', textColor: 'var(--ink)' },
    { label: 'PRRecord', sub: 'FileDiff · RiskHeuristic · overall_risk', fill: 'var(--surface)', stroke: 'var(--rule-strong)', textColor: 'var(--ink)' },
    { label: 'PR Doctor', sub: 'BOB agents receive context', fill: 'var(--plex-wash)', stroke: 'var(--plex)', textColor: 'var(--plex)' },
  ];
  const W = 800, H = 120, BW = 156, BH = 56, gap = (W - BW * 4) / 5;
  const stroke = 'var(--rule-strong)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="PR ingestion pipeline">
      {boxes.map((b, i) => {
        const x = gap + i * (BW + gap);
        const cy = H / 2;
        const rect = (
          <rect x={x} y={cy - BH / 2} width={BW} height={BH} fill={b.fill} stroke={b.stroke} strokeWidth="1.5" rx="6" />
        );
        if (i < boxes.length - 1) {
          return (
            <g key={i}>
              {rect}
              <line x1={x + BW + 4} y1={cy} x2={x + BW + gap - 8} y2={cy} stroke={stroke} strokeWidth="1.5" markerEnd="url(#arr)" />
              <text x={x + BW / 2} y={cy - 6} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="600" fill={b.textColor}>{b.label}</text>
              <text x={x + BW / 2} y={cy + 11} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--muted)">{b.sub}</text>
            </g>
          );
        }
        return (
          <g key={i}>
            {rect}
            <text x={x + BW / 2} y={cy - 6} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="600" fill={b.textColor}>{b.label}</text>
            <text x={x + BW / 2} y={cy + 11} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--muted)">{b.sub}</text>
          </g>
        );
      })}
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={stroke} />
        </marker>
      </defs>
    </svg>
  );
}

/* ── Step 2 diagram: Graphify graph ─────────────────────────────────────────── */
function GraphifyDiagram() {
  const W = 800, H = 260;
  const hub = { id: 'hub', x: 160, y: 130, label: 'ingest_pr()', sub: '13 edges', fill: 'var(--block-wash)', stroke: 'var(--block)', sw: 2 };
  const ring1 = [
    { id: 'r1a', x: 340, y: 50,  label: 'PRRecord',     sub: '16 edges', fill: 'var(--plex-wash)', stroke: 'var(--plex)' },
    { id: 'r1b', x: 360, y: 130, label: '_parse_files()', sub: 'called by', fill: 'var(--surface)', stroke: 'var(--rule-strong)' },
    { id: 'r1c', x: 340, y: 210, label: 'Settings',     sub: '14 edges', fill: 'var(--plex-wash)', stroke: 'var(--plex)' },
  ];
  const ring2 = [
    { id: 'r2a', x: 530, y: 50,  label: 'FileDiff',      sub: 'model', fill: 'var(--surface)', stroke: 'var(--rule-strong)' },
    { id: 'r2b', x: 560, y: 130, label: 'upsert_pr()',   sub: '12 edges', fill: 'var(--surface)', stroke: 'var(--rule-strong)' },
    { id: 'r2c', x: 530, y: 210, label: 'get_settings()', sub: '9 edges', fill: 'var(--surface)', stroke: 'var(--rule-strong)' },
    { id: 'r2d', x: 690, y: 90,  label: 'list_prs()',    sub: 'storage', fill: 'var(--surface)', stroke: 'var(--rule-strong)' },
    { id: 'r2e', x: 690, y: 170, label: 'RiskLevel',     sub: '8 edges', fill: 'var(--surface)', stroke: 'var(--rule-strong)' },
  ];
  const edges1 = ring1.map(n => ({ from: hub, to: n }));
  const edges2 = [
    { from: ring1[0], to: ring2[0] },
    { from: ring1[1], to: ring2[1] },
    { from: ring1[2], to: ring2[2] },
    { from: ring2[1], to: ring2[3] },
    { from: ring2[2], to: ring2[4] },
  ];
  const allNodes = [hub, ...ring1, ...ring2];
  const stroke = 'var(--rule-strong)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Graphify dependency graph">
      <defs>
        <marker id="arr2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={stroke} />
        </marker>
      </defs>
      {[...edges1, ...edges2].map((e, i) => (
        <line key={i}
          x1={e.from.x + 58} y1={e.from.y + 19}
          x2={e.to.x}        y2={e.to.y + 19}
          stroke={stroke} strokeWidth="1.2" markerEnd="url(#arr2)" />
      ))}
      {allNodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={116} height={38}
            fill={n.fill} stroke={n.stroke}
            strokeWidth={n.id === 'hub' ? 2 : 1.2} rx="5" />
          <text x={n.x + 58} y={n.y + 14} textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace" fontSize="10"
            fontWeight={n.id === 'hub' ? '600' : '400'}
            fill={n.id === 'hub' ? 'var(--block)' : 'var(--ink)'}>{n.label}</text>
          <text x={n.x + 58} y={n.y + 28} textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace" fontSize="8.5" fill="var(--muted)">{n.sub}</text>
        </g>
      ))}
      <rect x={8} y={8} width={150} height={22} fill="var(--plex-wash)" stroke="var(--plex)" strokeWidth="1" rx="4" />
      <text x={83} y={22} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fontWeight="600" fill="var(--plex)">PR INGESTION PIPELINE</text>
    </svg>
  );
}

/* ── Step 3 diagram: Parallel agent lanes ──────────────────────────────────── */
function AgentLanesDiagram() {
  const W = 800, H = 200;
  const agents = [
    { name: 'Code Analyst',              mode: 'Code',         start: 40,  end: 352, color: 'var(--plex-bright)',  findings: 3 },
    { name: 'Test & Security',           mode: 'Advanced',     start: 40,  end: 527, color: 'var(--block)', findings: 3 },
    { name: 'Documentation & Compliance',mode: 'Ask',          start: 40,  end: 274, color: 'var(--caution)',findings: 2 },
  ];
  const trackW = 520, trackX = 220, rowH = 52, startY = 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Parallel agent investigation lanes">
      {agents.map((a, i) => {
        const y = startY + i * rowH;
        const barW = Math.round((a.end / 660) * trackW);
        return (
          <g key={i}>
            <text x={0} y={y + 13} fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="600" fill="var(--ink)">{a.name}</text>
            <text x={0} y={y + 27} fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--plex)" letterSpacing="0.06em">{a.mode.toUpperCase()}</text>
            <rect x={trackX} y={y + 2} width={trackW} height={18} fill="var(--ground)" stroke="var(--rule)" strokeWidth="1" rx="4" />
            <rect x={trackX} y={y + 2} width={barW} height={18} fill={a.color} opacity="0.85" rx="4" />
            <text x={trackX + trackW + 10} y={y + 15} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="var(--muted)">{(a.end / 1000).toFixed(1)}s</text>
            <text x={trackX + trackW + 52} y={y + 15} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill={a.color} fontWeight="600">{a.findings} findings</text>
          </g>
        );
      })}
      {(() => {
        const y = startY + 3 * rowH + 8;
        return (
          <g>
            <line x1={trackX} y1={y - 4} x2={trackX + trackW + 100} y2={y - 4} stroke="var(--rule)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={0} y={y + 13} fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="600" fill="var(--ink)">PR Orchestrator</text>
            <text x={0} y={y + 27} fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--plex)" letterSpacing="0.06em">ORCHESTRATOR</text>
            <rect x={trackX} y={y + 2} width={Math.round((1330 / 6600) * trackW)} height={18} fill="var(--ground)" stroke="var(--rule)" strokeWidth="1" rx="4" />
            <rect x={trackX + Math.round((5270 / 6600) * trackW)} y={y + 2} width={Math.round((1330 / 6600) * trackW)} height={18} fill="var(--ink)" opacity="0.85" rx="4" />
            <text x={trackX + trackW + 10} y={y + 15} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="var(--muted)">1.3s</text>
            <text x={trackX + trackW + 52} y={y + 15} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="var(--ink)" fontWeight="600">BLOCK</text>
          </g>
        );
      })()}
    </svg>
  );
}

/* ── Step 4 diagram: Evidence / Inference split ─────────────────────────────── */
function EvidenceSplitDiagram() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}>
      <div style={{ padding: '18px 20px', background: '#FAFBFC' }}>
        <div style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 10 }}>Observed</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink)' }}>
          Line 42 changed from{' '}
          <code style={{ ...mono, fontSize: 12, background: '#F6F8F9', border: '1px solid var(--rule)', padding: '1px 4px', borderRadius: 4 }}>return user.role === &apos;admin&apos; &amp;&amp; user.verified;</code>{' '}
          to{' '}
          <code style={{ ...mono, fontSize: 12, background: 'var(--block-wash)', border: '1px solid var(--block)', padding: '1px 4px', color: 'var(--block)', borderRadius: 4 }}>return user.role === &apos;admin&apos;;</code>
          . No compensating check was added elsewhere in the diff.
        </p>
        <div style={{ marginTop: 14, ...mono, fontSize: 10, color: 'var(--muted)' }}>Source: unified diff · line 42 · quotable verbatim</div>
      </div>
      <div style={{ background: 'var(--rule-strong)' }} />
      <div style={{ padding: '18px 20px' }}>
        <div style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--plex)', marginBottom: 10 }}>Concluded</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink)' }}>
          <code style={{ ...mono, fontSize: 12, background: '#F6F8F9', border: '1px solid var(--rule)', padding: '1px 4px', borderRadius: 4 }}>canAdminister()</code>{' '}
          now returns <code style={{ ...mono, fontSize: 12 }}>true</code> for accounts holding the admin role
          that have not completed verification. Since this function is the only gate used by administrative
          call sites, verification is no longer enforced anywhere on that path.
        </p>
        <div style={{ marginTop: 14, ...mono, fontSize: 10, color: 'var(--muted)' }}>Agent inference · explicitly defeasible · not a quote</div>
      </div>
    </div>
  );
}

/* ── Step 5 diagram: blast radius mini graph ────────────────────────────────── */
function BlastMiniDiagram() {
  const W = 720, H = 200;
  const BW = 150, BH = 42;
  const changed = { x: 20, y: 80, label: 'auth.ts', sub: 'changed · line 42', fill: 'var(--block-wash)', stroke: 'var(--block)', sw: 2 };
  const nodes = [
    { x: 260, y: 20,  label: 'billing/refund.ts', sub: 'no coverage · moves money', fill: 'var(--block-wash)', stroke: 'var(--block)', sw: 2, dash: '5 3' },
    { x: 260, y: 80,  label: 'session.ts',         sub: 'step-up flag',              fill: 'var(--surface)', stroke: 'var(--rule-strong)', sw: 1.5, dash: '' },
    { x: 260, y: 140, label: 'admin/users',         sub: 'tested',                   fill: 'var(--surface)', stroke: 'var(--rule-strong)', sw: 1.5, dash: '' },
    { x: 500, y: 80,  label: 'admin/layout.tsx',   sub: 'distance 2',               fill: 'var(--surface)', stroke: 'var(--rule)', sw: 1, dash: '3 3' },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Blast radius dependency graph">
      {nodes.slice(0, 3).map((n, i) => (
        <line key={i}
          x1={changed.x + BW} y1={changed.y + BH / 2}
          x2={n.x}            y2={n.y + BH / 2}
          stroke="var(--rule-strong)" strokeWidth="1.5" />
      ))}
      <line x1={nodes[1].x + BW} y1={nodes[1].y + BH / 2}
            x2={nodes[3].x}      y2={nodes[3].y + BH / 2}
            stroke="var(--rule-strong)" strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x={changed.x} y={changed.y} width={BW} height={BH} fill={changed.fill} stroke={changed.stroke} strokeWidth={changed.sw} rx="6" />
      <text x={changed.x + BW / 2} y={changed.y + 15} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="600" fill="var(--block)">{changed.label}</text>
      <text x={changed.x + BW / 2} y={changed.y + 30} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--block)">{changed.sub}</text>
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width={BW} height={BH} fill={n.fill} stroke={n.stroke} strokeWidth={n.sw} strokeDasharray={n.dash || undefined} rx="6" />
          <text x={n.x + BW / 2} y={n.y + 15} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill={n.stroke === 'var(--block)' ? 'var(--block)' : 'var(--ink)'}>{n.label}</text>
          <text x={n.x + BW / 2} y={n.y + 30} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--muted)">{n.sub}</text>
        </g>
      ))}
      <text x="0" y={H - 4} fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--muted)">4 files reached · 1 trust boundary without coverage · graph confidence 89%</text>
    </svg>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────────── */
export default function HowItWorksPage() {
  const changedBorder = (covered: boolean) => covered ? '1px solid var(--rule-strong)' : '1px solid var(--block)';
  return (
    <Shell>
      {/* Hero */}
      <section style={{ padding: 'clamp(52px, 8vw, 80px) 0 clamp(32px, 5vw, 48px)' }}>
        <div className="eyebrow" style={{ color: 'var(--plex)', marginBottom: 16 }}>Technical walkthrough</div>
        <h1 className="display" style={{ fontSize: 'clamp(30px, 5vw, 52px)', lineHeight: 1.05, color: 'var(--ink)', margin: '0 0 18px', maxWidth: '20ch', letterSpacing: '-0.02em' }}>
          How PR Doctor works, from diff to verdict.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--muted)', maxWidth: '62ch', margin: 0 }}>
          Five stages. Four IBM BOB 2.0 agents. One Graphify context graph. Every finding
          separates what was observed from what was concluded — those two things never merge.
        </p>
      </section>

      {/* Stage index strip */}
      <section className="ui-card" style={{ display: 'flex', overflowX: 'auto', borderTop: 'none' }}>
        {[
          ['01', 'Ingestion'], ['02', 'Graphify'], ['03', 'Parallel agents'],
          ['04', 'Evidence split'], ['05', 'Blast radius'], ['06', 'Orchestrator'],
        ].map(([n, label]) => (
          <div key={n} style={{ padding: '15px 22px', borderRight: '1px solid var(--rule)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--faint)', marginRight: 8 }}>{n}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </section>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '16px 0 80px' }}>

        {/* ── Stage 01: Ingestion ── */}
        <section style={{ marginTop: 48, paddingBottom: 48, borderBottom: '1px solid var(--rule)' }}>
          <SectionHeader
            step="01"
            title="PR Ingestion"
            sub="The Integration Service fetches the PR from GitHub, parses every file diff into a typed PRRecord, and runs a set of heuristic risk checks before the agents ever see the data."
          />
          <Panel label="Pipeline — GitHub → Integration Service → PRRecord → Agents">
            <IngestionDiagram />
          </Panel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              { label: 'FileDiff', desc: 'filename · status (added/modified/removed) · additions · deletions · raw unified diff patch' },
              { label: 'RiskHeuristic', desc: 'rule · description · level · file · line — detects secrets, large diffs, test deletion, config changes' },
              { label: 'PRRecord', desc: 'id · repo · title · author · base/head branch · files[] · risk_heuristics[] · overall_risk' },
            ].map(item => (
              <div key={item.label} className="ui-card" style={{ padding: '16px 18px' }}>
                <code className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--plex)', display: 'block', marginBottom: 6 }}>{item.label}</code>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stage 02: Graphify ── */}
        <section style={{ marginTop: 48, paddingBottom: 48, borderBottom: '1px solid var(--rule)' }}>
          <SectionHeader
            step="02"
            title="Graphify builds the dependency graph"
            sub="IBM Graphify analyses the codebase statically — AST extraction plus semantic inference — and produces a graph. Before any agent runs, PR Doctor queries this graph for every changed file and injects the 1-hop neighbour subgraph into the agent prompt."
          />
          <Panel label="Dependency graph — 111 nodes · 217 edges · 13 communities · 89% extracted">
            <GraphifyDiagram />
          </Panel>
          <StatGrid stats={[
            { n: '111', label: 'Nodes' }, { n: '217', label: 'Edges' },
            { n: '13', label: 'Communities' }, { n: '89%', label: 'AST-extracted' },
            { n: '23', label: 'Inferred edges' }, { n: '0.94', label: 'Avg confidence' },
          ]} />
          <div style={{ background: 'var(--plex-wash)', border: '1px solid var(--rule-strong)', borderLeft: '4px solid var(--plex)', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--plex)', marginBottom: 8 }}>
              Why the graph matters — the key differentiator
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
              Without Graphify, an agent reviewing a 2-line diff would only know about those 2 lines.
              With the graph, it knows that <code className="mono" style={{ fontSize: 12, background: '#F6F8F9', border: '1px solid var(--rule)', padding: '1px 4px', borderRadius: 4 }}>canAdminister()</code> is called by{' '}
              <code className="mono" style={{ fontSize: 12, background: 'var(--block-wash)', border: '1px solid var(--block)', padding: '1px 4px', color: 'var(--block)', borderRadius: 4 }}>billing/refund.ts:88</code>,
              which moves money and has zero test coverage. The graph gives the agents pre-computed
              blast radius — they don&apos;t guess, they traverse.
            </p>
          </div>
        </section>

        {/* ── Stage 03: Parallel agents ── */}
        <section style={{ marginTop: 48, paddingBottom: 48, borderBottom: '1px solid var(--rule)' }}>
          <SectionHeader
            step="03"
            title="Three specialists run in parallel"
            sub="Code Analyst, Test & Security, and Documentation & Compliance investigate simultaneously using different IBM BOB 2.0 modes. Each sees the same PRContext and Graphify packet but focuses on a different lens."
          />
          <Panel label="Parallel investigation — 6.6s total · staggered completion">
            <AgentLanesDiagram />
          </Panel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              { name: 'Code Analyst', mode: 'Code', color: 'var(--plex)', wash: 'var(--plex-wash)', desc: 'Reads the diff line by line. Maps call sites. Checks whether the PR description is supported by the code. Finding prefix: CA-' },
              { name: 'Test & Security', mode: 'Advanced', color: 'var(--block)', wash: 'var(--block-wash)', desc: 'Traces reachability through the Graphify graph. Checks authorization paths. Verifies test coverage. Finding prefix: TS-' },
              { name: 'Docs & Compliance', mode: 'Ask', color: 'var(--caution)', wash: 'var(--caution-wash)', desc: 'Compares code behavior against documentation, changelogs, and stated policies to find contradictions. Finding prefix: DC-' },
            ].map(a => (
              <div key={a.name} className="ui-card" style={{ padding: '18px 18px 20px', borderTop: `3px solid ${a.color}` }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: a.color, background: a.wash, padding: '3px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block', marginBottom: 10 }}>
                  {a.mode} mode
                </span>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{a.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stage 04: Evidence split ── */}
        <section style={{ marginTop: 48, paddingBottom: 48, borderBottom: '1px solid var(--rule)' }}>
          <SectionHeader
            step="04"
            title="Every finding separates evidence from inference"
            sub="This is the product thesis. Observed is what is literally in the diff — quotable verbatim. Concluded is what the agent inferred — explicitly defeasible. They are kept in two separate columns and never merged."
          />
          <Panel label="Finding CA-01 — Verification requirement removed from the sole admin gate">
            <EvidenceSplitDiagram />
            <div style={{ marginTop: 20, background: '#F6F8F9', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', padding: '14px 16px', ...mono, fontSize: 12.5, lineHeight: 1.65, overflowX: 'auto', whiteSpace: 'pre' }}>
              <span style={{ color: 'var(--muted)', display: 'block' }}>{'@@ -39,7 +39,7 @@ export function canAdminister(user: User): boolean {'}</span>
              <span style={{ color: 'var(--muted)', display: 'block' }}>{'  if (!user) return false;'}</span>
              <span style={{ color: 'var(--muted)', display: 'block' }}>{'  if (user.suspended) return false;'}</span>
              <span style={{ background: 'var(--block-wash)', color: 'var(--block)', display: 'block' }}>{"- return user.role === 'admin' && user.verified;"}</span>
              <span style={{ background: 'var(--clear-wash)', color: 'var(--clear)', display: 'block' }}>{"+ return user.role === 'admin';"}</span>
              <span style={{ color: 'var(--muted)', display: 'block' }}>{'}'}</span>
            </div>
          </Panel>
          <div style={{ background: 'var(--plex-wash)', border: '1px solid var(--rule-strong)', borderLeft: '4px solid var(--plex)', padding: '14px 20px', borderRadius: 'var(--radius)' }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
              An agent that collapses evidence and inference produces findings that are impossible to
              audit. You can&apos;t tell whether the claim is a direct quote from the diff or a conclusion
              the model drew. Keeping them separate makes every finding falsifiable.
            </p>
          </div>
        </section>

        {/* ── Stage 05: Blast radius ── */}
        <section style={{ marginTop: 48, paddingBottom: 48, borderBottom: '1px solid var(--rule)' }}>
          <SectionHeader
            step="05"
            title="Blast radius — what the change actually reaches"
            sub="Graphify's graph tells PR Doctor which files the change propagates to, whether they have test coverage, and whether they cross a trust boundary. This is shown as a dependency graph, not a list."
          />
          <Panel label="auth.ts change propagates to 4 files · 1 trust boundary without coverage">
            <BlastMiniDiagram />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 14, fontSize: 12.5, color: 'var(--muted)' }}>
              <span><strong style={{ fontWeight: 500, color: 'var(--ink)' }}>Solid red</strong> — changed or reached, no tests</span>
              <span><strong style={{ fontWeight: 500, color: 'var(--ink)' }}>Dashed red</strong> — reached, no tests</span>
              <span><strong style={{ fontWeight: 500, color: 'var(--ink)' }}>Grey</strong> — reached, covered</span>
              <span><strong style={{ fontWeight: 500, color: 'var(--ink)' }}>Dashed grey</strong> — distance 2</span>
            </div>
          </Panel>
          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="mono" style={{ padding: '12px 18px', borderBottom: '1px solid var(--rule)', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Affected nodes
            </div>
            {[
              { path: 'src/api/billing/refund.ts', reason: 'Calls canAdminister() as its only authorization gate before issuing a refund', tests: false, dist: 1, trust: true },
              { path: 'src/lib/session.ts',         reason: 'Derives the step-up authentication flag from canAdminister()',                  tests: true,  dist: 1, trust: true },
              { path: 'src/app/admin/users/route.ts',reason: 'Guards user administration endpoints with canAdminister()',                     tests: true,  dist: 1, trust: false },
              { path: 'src/app/admin/layout.tsx',    reason: 'Renders the admin shell behind a session flag set in session.ts',               tests: false, dist: 2, trust: false },
            ].map((n, i) => (
              <div key={n.path} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--rule)' : undefined, alignItems: 'start' }}>
                <div>
                  <code className="mono" style={{ fontSize: 12.5, color: n.tests ? 'var(--ink)' : 'var(--block)' }}>{n.path}</code>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{n.reason}</div>
                </div>
                <span className="mono" style={{ fontSize: 10, padding: '3px 8px', border: changedBorder(n.tests), color: n.tests ? 'var(--muted)' : 'var(--block)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap', alignSelf: 'start' }}>
                  {n.tests ? 'tested' : 'no tests'}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', alignSelf: 'start' }}>dist {n.dist}</span>
                {n.trust && <span className="mono" style={{ fontSize: 10, color: 'var(--caution)', border: '1px solid var(--caution)', borderRadius: 'var(--radius-sm)', padding: '3px 7px', whiteSpace: 'nowrap', alignSelf: 'start' }}>trust boundary</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Stage 06: Orchestrator ── */}
        <section style={{ marginTop: 48, paddingBottom: 48 }}>
          <SectionHeader
            step="06"
            title="Orchestrator issues the final verdict"
            sub="The PR Orchestrator reads all three specialist reports, resolves disagreements with explicit reasoning, and produces a single verdict — MERGE, NEEDS_WORK, or BLOCK — with a full evidence chain."
          />
          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center', padding: '24px 28px', borderLeft: '8px solid var(--block)', background: 'var(--block-wash)' }}>
              <div className="display" style={{ fontSize: 'clamp(40px, 6vw, 56px)', lineHeight: 0.95, color: 'var(--block)', border: '3px solid var(--block)', padding: '8px 18px 12px', borderRadius: 'var(--radius-sm)', transform: 'rotate(-1.5deg)' }}>
                BLOCK
              </div>
              <div>
                <div className="eyebrow" style={{ color: 'var(--plex)', marginBottom: 8 }}>Orchestrator verdict · IBM BOB 2.0</div>
                <div style={{ fontSize: 14.5, maxWidth: '48ch', lineHeight: 1.6 }}>
                  An unverified account holding the admin role can now reach refund issuance,
                  a money-moving path with no test coverage. Test &amp; Security reproduced the path;
                  Code Analyst confirmed the removed condition is the only gate.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div className="eyebrow">Confidence</div>
                <div className="display" style={{ fontSize: 34, lineHeight: 1, color: 'var(--ink)' }}>91%</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>not evidence</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--caution-wash)', border: '1px solid var(--caution)', borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 20 }}>
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--caution)', marginBottom: 6 }}>Recorded disagreement</div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65 }}>
              Code Analyst rated the removed condition <strong>high</strong> on the basis of the diff alone.
              Test &amp; Security rated it <strong>critical</strong> after tracing it to refund issuance.
              Weighted toward Test &amp; Security: reachability was established from the dependency graph,
              not assumed.
            </p>
          </div>

          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="mono" style={{ padding: '12px 18px', borderBottom: '1px solid var(--rule)', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Driving findings — what caused the BLOCK
            </div>
            {['TS-01 — Unverified admin can issue refunds without a second gate', 'CA-01 — Verification requirement removed from the sole admin gate', 'TS-02 — No remaining test coverage on the changed function'].map((f, i) => (
              <div key={i} style={{ padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--rule)' : undefined, display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--block)', background: 'var(--block-wash)', border: '1px solid var(--block)', borderRadius: 'var(--radius-sm)', padding: '2px 7px', whiteSpace: 'nowrap' }}>
                  {f.split(' — ')[0]}
                </span>
                <span style={{ fontSize: 13.5 }}>{f.split(' — ')[1]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="ui-card" style={{ padding: 'clamp(28px, 4vw, 44px)', textAlign: 'center', background: 'linear-gradient(135deg, var(--surface), #F1F3F5)' }}>
          <div className="display" style={{ fontSize: 'clamp(19px, 2.6vw, 24px)', color: 'var(--ink)', marginBottom: 6 }}>
            See the full pipeline run in real time.
          </div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>acme/ledger-api · PR #4821 · BLOCK at 91% confidence</div>
          <a href="/investigation" className="btn-hover" style={{ display: 'inline-flex', alignItems: 'center', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--ink)', padding: '12px 30px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', boxShadow: 'var(--shadow-md)' }}>
            Run the investigation
          </a>
        </div>

      </div>
      <Link href="/" className="mono" style={{ fontSize: 12, color: 'var(--plex)', textDecoration: 'none' }}>← Home</Link>
    </Shell>
  );
}
