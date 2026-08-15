/**
 * Frozen monthly report payload (report.md §S2) — mirrors the shape assembled
 * by buildReportPayload in db/seed.ts. The `payload` json column is untyped
 * on the backend, so the Report page casts to this interface.
 */

export interface ReportMeta {
  tenant: string;
  industry: string;
  reportDate: string;
  reportId: string;
  label: string;
  seats: number;
  enginesMonitored: string[];
}

export interface ReportKpi {
  label: string;
  value: number | string;
  unit: string;
  context: string;
}

export interface ReportEngineScore {
  engine: string;
  label: string;
  score: number;
}

export interface ReportComponents {
  rows: { component: string; weight: number; score: number; contribution: number }[];
  composite: { weight: number; raw: number; indexed: number };
}

export interface ReportLeaderboardRow {
  rank: number;
  brand: string;
  score: number;
  mentionRate: number;
  recommendationShare: number;
  trend: number;
  isYou?: boolean;
}

export interface ReportHeatmap {
  engines: { id: string; label: string }[];
  rows: {
    prompt: string;
    category: string;
    cells: { engine: string; intensity: number }[];
  }[];
}

export interface ReportCitationGaps {
  summary: { present: number; total: number; highAuthorityGaps: number };
  sources: {
    name: string;
    type: string;
    authority: string;
    status: string;
    impact: string | null;
  }[];
  strengthByType: { type: string; label: string; score: number }[];
}

export interface ReportAlert {
  title: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  enginesAffected: string[];
  status: string;
}

export interface ReportRoadmapItem {
  priority: number;
  title: string;
  description: string;
  impact: string;
  status: string;
}

export interface ReportPlanPhase {
  phase: string;
  label: string;
  theme: string;
  items: string[];
}

export interface ReportPayload {
  meta: ReportMeta;
  kpis: ReportKpi[];
  keyFindings: string[];
  engineScores: ReportEngineScore[];
  components: ReportComponents;
  leaderboard: ReportLeaderboardRow[];
  categoryRates: { category: string; rate: number }[];
  heatmap: ReportHeatmap;
  citationGaps: ReportCitationGaps;
  alerts: ReportAlert[];
  roadmap: ReportRoadmapItem[];
  plan: { phases: ReportPlanPhase[] };
  deltas: Record<string, string>;
  footer: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  best_option: 'Best option',
  comparison: 'Comparison',
  local: 'Local / "near me"',
  service_category: 'Service category',
  decision_stage: 'Decision-stage',
};

export const ENGINE_SHORT: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
  ai_overviews: 'AI Overviews',
  ai_search: 'AI Search',
};
