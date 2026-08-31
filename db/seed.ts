import { getDb } from "../api/queries/connection";
import {
  actions,
  alerts,
  brands,
  citations,
  copilotQa,
  integrations,
  mentions,
  prompts,
  reportMonths,
  scans,
  sources,
  tenantMembers,
  tenants,
  users,
} from "./schema";
import { eq, like } from "drizzle-orm";

/**
 * AI Search IQ seed — the complete "Northwind Advisory" demo dataset.
 *
 * All values mirror the design files (/mnt/agents/output/design/*.md) and the
 * normative sample report (/mnt/agents/upload/sample-ai-visibility-report.html).
 *
 * IDEMPOTENT: deletes the demo tenant's rows (children first) plus the seeded
 * seed-* users, then re-inserts everything inside one transaction.
 */

const ENGINES = [
  "chatgpt",
  "gemini",
  "claude",
  "perplexity",
  "ai_overviews",
  "ai_search",
] as const;

const d = (iso: string) => new Date(iso);

// ─── Exact fixtures from the design files ────────────────────────────────────

// monitoring.md §S2 — 12 prompts × 6 engines intensity matrix
// columns: ChatGPT, Gemini, Claude, Perplexity, AI Overviews, AI Search
const PROMPTS: {
  text: string;
  category:
    | "best_option"
    | "comparison"
    | "local"
    | "service_category"
    | "decision_stage";
  intensity: [number, number, number, number, number, number];
}[] = [
  { text: "Best financial advisor near me", category: "local", intensity: [0.85, 0.65, 0.4, 0.3, 0.2, 0.7] },
  { text: "Top CPA firms for small business", category: "best_option", intensity: [0.7, 0.5, 0.35, 0.25, 0.15, 0.55] },
  { text: "Compare wealth management firms", category: "comparison", intensity: [0.4, 0.3, 0.2, 0.15, 0.1, 0.3] },
  { text: "Best tax planning services", category: "service_category", intensity: [0.75, 0.6, 0.45, 0.35, 0.25, 0.6] },
  { text: "Who should I trust for retirement planning", category: "decision_stage", intensity: [0.35, 0.25, 0.2, 0.1, 0.08, 0.25] },
  { text: "Best wealth advisors in the metro area", category: "local", intensity: [0.8, 0.6, 0.35, 0.3, 0.18, 0.65] },
  { text: "Northwind Advisory vs Atlas Capital", category: "comparison", intensity: [0.45, 0.3, 0.2, 0.15, 0.1, 0.35] },
  { text: "Most trusted financial planners for retirees", category: "decision_stage", intensity: [0.3, 0.22, 0.18, 0.1, 0.08, 0.22] },
  { text: "Small business accounting services", category: "service_category", intensity: [0.72, 0.55, 0.4, 0.3, 0.22, 0.58] },
  { text: "Best rated fiduciary advisors", category: "best_option", intensity: [0.65, 0.48, 0.32, 0.22, 0.14, 0.5] },
  { text: "Estate planning firms near me", category: "local", intensity: [0.82, 0.62, 0.42, 0.32, 0.22, 0.68] },
  { text: "How to choose a wealth management firm", category: "decision_stage", intensity: [0.38, 0.28, 0.22, 0.12, 0.1, 0.28] },
];

// dashboard.md §S4 — 13 weekly scans, oldest → newest (Apr 21 → Jul 14, 2026)
const SCAN_WEEKS = [
  "2026-04-21", "2026-04-28", "2026-05-05", "2026-05-12", "2026-05-19",
  "2026-05-26", "2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23",
  "2026-06-30", "2026-07-07", "2026-07-14",
];
const SCORES = [52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 66, 72];
const MENTION_RATES = [30, 31, 33, 34, 36, 37, 39, 40, 41, 42, 43, 45, 48];
const REC_SHARES = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 27, 28, 34];
const CITATION_STRENGTHS = [50, 51, 53, 54, 55, 56, 58, 59, 60, 61, 61, 63, 65];
const PROMPT_COVERAGES = [35, 37, 38, 40, 41, 43, 44, 46, 47, 49, 50, 53, 61];
const SENTIMENT_ACCURACIES = [60, 61, 62, 63, 64, 65, 66, 67, 68, 68, 69, 70, 72];
const LEAD_GAPS = [38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 29, 27, 23];

// dashboard.md §S3 — engine scores for the Jul 14 scan
const ENGINE_SCORES_LATEST = {
  chatgpt: 78, gemini: 64, claude: 52,
  perplexity: 41, ai_overviews: 33, ai_search: 58,
};

// monitoring.md §S3 / sample report §03 — per-category mention rates
const CATEGORY_RATES_LATEST = {
  best_option: 34, comparison: 29, local: 67,
  service_category: 54, decision_stage: 38,
};

