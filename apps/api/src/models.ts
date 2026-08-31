export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

export const RISK_LEVELS: Record<string, RiskLevel> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

/** One changed file inside a PR. */
export interface FileDiff {
  filename: string;
  /** added | modified | removed | renamed */
  status: string;
  additions: number;
  deletions: number;
  /** raw unified diff text; null for binary files */
  patch: string | null;
}

/** A single risk signal detected in a PR diff. */
export interface RiskHeuristic {
  rule: string;
  description: string;
  level: RiskLevel;
  file: string | null;
  line?: number | null;
}

/** Full ingested representation of a GitHub Pull Request. */
export interface PRRecord {
  id: number;
  repo: string;
  title: string;
  body: string | null;
  author: string;
  state: string;
  base_branch: string;
  head_branch: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  files: FileDiff[];
  risk_heuristics: RiskHeuristic[];
  overall_risk: RiskLevel;
  labels: string[];
  review_comments: number;
  commits: number;
}

export const PR_RISK_LEVELS: RiskLevel[] = Object.values(RISK_LEVELS);

/** Worst-case level across all fired heuristics: CRITICAL > HIGH > MEDIUM > LOW. */
export function worstCaseRisk(heuristics: RiskHeuristic[]): RiskLevel {
  if (heuristics.length === 0) return 'low';
  let worst = 0;
  for (const h of heuristics) {
    const idx = RISK_ORDER.indexOf(h.level);
    if (idx > worst) worst = idx;
  }
  return RISK_ORDER[worst];
}
