'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphifyContextResponse } from '@/app/api/graphify/route';
import type { Network as VisNetwork } from 'vis-network/standalone';

export const graphC = {
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
  clear: '#157A5B',
  clearWash: '#E9F5F0',
  caution: '#9A6A00',
  cautionWash: '#FBF6E7',
  ground: '#F6F6F5',
};

const COMMUNITY_COLORS = [
  '#4A5568', '#157A5B', '#9A6A00', '#B4232A', '#6B7280',
  '#0E7490', '#9A3412', '#4D7C0F', '#9D174D', '#101418',
];

const mono: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function basename(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1];
}

/**
 * Collapse the symbol-level Graphify context to file-level nodes + edges so the
 * graph stays legible: changed files are the hub nodes, neighbours are the
 * (capped) most-connected dependency files.
 */
export function buildGraphLayout(ctx: GraphifyContextResponse) {
  const cc: Record<string, string> = {};
  const cCommunity: Record<string, string> = {};
  for (const n of ctx.changedNodes) { cc[n.id] = n.file; cCommunity[n.file] = n.community; }
  for (const n of ctx.neighbours) cc[n.id] = n.file;

  const changedFiles: string[] = [];
  const seen = new Set<string>();
  for (const n of ctx.changedNodes) if (!seen.has(n.file)) { seen.add(n.file); changedFiles.push(n.file); }
  const changedSet = new Set(changedFiles);

  const cDegree: Record<string, number> = {};
  const nDegree: Record<string, number> = {};
  const pairEdges = new Map<string, { cf: string; nf: string }>();
  for (const e of ctx.changeEdges) {
    const sf = cc[e.source], tf = cc[e.target];
    if (!sf || !tf) continue;
    const cf = changedSet.has(sf) ? sf : tf;
    const nf = changedSet.has(sf) ? tf : sf;
    if (changedSet.has(cf) && !changedSet.has(nf)) {
      cDegree[cf] = (cDegree[cf] ?? 0) + 1;
      nDegree[nf] = (nDegree[nf] ?? 0) + 1;
      pairEdges.set(`${cf}>>${nf}`, { cf, nf });
    }
  }

  // Cap neighbour files to the most-connected ones so the graph stays legible.
  const cap = 80;
  const neighbourFiles = Object.keys(nDegree).sort((a, b) => nDegree[b] - nDegree[a]).slice(0, cap);
  const neighbourSet = new Set(neighbourFiles);

  const eList = [...pairEdges.values()].filter(e => neighbourSet.has(e.nf));

  const communityPalette: Record<string, string> = {};
  [...ctx.touchedCommunities].forEach((c, i) => { communityPalette[c] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]; });

  // Map each neighbour file to a community (from the first known symbol in it).
  const neighbourCommunity: Record<string, string> = {};
  for (const n of ctx.neighbours) {
    if (n.file && n.community && neighbourCommunity[n.file] === undefined) neighbourCommunity[n.file] = n.community;
  }

  return { changedFiles, neighbourFiles, eList, communityPalette, cDegree, nDegree, cCommunity, neighbourCommunity };
}