// citations.md §S3 — the 22 monitored sources
const SOURCES: {
  name: string;
  type: "directory" | "article" | "listing" | "reviews" | "knowledge";
  authority: "high" | "medium" | "low";
  status: "present" | "missing";
  impact: "high" | "medium" | "low" | null;
  url: string;
  whyItMatters?: string;
}[] = [
  { name: "Industry Directory A", type: "directory", authority: "high", status: "missing", impact: "high", url: "https://directory-a.example.com", whyItMatters: "Cited by ChatGPT in 31% of responses in your category" },
  { name: "Regional Business Journal", type: "article", authority: "high", status: "missing", impact: "high", url: "https://rbj.example.com", whyItMatters: "High-authority regional coverage that Gemini and Perplexity quote for professional-services queries" },
  { name: "Professional Listings Hub", type: "listing", authority: "medium", status: "missing", impact: "medium", url: "https://plh.example.com" },
  { name: "Trustpilot Reviews", type: "reviews", authority: "medium", status: "present", impact: null, url: "https://trustpilot.com/review/northwindadvisory.com" },
  { name: "Google Business Profile", type: "listing", authority: "high", status: "present", impact: null, url: "https://business.google.com/northwind-advisory", whyItMatters: "Cited by ChatGPT in 31% of responses in your category" },
  { name: "Wikipedia (company)", type: "knowledge", authority: "high", status: "present", impact: null, url: "https://en.wikipedia.org/wiki/Northwind_Advisory" },
  { name: "Bing Places", type: "listing", authority: "medium", status: "present", impact: null, url: "https://bingplaces.com/northwind-advisory" },
  { name: "Yelp", type: "reviews", authority: "medium", status: "present", impact: null, url: "https://yelp.com/biz/northwind-advisory" },
  { name: "Clutch", type: "directory", authority: "high", status: "missing", impact: "high", url: "https://clutch.co", whyItMatters: "2 of 4 high-authority directories are missing — Clutch is one of them" },
  { name: "Local Chamber of Commerce", type: "directory", authority: "medium", status: "missing", impact: "medium", url: "https://chamber.example.org" },
  { name: "LinkedIn Company Page", type: "knowledge", authority: "medium", status: "present", impact: null, url: "https://linkedin.com/company/northwind-advisory" },
  { name: "Apple Business Connect", type: "listing", authority: "medium", status: "present", impact: null, url: "https://businessconnect.apple.com" },
  { name: "Crunchbase", type: "knowledge", authority: "medium", status: "present", impact: null, url: "https://crunchbase.com/organization/northwind-advisory" },
  { name: "Better Business Bureau", type: "directory", authority: "medium", status: "missing", impact: "medium", url: "https://bbb.org" },
  { name: "Yahoo Local", type: "directory", authority: "low", status: "present", impact: null, url: "https://local.yahoo.com" },
  { name: "Manta", type: "directory", authority: "low", status: "missing", impact: "low", url: "https://manta.com" },
  { name: "Expertise.com", type: "listing", authority: "medium", status: "missing", impact: "medium", url: "https://expertise.com" },
  { name: "WealthManagement.com Directory", type: "directory", authority: "medium", status: "present", impact: null, url: "https://wealthmanagement.com" },
  { name: "Google Reviews", type: "reviews", authority: "high", status: "present", impact: null, url: "https://google.com/maps/northwind-advisory" },
  { name: "Facebook Business Page", type: "knowledge", authority: "low", status: "present", impact: null, url: "https://facebook.com/northwindadvisory" },
  { name: "MapQuest Local", type: "listing", authority: "low", status: "present", impact: null, url: "https://mapquest.com" },
  { name: "Chamber Article Feature", type: "article", authority: "low", status: "present", impact: null, url: "https://chamber.example.org/members/northwind" },
];

// alerts.md §S3 — alert feed fixtures
const ALERTS: {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  enginesAffected: string[];
  aiClaim?: string;
  groundTruth?: string;
  triggeringPrompts?: string[];
  recommendedFix: string;
  status: "open" | "in_progress" | "resolved" | "verified";
  assignee?: string;
  firstDetectedAt: Date;
  resolvedAt?: Date;
}[] = [
  {
    type: "outdated_service_area",
    severity: "high",
    title: "Alert 01 · Outdated Service Area",
    description:
      "ChatGPT and Gemini describe Northwind as operating in two regions. The brand now serves four regions.",
    enginesAffected: ["chatgpt", "gemini"],
    aiClaim: "2 service regions",
    groundTruth: "4 service regions",
    triggeringPrompts: ["Best financial advisor near me", "Estate planning firms near me"],
    recommendedFix:
      "Update service areas on Google Business Profile and the three directory listings to reflect all four regions.",
    status: "open",
    firstDetectedAt: d("2026-07-02T06:00:00Z"),
  },
  {
    type: "incorrect_founding_year",
    severity: "medium",
    title: "Alert 02 · Incorrect Founding Year",
    description:
      "Perplexity cites a founding year of 2011. The correct year is 2009.",
    enginesAffected: ["perplexity", "ai_search"],
    aiClaim: "2011",
    groundTruth: "2009",
    recommendedFix:
      "Correct the Wikipedia entry and authoritative directory listings.",
    status: "in_progress",
    assignee: "M. Chen",
    firstDetectedAt: d("2026-06-30T06:00:00Z"),
  },
  {
    type: "missing_pricing_signal",
    severity: "low",
    title: "Alert 03 · Missing Pricing Signal",
    description:
      "AI engines do not surface Northwind's fee structure in comparison prompts, while competitors publish transparent pricing.",
    enginesAffected: [...ENGINES],
    recommendedFix:
      "Publish a pricing overview page — already in your 30-day plan.",
    status: "open",
    firstDetectedAt: d("2026-07-05T06:00:00Z"),
  },
  {
    type: "incorrect_business_hours",
    severity: "low",
    title: "Incorrect business hours",
    description:
      "Gemini cited stale opening hours from an outdated listing. Corrected on GBP and verified by rescan.",
    enginesAffected: ["gemini"],
    recommendedFix: "Update hours on Google Business Profile and listings.",
    status: "verified",
    firstDetectedAt: d("2026-06-25T06:00:00Z"),
    resolvedAt: d("2026-07-08T06:00:00Z"),
  },
  {
    type: "outdated_phone_number",
    severity: "medium",
    title: "Outdated phone number",
    description:
      "ChatGPT surfaced a discontinued phone number from an old directory entry.",
    enginesAffected: ["chatgpt"],
    recommendedFix: "Correct NAP data across directory listings.",
    status: "resolved",
    firstDetectedAt: d("2026-06-10T06:00:00Z"),
    resolvedAt: d("2026-06-21T06:00:00Z"),
  },
];

