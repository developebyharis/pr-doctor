// Graphify context helper.
// Reads the committed graph snapshot and returns the subgraph relevant to a
// set of changed file paths. This is what gets injected into every BOB prompt
// so agents can trace blast radius without guessing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface GraphNode {
  id: string;
  label: string;
  source_file: string;
  source_location: string;
  community_name: string;
  _callable: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  confidence_score: number;
  context: string;
  source_file: string;
}

interface GraphFile {
  nodes: GraphNode[];
  links: GraphEdge[];
}

let _graph: GraphFile | null = null;

function loadGraph(): GraphFile {
  if (_graph) return _graph;
  // Statically scoped to an in-app path so Turbopack can trace it. This is the
  // committed knowledge-graph snapshot (nodes + edges).
  const graphPath = join(process.cwd(), 'fixtures', 'graphify-graph.json');
  const raw = readFileSync(graphPath, 'utf8');
  _graph = JSON.parse(raw) as GraphFile;
  return _graph;
}

/**
 * Derive a human-readable label for the repo the committed graph was built on,
 * from the common leading path of its source files. Falls back to 'unknown'.
 */
export function getGraphRepoLabel(): string {
  const graph = loadGraph();
  const files = graph.nodes
    .map(n => n.source_file)
    .filter(Boolean)
    .map(f => f.split('/'));
  if (files.length === 0) return 'unknown';
  const first = files[0];
  const common: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const seg = first[i];
    if (files.every(f => f[i] === seg)) common.push(seg);
    else break;
  }
  // Trim to at most the top 3 directory levels so the label stays readable.
  return common.slice(0, 3).join('/') || (common[0] ?? 'unknown');
}

export interface GraphifyChangeEdge {
  /** id of a node in a changed file */
  source: string;
  /** id of the 1-hop neighbour node */
  target: string;
  relation: string;
  direction: 'out' | 'in';
}

export interface GraphifyContext {
  /** Nodes that live in one of the changed files */
  changedNodes: { id: string; label: string; location: string; community: string; file: string }[];
  /** Direct neighbours (1 hop) reachable from changedNodes */
  neighbours: { id: string; label: string; file: string; relation: string; direction: 'out' | 'in'; community: string }[];
  /** Edges from a changed node to a 1-hop neighbour (for graph rendering) */
  changeEdges: GraphifyChangeEdge[];
  /** Communities touched by the change */
  touchedCommunities: string[];
  /** Total graph stats for orientation */
  graphStats: { totalNodes: number; totalEdges: number };
}

/**
 * Given a list of changed file paths (from PRContext.filesChanged),
 * return the relevant subgraph context to give agents.
 */
export function getGraphifyContext(changedFilePaths: string[]): GraphifyContext {
  const graph = loadGraph();

  // Normalise: strip leading './' etc
  const normalise = (p: string) => p.replace(/^\.\//, '');
  const changed = new Set(changedFilePaths.map(normalise));

  // Find all nodes that live in a changed file
  const changedNodes = graph.nodes.filter(n => changed.has(normalise(n.source_file)));

  const changedIds = new Set(changedNodes.map(n => n.id));

  // Find all edges that touch a changed node
  const relevantEdges = graph.links.filter(
    e => changedIds.has(e.source) || changedIds.has(e.target)
  );

  // Collect neighbour node ids
  const neighbourIds = new Set<string>();
  relevantEdges.forEach(e => {
    if (!changedIds.has(e.source)) neighbourIds.add(e.source);
    if (!changedIds.has(e.target)) neighbourIds.add(e.target);
  });

  const neighbourNodeMap = new Map(graph.nodes.filter(n => neighbourIds.has(n.id)).map(n => [n.id, n]));

  const neighbours = relevantEdges.map(e => {
    const isOut = changedIds.has(e.source);
    const peerId = isOut ? e.target : e.source;
    const peer = neighbourNodeMap.get(peerId);
    return {
      id: peerId,
      label: peer?.label ?? peerId,
      file: peer?.source_file ?? '',
      relation: e.relation,
      direction: (isOut ? 'out' : 'in') as 'out' | 'in',
      community: peer?.community_name ?? '',
    };
  });

  const touchedCommunities = [
    ...new Set([
      ...changedNodes.map(n => n.community_name),
      ...graph.nodes.filter(n => neighbourIds.has(n.id)).map(n => n.community_name),
    ]),
  ].filter(Boolean);

  return {
    changedNodes: changedNodes.map(n => ({
      id: n.id,
      label: n.label,
      location: `${n.source_file} ${n.source_location}`,
      community: n.community_name,
      file: n.source_file,
    })),
    neighbours,
    changeEdges: relevantEdges.map(e => {
      const isOut = changedIds.has(e.source);
      return {
        source: e.source,
        target: e.target,
        relation: e.relation,
        direction: (isOut ? 'out' : 'in') as 'out' | 'in',
      };
    }),
    touchedCommunities,
    graphStats: {
      totalNodes: graph.nodes.length,
      totalEdges: graph.links.length,
    },
  };
}

/**
 * Serialise GraphifyContext into a compact markdown block suitable for
 * inclusion in a BOB prompt. Agents read this to understand blast radius
 * without having to search the full graph themselves.
 */
export function graphifyContextToPrompt(ctx: GraphifyContext): string {
  const lines: string[] = [
    '## Graphify Context Packet',
    `Graph: ${ctx.graphStats.totalNodes} nodes · ${ctx.graphStats.totalEdges} edges`,
    '',
    '### Symbols in changed files',
  ];

  if (ctx.changedNodes.length === 0) {
    lines.push('(no indexed symbols found in changed files — graph was built on a different workspace)');
  } else {
    ctx.changedNodes.forEach(n => {
      lines.push(`- \`${n.label}\` at ${n.location} [${n.community}]`);
    });
  }

  lines.push('', '### Direct connections (1 hop)');
  if (ctx.neighbours.length === 0) {
    lines.push('(none)');
  } else {
    // Deduplicate by id+relation
    const seen = new Set<string>();
    ctx.neighbours.forEach(n => {
      const key = `${n.id}:${n.relation}:${n.direction}`;
      if (seen.has(key)) return;
      seen.add(key);
      const arrow = n.direction === 'out' ? '-->' : '<--';
      lines.push(`- changed ${arrow} \`${n.label}\` (${n.relation}) in ${n.file || 'unknown'}`);
    });
  }

  lines.push('', '### Touched communities');
  ctx.touchedCommunities.forEach(c => lines.push(`- ${c}`));

  lines.push(
    '',
    '> The graph was built by IBM Graphify. Use it to establish reachability — do not invent connections not listed here.',
  );

  return lines.join('\n');
}
