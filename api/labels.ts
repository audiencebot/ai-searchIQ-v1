/** Canonical presentation labels shared across routers (single source). */

export const ENGINE_ORDER = [
  "chatgpt",
  "gemini",
  "claude",
  "perplexity",
  "ai_overviews",
  "ai_search",
] as const;

export type EngineId = (typeof ENGINE_ORDER)[number];

export const ENGINE_LABELS: Record<EngineId, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  claude: "Claude",
  perplexity: "Perplexity",
  ai_overviews: "Google AI Overviews",
  ai_search: "AI Search",
};

export const CATEGORY_ORDER = [
  "best_option",
  "comparison",
  "local",
  "service_category",
  "decision_stage",
] as const;

export type CategoryId = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  best_option: "Best option",
  comparison: "Comparison",
  local: 'Local / "near me"',
  service_category: "Service category",
  decision_stage: "Decision-stage",
};

/** Citation-strength band label from the 0–100 sub-score (methodology v1.2). */
export function citationStrengthLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}