export function GraphifyNetwork({ ctx }: { ctx: GraphifyContextResponse }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<VisNetwork | null>(null);
  const [info, setInfo] = useState<{ title: string; sub: string; type: string; neighbors: number } | null>(null);

  const L = useMemo(() => buildGraphLayout(ctx), [ctx]);
  const { changedFiles, neighbourFiles, eList, communityPalette, cDegree, nDegree, cCommunity, neighbourCommunity } = L;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let alive = true;
    let net: VisNetwork | null = null;

    (async () => {
      const { Network, DataSet } = await import('vis-network/standalone');
      if (!alive || !el) return;

      const nodes = new DataSet<Record<string, unknown>>();
      changedFiles.forEach(cf => {
        nodes.add({
          id: `cf:${cf}`,
          label: basename(cf),
          color: { background: graphC.plex, border: graphC.plex, highlight: { background: '#0e1e4f', border: '#0e1e4f' } },
          font: { color: '#00000', size: 13, face: 'IBM Plex Mono' },
          borderWidth: 1.5,
          size: 18,
          _source_file: cf,
          _community: cCommunity[cf],
          _type: 'changed file',
          _degree: cDegree[cf] ?? 0,
        });
      });
      neighbourFiles.forEach(nf => {
        const comm = neighbourCommunity[nf];
        const bg = communityPalette[comm as string] ?? graphC.muted;
        nodes.add({
          id: `nf:${nf}`,
          label: basename(nf),
          color: { background: bg, border: bg, highlight: { background: graphC.plex, border: graphC.plex } },
          font: { color: '#555', size: 10, face: 'IBM Plex Mono' },
          borderWidth: 1,
          size: 8 + Math.min(8, Math.log1p(nDegree[nf] ?? 0) * 3),
          _source_file: nf,
          _community: comm,
          _type: 'dependency',
          _degree: nDegree[nf] ?? 0,
        });
      });

      const edges = new DataSet<Record<string, unknown>>();
      eList.forEach((e, i) => {
        edges.add({
          id: i,
          from: `cf:${e.cf}`,
          to: `nf:${e.nf}`,
          arrows: { to: { enabled: true, scaleFactor: 0.4 } },
          color: { color: communityPalette[cCommunity[e.cf] as string] ?? graphC.ruleStrong, opacity: 0.5 },
          width: 1,
        });
      });

      net = new Network(el, { nodes, edges }, {
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -52,
            centralGravity: 0.01,
            springLength: 110,
            springConstant: 0.09,
            damping: 0.4,
            avoidOverlap: 0.6,
          },
          stabilization: { iterations: 260, fit: true },
        },
        layout: { improvedLayout: true },
        interaction: { hover: true, tooltipDelay: 120, hideEdgesOnDrag: false, navigationButtons: true, keyboard: false },
        nodes: { shape: 'dot' },
        edges: { smooth: { enabled: true, type: 'continuous', roundness: 0.35 }, selectionWidth: 2 },
      });
      networkRef.current = net;

      net.on('click', (params) => {
        const clicked = params.nodes as string[];
        if (clicked.length === 0 || !net) { setInfo(null); return; }
        const node = nodes.get(clicked[0]);
        if (!node) { setInfo(null); return; }
        const nb = node as { id: string; label: string; _source_file: string; _type: string };
        setInfo({
          title: String(nb.label ?? ''),
          sub: String(nb._source_file ?? ''),
          type: String(nb._type ?? ''),
          neighbors: net.getConnectedNodes(clicked[0]).length,
        });
      });

      net.once('stabilizationIterationsDone', () => {
        if (!net) return;
        net.setOptions({ physics: { enabled: false } });
        const changedIds = (nodes.getIds() as string[]).filter(id => id.startsWith('cf:'));
        if (changedIds.length) net.selectNodes(changedIds);
      });
    })();

    return () => {
      alive = false;
      if (net) net.destroy();
      networkRef.current = null;
      if (el) el.innerHTML = '';
    };
  }, [L, changedFiles, neighbourFiles, eList, communityPalette, cDegree, nDegree, cCommunity, neighbourCommunity]);

  return (
    <div>
      <div ref={containerRef} style={{ height: 420, border: `1px solid ${graphC.rule}`, background: graphC.chart }} />
      {info ? (
        <div style={{ marginTop: 10, padding: '12px 14px', border: `1px solid ${graphC.ruleStrong}`, background: graphC.ground }}>
          <div style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: graphC.ink }}>{info.title}</div>
          <div style={{ ...mono, fontSize: 11, color: graphC.plex, marginTop: 2 }}>{info.sub}</div>
          <div style={{ ...mono, fontSize: 11, color: graphC.muted, marginTop: 4 }}>
            {info.type} · {info.neighbors} connection{info.neighbors !== 1 ? 's' : ''}
          </div>
        </div>
      ) : (
        <div style={{ ...mono, marginTop: 10, fontSize: 11, color: graphC.muted }}>
          Click a node to inspect its connections. Drag to pan, scroll to zoom.
        </div>
      )}
    </div>
  );
}