// action-plan.md §S2 / sample report §07 — the 8 roadmap cards
const ROADMAP: {
  priority: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  targetComponent: string;
  triggeredBy: string;
  status: "suggested" | "accepted" | "in_progress" | "done";
}[] = [
  { priority: 1, title: "Website content improvements", description: "Rewrite service pages to match buyer-intent language used in priority prompts.", impact: "high", effort: "medium", targetComponent: "Mention rate (30%)", triggeredBy: "12 priority prompts", status: "in_progress" },
  { priority: 2, title: "FAQ & buyer-intent content", description: "Publish FAQ pages answering the 12 monitored priority prompts verbatim.", impact: "high", effort: "medium", targetComponent: "Recommendation share (25%)", triggeredBy: "34% rec. share in best-option prompts", status: "accepted" },
  { priority: 3, title: "Schema & structured data", description: "Add Organization, FAQ, and Service schema across all priority pages.", impact: "high", effort: "low", targetComponent: "Prompt coverage (15%)", triggeredBy: "61% prompt coverage", status: "accepted" },
  { priority: 4, title: "GBP optimization", description: "Update service areas, categories, and attributes to match current operations.", impact: "medium", effort: "low", targetComponent: "Sentiment accuracy (10%)", triggeredBy: "Alert 01 — outdated service area", status: "in_progress" },
  { priority: 5, title: "Directory & citation cleanup", description: "Add listings to the three missing high-authority directories identified in Section 05.", impact: "high", effort: "medium", targetComponent: "Citation strength (20%)", triggeredBy: "3 citation gaps", status: "accepted" },
  { priority: 6, title: "Authority-building content", description: "Publish bylined thought leadership in the Regional Business Journal.", impact: "medium", effort: "high", targetComponent: "Citation strength (20%)", triggeredBy: "Regional Business Journal missing", status: "suggested" },
  { priority: 7, title: "Competitive positioning updates", description: "Add comparison pages positioning Northwind against Atlas Capital and Beacon.", impact: "medium", effort: "medium", targetComponent: "Recommendation share (25%)", triggeredBy: "Atlas leads comparison prompts", status: "suggested" },
  { priority: 8, title: "AI-readable service pages", description: "Restructure service pages with clear headings, summaries, and entity labels.", impact: "low", effort: "low", targetComponent: "Prompt coverage (15%)", triggeredBy: "61% prompt coverage", status: "suggested" },
];

// action-plan.md §S3 / sample report §08 — 30/60/90 checklist (verbatim items)
const CHECKLIST: {
  phase: "d30" | "d60" | "d90";
  title: string;
  status: "todo" | "in_progress" | "done";
}[] = [
  { phase: "d30", title: "Correct founding year across Wikipedia and directory listings", status: "done" },
  { phase: "d30", title: "Update service areas on Google Business Profile", status: "done" },
  { phase: "d30", title: "Add listings to the three missing high-authority directories", status: "todo" },
  { phase: "d30", title: "Publish pricing overview page", status: "todo" },
  { phase: "d60", title: "Rewrite service pages to match buyer-intent language", status: "done" },
  { phase: "d60", title: "Publish FAQ pages answering the 12 priority prompts", status: "todo" },
  { phase: "d60", title: "Add Organization, FAQ, and Service schema", status: "todo" },
  { phase: "d60", title: "Launch comparison pages against Atlas Capital and Beacon", status: "todo" },
  { phase: "d90", title: "Publish bylined thought leadership in Regional Business Journal", status: "todo" },
  { phase: "d90", title: "Restructure service pages with AI-readable headings and summaries", status: "todo" },
  { phase: "d90", title: "Run follow-up visibility scan and benchmark against baseline", status: "todo" },
  { phase: "d90", title: "Review recommendation share and adjust content priorities", status: "todo" },
];

// settings.md §S2 — integration statuses
const INTEGRATIONS: {
  provider: "gbp" | "gsc" | "ga4" | "dataforseo" | "lighthouse";
  status: "connected" | "not_connected" | "platform_managed";
  meta: Record<string, string>;
}[] = [
  { provider: "gbp", status: "connected", meta: { syncNote: "Synced today 06:00 · Northwind Advisory — Downtown" } },
  { provider: "gsc", status: "connected", meta: { syncNote: "Daily sync · 16 months retained" } },
  { provider: "ga4", status: "not_connected", meta: { note: "OAuth 2.0 · read-only scope" } },
  { provider: "dataforseo", status: "platform_managed", meta: { note: "Platform credentials (env) · live SERP/keywords/backlinks · responses cached 24h for cost control" } },
  { provider: "lighthouse", status: "not_connected", meta: { note: "Runs weekly after connection" } },
];

