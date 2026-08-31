import { NextRequest, NextResponse } from 'next/server';
import { getGraphifyContext, type GraphifyContext } from '@/lib/graphify';

export interface GraphifyContextResponse extends GraphifyContext {
  /** The changed file paths that were queried. */
  files: string[];
  /** True when at least one changed file is present in the committed graph. */
  indexed: boolean;
  /** Same as the committed graph snapshot, for display. */
  indexedRepo: string;
}

/**
 * GET /api/graphify?files=<comma-separated paths>
 *
 * Returns the Graphify subgraph for a given PR's changed files. When `files`
 * is omitted (or the repo isn't in the committed snapshot), the response has
 * zero changed nodes and `indexed: false` so the UI can show an honest state.
 */
export async function GET(req: NextRequest) {
  const filesParam = req.nextUrl.searchParams.get('files');
  const files = filesParam
    ? filesParam.split(',').map(f => f.trim()).filter(Boolean)
    : [];

  const ctx = files.length > 0
    ? getGraphifyContext(files)
    : getGraphifyContext([]);

  const indexed = files.length > 0 && (ctx.changedNodes.length > 0 || ctx.neighbours.length > 0);

  const response: GraphifyContextResponse = {
    ...ctx,
    files,
    indexed,
    indexedRepo: 'apps/web',
  };

  return NextResponse.json(response);
}