// ask.md §S3 — copilot grounded-answer fixtures
const COPILOT_QA: {
  pattern: string;
  question: string;
  category: string;
  answer: string;
  citationRefs: { label: string; path: string }[];
  followUps: string[];
  createdAt: Date;
}[] = [
  {
    pattern: "score|visibility-score mean|means|meaning",
    question: "What does my AI Visibility Score of 72 mean?",
    category: "Interpretation",
    answer:
      "Your AI Visibility Score is a weighted composite of five components. At 72 you rank second of four tracked competitors, 16 points behind Atlas Capital. Your strongest lever is citation strength (65/100, 20% weight) — three high-authority sources are missing.",
    citationRefs: [
      { label: "Methodology v1.2", path: "/app" },
      { label: "Leaderboard", path: "/app/competitors" },
      { label: "Citation gaps", path: "/app/citations" },
    ],
    followUps: ["Why did my score improve this month?", "Where is Atlas Capital beating us?", "What should I do first?"],
    createdAt: d("2026-07-09T09:00:00Z"),
  },
  {
    pattern: "score improve|improved|increase|rose",
    question: "Why did my score improve 6 points this month?",
    category: "Diagnosis",
    answer:
      "+6 vs. the Jul 07 scan. Decomposition: prompt coverage +8 pts after your FAQ pages were picked up by ChatGPT and Gemini, recommendation share +6 pts in local prompts. Citation strength was flat.",
    citationRefs: [
      { label: "Trend · coverage", path: "/app" },
      { label: "Heatmap · local", path: "/app/monitoring" },
    ],
    followUps: ["Which engines drove the gain?", "Show the prompts behind coverage", "Draft the fix list"],
    createdAt: d("2026-07-14T09:00:00Z"),
  },
  {
    pattern: "atlas beating|ahead|winning|outperforming",
    question: "Where is Atlas Capital beating us?",
    category: "Comparison",
    answer:
      "Comparison and decision-stage prompts. Atlas appears in 71% of comparison prompts where you're absent, driven by their published comparison page and transparent pricing. Priorities 02 and 07 on your roadmap target this.",
    citationRefs: [
      { label: "Gap diagnostics", path: "/app/competitors" },
      { label: "Backlinks · keyword gaps", path: "/app/competitors" },
      { label: "Roadmap", path: "/app/action-plan" },
    ],
    followUps: ["Show the prompts where Atlas wins", "Draft the fix list", "What should I do first?"],
    createdAt: d("2026-07-11T09:00:00Z"),
  },
  {
    pattern: "do|start first|begin|priority|prioritize",
    question: "What should I do first?",
    category: "Action",
    answer:
      "Resolve Alert 01 (outdated service area — High). It affects buyer-intent prompts on two engines and carries an estimated +8–12 pt sentiment-accuracy gain. The fix is updating GBP and three directory listings — already in your 30-day phase.",
    citationRefs: [
      { label: "Alert 01", path: "/app/alerts" },
      { label: "30/60/90 plan", path: "/app/action-plan" },
    ],
    followUps: ["Draft the fix list", "What does my AI Visibility Score of 72 mean?"],
    createdAt: d("2026-07-09T10:00:00Z"),
  },
];

// ─── Derived helpers ─────────────────────────────────────────────────────────

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  claude: "Claude",
  perplexity: "Perplexity",
  ai_overviews: "Google AI Overviews",
  ai_search: "AI Search",
};

function positionFor(intensity: number): number | null {
  if (intensity >= 0.8) return 1;
  if (intensity >= 0.6) return 2;
  if (intensity >= 0.45) return 3;
  return null;
}

function responseTextFor(promptText: string, engine: string, intensity: number): string {
  const engineLabel = ENGINE_LABEL[engine] ?? engine;
  if (intensity >= 0.45) {
    return `When asked "${promptText}", ${engineLabel} listed Northwind Advisory among the firms it would consider, citing the firm's Google Business Profile, Wikipedia entry, and recent client reviews. The response positioned Northwind as a strong local option, noting its wealth management, tax planning, and retirement planning services across four service regions.`;
  }
  return `When asked "${promptText}", ${engineLabel} recommended Atlas Capital and Beacon Partners, referencing their published comparison pages and transparent pricing. Northwind Advisory was not named in the response.`;
}

function scaleMap<T extends Record<string, number>>(map: T, factor: number): T {
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, Math.max(1, Math.round(v * factor))]),
  ) as T;
}

type ScanMetrics = {
  score: number;
  mentionRate: number;
  recommendationShare: number;
  citationStrength: number;
  promptCoverage: number;
  sentimentAccuracy: number;
  leadGap: number;
  engineScores: Record<string, number>;
  categoryRates: Record<string, number>;
};

// Assembled monthly report snapshot (report.md §S2 — mirrors sample report §S2–S11)
function buildReportPayload(opts: {
  monthLabel: string;
  reportId: string;
  metrics: ScanMetrics;
  label: string;
  seats: number;
}) {
  const m = opts.metrics;
  const componentRows = [
    { component: "Mention rate", weight: 30, score: m.mentionRate, contribution: Math.round(30 * m.mentionRate) / 100 },
    { component: "Recommendation share", weight: 25, score: m.recommendationShare, contribution: Math.round(25 * m.recommendationShare) / 100 },
    { component: "Citation strength", weight: 20, score: m.citationStrength, contribution: Math.round(20 * m.citationStrength) / 100 },
    { component: "Prompt coverage", weight: 15, score: m.promptCoverage, contribution: Math.round(15 * m.promptCoverage) / 100 },
    { component: "Sentiment accuracy", weight: 10, score: m.sentimentAccuracy, contribution: Math.round(10 * m.sentimentAccuracy) / 100 },
  ];
  const raw = Math.round(componentRows.reduce((s, r) => s + r.contribution, 0) * 10) / 10;
  return {
    meta: {
      tenant: "Northwind Advisory",
      industry: "Professional Services",
      reportDate: opts.monthLabel,
      reportId: opts.reportId,
      label: opts.label,
      seats: opts.seats,
      enginesMonitored: ENGINES.map((e) => ENGINE_LABEL[e]),
    },
    kpis: [
      { label: "AI Visibility Score", value: m.score, unit: "%", context: "+6 vs. last scan" },
      { label: "Brand Mention Rate", value: m.mentionRate, unit: "%", context: "of monitored prompts" },
      { label: "Competitor Lead Gap", value: m.leadGap, unit: "%", context: "behind leader" },
      { label: "Citation Strength", value: m.citationStrength >= 80 ? "High" : m.citationStrength >= 50 ? "Medium" : "Low", unit: "", context: "3 gaps found" },
      { label: "Prompt Coverage", value: m.promptCoverage, unit: "%", context: "of priority prompts" },
      { label: "Recommendation Share", value: m.recommendationShare, unit: "%", context: 'of "best option" lists' },
    ],
    keyFindings: [
      `Northwind is recommended in ${m.recommendationShare}% of "best option" prompts — up from 28%.`,
      "Two competitors appear in 71% of comparison prompts where Northwind is absent.",
      "Google AI Overviews under-represents the brand; ChatGPT is the strongest channel.",
      "Three citation sources are missing from authoritative directories AI relies on.",
    ],
    engineScores: ENGINES.map((e) => ({ engine: e, label: ENGINE_LABEL[e], score: m.engineScores[e] ?? 0 })),
    components: { rows: componentRows, composite: { weight: 100, raw, indexed: m.score } },
    leaderboard: [
      { rank: 1, brand: "Atlas Capital", score: 88, mentionRate: 74, recommendationShare: 61, trend: 2 },
      { rank: 2, brand: "Northwind Advisory", score: m.score, mentionRate: m.mentionRate, recommendationShare: m.recommendationShare, trend: 6, isYou: true },
      { rank: 3, brand: "Beacon Partners", score: 65, mentionRate: 41, recommendationShare: 22, trend: 1 },
      { rank: 4, brand: "Cedarwood Group", score: 49, mentionRate: 28, recommendationShare: 11, trend: -3 },
    ],
    categoryRates: Object.entries(m.categoryRates).map(([category, rate]) => ({ category, rate })),
    heatmap: {
      engines: ENGINES.map((e) => ({ id: e, label: ENGINE_LABEL[e] })),
      rows: PROMPTS.map((p) => ({
        prompt: p.text,
        category: p.category,
        cells: ENGINES.map((e, i) => ({ engine: e, intensity: p.intensity[i] })),
      })),
    },
    citationGaps: {
      summary: { present: 14, total: 22, highAuthorityGaps: 3 },
      sources: SOURCES.map((s) => ({
        name: s.name, type: s.type, authority: s.authority, status: s.status, impact: s.impact,
      })),
      strengthByType: [
        { type: "directory", label: "Directories", score: 42 },
        { type: "article", label: "Articles", score: 55 },
        { type: "listing", label: "Listings", score: 70 },
        { type: "reviews", label: "Reviews", score: 68 },
        { type: "knowledge", label: "Knowledge", score: 80 },
      ],
    },
    alerts: ALERTS.slice(0, 3).map((a) => ({
      title: a.title,
      severity: a.severity,
      description: a.description,
      enginesAffected: a.enginesAffected,
      status: a.status,
    })),
    roadmap: ROADMAP.map((r) => ({
      priority: r.priority, title: r.title, description: r.description, impact: r.impact, status: r.status,
    })),
    plan: {
      phases: [
        { phase: "d30", label: "Days 1–30 · Stabilize", theme: "Quick Wins", items: CHECKLIST.filter((c) => c.phase === "d30").map((c) => c.title) },
        { phase: "d60", label: "Days 31–60 · Build", theme: "Content & Schema", items: CHECKLIST.filter((c) => c.phase === "d60").map((c) => c.title) },
        { phase: "d90", label: "Days 61–90 · Expand", theme: "Authority", items: CHECKLIST.filter((c) => c.phase === "d90").map((c) => c.title) },
      ],
    },
    deltas: {
      executiveSummary: "+6 score vs. June",
      competitive: "Rank unchanged: 2 of 4",
      alerts: "1 alert resolved since June",
    },
    footer: "© 2026 · Northwind Advisory · Page 10 of 10",
  };
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  const db = getDb();
  console.log("Seeding AI Search IQ demo dataset (Northwind Advisory)...");

  await db.transaction(async (tx) => {
    // ── Idempotency: delete the demo tenant's data (children first) ──
    const existingTenant = await tx.query.tenants.findFirst({
      where: eq(tenants.name, "Northwind Advisory"),
    });
    if (existingTenant) {
      const tid = existingTenant.id;
      await tx.delete(citations).where(eq(citations.tenantId, tid));
      await tx.delete(mentions).where(eq(mentions.tenantId, tid));
      await tx.delete(alerts).where(eq(alerts.tenantId, tid));
      await tx.delete(actions).where(eq(actions.tenantId, tid));
      await tx.delete(sources).where(eq(sources.tenantId, tid));
      await tx.delete(prompts).where(eq(prompts.tenantId, tid));
      await tx.delete(scans).where(eq(scans.tenantId, tid));
      await tx.delete(reportMonths).where(eq(reportMonths.tenantId, tid));
      await tx.delete(integrations).where(eq(integrations.tenantId, tid));
      await tx.delete(copilotQa).where(eq(copilotQa.tenantId, tid));
      await tx.delete(brands).where(eq(brands.tenantId, tid));
      await tx.delete(tenantMembers).where(eq(tenantMembers.tenantId, tid));
      await tx.delete(tenants).where(eq(tenants.id, tid));
      console.log("  · cleared previous Northwind Advisory tenant data");
    }
    // Seeded member users (identified by the seed- unionId prefix)
    const seededUsers = await tx
      .select({ id: users.id })
      .from(users)
      .where(like(users.unionId, "seed-%"));
    for (const u of seededUsers) {
      await tx.delete(tenantMembers).where(eq(tenantMembers.userId, u.id));
    }
    await tx.delete(users).where(like(users.unionId, "seed-%"));

    // ── Tenant ──
    const [{ id: tenantId }] = await tx
      .insert(tenants)
      .values({
        name: "Northwind Advisory",
        industry: "Professional Services",
        websiteUrl: "northwindadvisory.com",
        plan: "growth",
        profile: {
          legalName: "Northwind Advisory",
          founded: 2009,
          serviceRegions: ["Metro North", "Downtown", "Harbor District", "Westside"],
          services: ["Wealth management", "Tax planning", "Estate planning", "Retirement planning"],
          pricingVisibility: "Not published",
        },
        createdAt: d("2026-06-01T09:00:00Z"),
      })
      .$returningId();
    console.log(`  · tenant #${tenantId} Northwind Advisory`);

    // ── Users + memberships (settings.md §S4 — 6 member rows) ──
    const SEED_USERS: {
      unionId: string; name: string; email: string;
      memberRole: "admin" | "member" | "viewer";
      lastSignIn: string;
    }[] = [
      { unionId: "seed-demo-northwind", name: "Demo User", email: "demo@northwindadvisory.com", memberRole: "admin", lastSignIn: "2026-07-14T08:30:00Z" },
      { unionId: "seed-m-chen", name: "M. Chen", email: "mchen@northwindadvisory.com", memberRole: "admin", lastSignIn: "2026-07-14T07:45:00Z" },
      { unionId: "seed-j-okafor", name: "J. Okafor", email: "jokafor@northwindadvisory.com", memberRole: "member", lastSignIn: "2026-07-13T16:20:00Z" },
      { unionId: "seed-a-ruiz", name: "A. Ruiz", email: "aruiz@northwindadvisory.com", memberRole: "member", lastSignIn: "2026-07-12T11:05:00Z" },
      { unionId: "seed-s-patel", name: "S. Patel", email: "spatel@northwindadvisory.com", memberRole: "member", lastSignIn: "2026-07-10T14:40:00Z" },
      // "Agency" role in the design maps to the viewer membership role
      { unionId: "seed-agency-brightpath", name: "Brightpath Agency", email: "agency@brightpath.co", memberRole: "viewer", lastSignIn: "2026-07-08T10:15:00Z" },
    ];
    for (const su of SEED_USERS) {
      const [{ id: userId }] = await tx
        .insert(users)
        .values({
          unionId: su.unionId,
          name: su.name,
          email: su.email,
          role: "user",
          createdAt: d("2026-06-01T09:00:00Z"),
          lastSignInAt: d(su.lastSignIn),
        })
        .$returningId();
      await tx.insert(tenantMembers).values({
        userId,
        tenantId,
        role: su.memberRole,
        createdAt: d("2026-06-01T09:00:00Z"),
      });
    }
    console.log(`  · ${SEED_USERS.length} users + memberships`);

    // ── Brands (competitors.md §S2 leaderboard + §S3 gap stats) ──
    const [{ id: primaryBrandId }] = await tx
      .insert(brands)
      .values({
        tenantId,
        name: "Northwind Advisory",
        isPrimary: true,
        stats: { score: 72, mentionRate: 48, recommendationShare: 34, trend: 6 },
      })
      .$returningId();
    const competitorIds: Record<string, number> = {};
    const COMPETITORS = [
      {
        name: "Atlas Capital",
        stats: {
          score: 88, mentionRate: 74, recommendationShare: 61, trend: 2,
          gapShare: 71, gapCategory: "comparison",
          strongestCategory: "Best option", strongestCategoryStat: "61% rec. share",
          insight:
            "Atlas wins comparison prompts with a published comparison page and transparent pricing — both are on your roadmap (Priorities 02 & 07).",
        },
      },
      {
        name: "Beacon Partners",
        stats: {
          score: 65, mentionRate: 41, recommendationShare: 22, trend: 1,
          gapShare: 48, gapCategory: "decision_stage",
          strongestCategory: "Decision-stage", strongestCategoryStat: "22% rec. share",
          insight:
            "Beacon edges Northwind on retiree-focused decision prompts via its published checklist content.",
        },
      },
      {
        name: "Cedarwood Group",
        stats: {
          score: 49, mentionRate: 28, recommendationShare: 11, trend: -3,
          gapShare: 22, gapCategory: "local",
          strongestCategory: "Local", strongestCategoryStat: "11% rec. share",
          insight:
            "Cedarwood trails overall but still appears in estate-planning local prompts where Northwind is absent.",
        },
      },
    ];
    for (const c of COMPETITORS) {
      const [{ id }] = await tx
        .insert(brands)
        .values({ tenantId, name: c.name, isPrimary: false, stats: c.stats })
        .$returningId();
      competitorIds[c.name] = id;
    }
    console.log(`  · ${COMPETITORS.length + 1} brands`);

    // ── Prompts ──
    const promptIds: number[] = [];
    for (const [i, p] of PROMPTS.entries()) {
      const [{ id }] = await tx
        .insert(prompts)
        .values({
          tenantId,
          text: p.text,
          category: p.category,
          priority: i + 1,
          active: true,
          addedAt: d("2026-06-15T09:00:00Z"),
        })
        .$returningId();
      promptIds.push(id);
    }
    console.log(`  · ${promptIds.length} prompts`);

    // ── Scans: 13 weekly snapshots (dashboard trend + history) ──
    const scanIds: number[] = [];
    const scanMetrics: ScanMetrics[] = [];
    for (const [i, week] of SCAN_WEEKS.entries()) {
      const factor = SCORES[i] / 72;
      const metrics: ScanMetrics = {
        score: SCORES[i],
        mentionRate: MENTION_RATES[i],
        recommendationShare: REC_SHARES[i],
        citationStrength: CITATION_STRENGTHS[i],
        promptCoverage: PROMPT_COVERAGES[i],
        sentimentAccuracy: SENTIMENT_ACCURACIES[i],
        leadGap: LEAD_GAPS[i],
        engineScores: scaleMap(ENGINE_SCORES_LATEST, factor),
        categoryRates: scaleMap(CATEGORY_RATES_LATEST, factor),
      };
      const [{ id }] = await tx
        .insert(scans)
        .values({
          tenantId,
          startedAt: d(`${week}T06:00:00Z`),
          completedAt: d(`${week}T06:42:00Z`),
          status: "complete",
          engineSet: [...ENGINES],
          metrics,
        })
        .$returningId();
      scanIds.push(id);
      scanMetrics.push(metrics);
    }
    const latestScanId = scanIds[scanIds.length - 1];
    console.log(`  · ${scanIds.length} scans (Apr 21 → Jul 14, 2026)`);

    // ── Mentions for the latest scan: 12 prompts × 6 engines (primary brand,
    //    exact heatmap intensities) + competitor mentions for gap diagnostics ──
    let mentionCount = 0;
    for (const [pi, p] of PROMPTS.entries()) {
      for (const [ei, engine] of ENGINES.entries()) {
        const intensity = p.intensity[ei];
        const mentioned = intensity >= 0.45;
        const recommended = intensity >= 0.65;
        await tx.insert(mentions).values({
          tenantId,
          scanId: latestScanId,
          promptId: promptIds[pi],
          brandId: primaryBrandId,
          engine,
          mentioned,
          recommended,
          position: mentioned ? positionFor(intensity) : null,
          sentiment: mentioned ? (intensity >= 0.6 ? "positive" : "neutral") : null,
          intensity,
          responseText: responseTextFor(p.text, engine, intensity),
        });
        mentionCount += 1;

        // Competitor presence: Atlas strong everywhere, Beacon where Northwind
        // is weak, Cedarwood only where Northwind is weakest.
        const competitorPresence: [string, boolean, number][] = [
          ["Atlas Capital", true, mentioned ? 1 : 1],
          ["Beacon Partners", intensity < 0.65, mentioned ? 2 : 2],
          ["Cedarwood Group", intensity < 0.4, 3],
        ];
        for (const [name, present, pos] of competitorPresence) {
          if (!present) continue;
          await tx.insert(mentions).values({
            tenantId,
            scanId: latestScanId,
            promptId: promptIds[pi],
            brandId: competitorIds[name],
            engine,
            mentioned: true,
            recommended: name === "Atlas Capital",
            position: pos,
            sentiment: "neutral",
            intensity: Math.min(0.95, 1 - intensity * 0.35),
            responseText: null,
          });
          mentionCount += 1;
        }
      }
    }
    console.log(`  · ${mentionCount} mentions (latest scan)`);

    // ── Sources (citations.md — 22 monitored sources) ──
    const sourceIds: Record<string, number> = {};
    for (const s of SOURCES) {
      const [{ id }] = await tx
        .insert(sources)
        .values({
          tenantId,
          name: s.name,
          type: s.type,
          authority: s.authority,
          status: s.status,
          impact: s.impact,
          url: s.url,
          whyItMatters: s.whyItMatters ?? null,
        })
        .$returningId();
      sourceIds[s.name] = id;
    }
    console.log(`  · ${SOURCES.length} sources`);

    // ── Citations: drawer evidence (3 for prompt 1 · ChatGPT) + pickup feed ──
    const CITATIONS: {
      source: string; engine: (typeof ENGINES)[number]; citedUrl: string;
      createdAt: Date; note?: string;
    }[] = [
      // citations.md §S5 — pickup feed (exact strings)
      { source: "Google Business Profile", engine: "chatgpt", citedUrl: "https://business.google.com/northwind-advisory", createdAt: d("2026-07-12T06:00:00Z"), note: "ChatGPT cited your Google Business Profile in 'Best financial advisor near me'" },
      { source: "Google Business Profile", engine: "perplexity", citedUrl: "https://northwindadvisory.com/faq", createdAt: d("2026-07-09T06:00:00Z"), note: "Perplexity picked up your new FAQ page" },
      { source: "Wikipedia (company)", engine: "perplexity", citedUrl: "https://en.wikipedia.org/wiki/Northwind_Advisory", createdAt: d("2026-07-02T06:00:00Z"), note: "Wikipedia entry refreshed — founding year still incorrect" },
      // response-drawer evidence for heatmap cells
      { source: "Wikipedia (company)", engine: "chatgpt", citedUrl: "https://en.wikipedia.org/wiki/Northwind_Advisory", createdAt: d("2026-07-14T06:00:00Z") },
      { source: "Trustpilot Reviews", engine: "chatgpt", citedUrl: "https://trustpilot.com/review/northwindadvisory.com", createdAt: d("2026-07-14T06:00:00Z") },
      { source: "Google Business Profile", engine: "gemini", citedUrl: "https://business.google.com/northwind-advisory", createdAt: d("2026-07-14T06:00:00Z") },
      { source: "Yelp", engine: "gemini", citedUrl: "https://yelp.com/biz/northwind-advisory", createdAt: d("2026-07-14T06:00:00Z") },
      { source: "LinkedIn Company Page", engine: "claude", citedUrl: "https://linkedin.com/company/northwind-advisory", createdAt: d("2026-07-14T06:00:00Z") },
      { source: "Crunchbase", engine: "ai_search", citedUrl: "https://crunchbase.com/organization/northwind-advisory", createdAt: d("2026-07-14T06:00:00Z") },
      { source: "Google Reviews", engine: "ai_overviews", citedUrl: "https://google.com/maps/northwind-advisory", createdAt: d("2026-07-14T06:00:00Z") },
    ];
    for (const c of CITATIONS) {
      await tx.insert(citations).values({
        tenantId,
        scanId: latestScanId,
        sourceId: sourceIds[c.source],
        engine: c.engine,
        citedUrl: c.citedUrl,
        note: c.note ?? null,
        createdAt: c.createdAt,
      });
    }
    console.log(`  · ${CITATIONS.length} citations`);

    // ── Alerts ──
    for (const a of ALERTS) {
      await tx.insert(alerts).values({
        tenantId,
        type: a.type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        enginesAffected: a.enginesAffected,
        aiClaim: a.aiClaim ?? null,
        groundTruth: a.groundTruth ?? null,
        triggeringPrompts: a.triggeringPrompts ?? null,
        recommendedFix: a.recommendedFix,
        status: a.status,
        assignee: a.assignee ?? null,
        firstDetectedAt: a.firstDetectedAt,
        createdAt: a.firstDetectedAt,
        resolvedAt: a.resolvedAt ?? null,
      });
    }
    console.log(`  · ${ALERTS.length} alerts`);

    // ── Actions: roadmap cards + 30/60/90 checklist ──
    for (const r of ROADMAP) {
      await tx.insert(actions).values({
        tenantId,
        kind: "roadmap",
        priority: r.priority,
        title: r.title,
        description: r.description,
        impact: r.impact,
        effort: r.effort,
        targetComponent: r.targetComponent,
        triggeredBy: r.triggeredBy,
        status: r.status,
        sortOrder: r.priority,
      });
    }
    for (const [i, c] of CHECKLIST.entries()) {
      await tx.insert(actions).values({
        tenantId,
        kind: "checklist",
        phase: c.phase,
        title: c.title,
        status: c.status,
        sortOrder: i,
      });
    }
    console.log(`  · ${ROADMAP.length} roadmap cards + ${CHECKLIST.length} checklist items`);

    // ── Integrations ──
    for (const ig of INTEGRATIONS) {
      await tx.insert(integrations).values({
        tenantId,
        provider: ig.provider,
        status: ig.status,
        meta: ig.meta,
      });
    }
    console.log(`  · ${INTEGRATIONS.length} integrations`);

    // ── Copilot QA fixtures ──
    for (const qa of COPILOT_QA) {
      await tx.insert(copilotQa).values({
        tenantId,
        questionPattern: qa.pattern,
        canonicalQuestion: qa.question,
        category: qa.category,
        answerText: qa.answer,
        citationRefs: qa.citationRefs,
        followUps: qa.followUps,
        createdAt: qa.createdAt,
      });
    }
    console.log(`  · ${COPILOT_QA.length} copilot QA fixtures`);

    // ── Report months: July (current), June, May baseline ──
    const latest = scanMetrics[scanMetrics.length - 1];
    const june = scanMetrics[11]; // Jul 07 scan ≈ June report state
    const may = scanMetrics[4]; // May baseline
    await tx.insert(reportMonths).values([
      {
        tenantId,
        month: "2026-07",
        reportId: "AVI-2026-07-NS04",
        generatedAt: d("2026-07-14T07:00:00Z"),
        payload: buildReportPayload({
          monthLabel: "July 2026",
          reportId: "AVI-2026-07-NS04",
          metrics: latest,
          label: "Confidential · Member report",
          seats: 6,
        }),
      },
      {
        tenantId,
        month: "2026-06",
        reportId: "AVI-2026-06-NS03",
        generatedAt: d("2026-06-30T07:00:00Z"),
        payload: buildReportPayload({
          monthLabel: "June 2026",
          reportId: "AVI-2026-06-NS03",
          metrics: june,
          label: "Confidential · Member report",
          seats: 6,
        }),
      },
      {
        tenantId,
        month: "2026-05",
        reportId: "AVI-2026-05-NS02",
        generatedAt: d("2026-05-31T07:00:00Z"),
        payload: buildReportPayload({
          monthLabel: "May 2026 (Baseline)",
          reportId: "AVI-2026-05-NS02",
          metrics: may,
          label: "Confidential · Baseline report",
          seats: 4,
        }),
      },
    ]);
    console.log("  · 3 report months (2026-07 current, 2026-06, 2026-05 baseline)");
  });

  console.log("Done. Demo tenant: Northwind Advisory (call bootstrap.ensure on first login).");
  process.exit(0); // close MySQL connection pool
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
