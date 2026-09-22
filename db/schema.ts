import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  smallint,
  varchar,
  text,
  json,
  int,
  float,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── AI Search IQ — tenant-scoped application tables ─────────────────────────
// Every table below carries tenantId; all portal queries MUST filter by the
// caller's tenant (resolved via tenant_members) so no data crosses tenants.

export const tenants = mysqlTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 255 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 512 }).notNull(),
  // Three-tier pricing: 'report' ($399 one-time baseline), 'growth'
  // ($1,000/mo per tenant), 'enterprise' (white-label, custom pricing).
  plan: mysqlEnum("plan", ["report", "growth", "enterprise"])
    .notNull()
    .default("report"),
  // Enterprise tenants resell under their own brand (portal + reports).
  whiteLabel: boolean("whiteLabel").notNull().default(false),
  // Per-tenant ingest token for the AI Channel Analytics log-drain endpoint
  // (POST /api/ingest/crawler-visit). Format: "asiq_" + 32 hex chars.
  ingestToken: varchar("ingestToken", { length: 64 }),
  // HQ client lifecycle: new clients start 'onboarding' and flip to 'active'
  // once the first report has been delivered (client-management-plan.md §3).
  status: mysqlEnum("status", ["onboarding", "active", "paused", "churned"])
    .notNull()
    .default("onboarding"),
  // Manual checkbox: has the $399 initial audit been collected (Stripe later).
  auditPaid: boolean("auditPaid").notNull().default(false),
  // HQ business profile (Phase 1.5): coarse category + free-text description
  // captured at client intake; values from BUSINESS_CATEGORIES in contracts.
  businessCategory: varchar("businessCategory", { length: 64 }),
  businessDescription: text("businessDescription"),
  // Business profile = misrepresentation ground truth (settings.md §S3).
  profile: json("profile").$type<{
    legalName: string;
    founded: number;
    serviceRegions: string[];
    services: string[];
    pricingVisibility: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export const tenantMembers = mysqlTable(
  "tenant_members",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    role: mysqlEnum("role", ["admin", "member", "viewer"])
      .default("member")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userTenantUnique: uniqueIndex("tenant_members_user_tenant_unique").on(
      table.userId,
      table.tenantId,
    ),
    tenantIdx: index("tenant_members_tenant_idx").on(table.tenantId),
  }),
);

export type TenantMember = typeof tenantMembers.$inferSelect;
export type InsertTenantMember = typeof tenantMembers.$inferInsert;

export const brands = mysqlTable(
  "brands",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    isPrimary: boolean("isPrimary").default(false).notNull(),
    // Latest leaderboard stats + gap-diagnostic fixtures for this brand.
    stats: json("stats").$type<{
      score: number;
      mentionRate: number;
      recommendationShare: number;
      trend: number;
      gapShare?: number; // e.g. 71 — "appears where you're absent: 71% of comparison prompts"
      gapCategory?: string;
      strongestCategory?: string;
      strongestCategoryStat?: string;
      insight?: string;
    }>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("brands_tenant_idx").on(table.tenantId),
  }),
);

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

export const prompts = mysqlTable(
  "prompts",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    text: text("text").notNull(),
    category: mysqlEnum("category", [
      "best_option",
      "comparison",
      "local",
      "service_category",
      "decision_stage",
    ]).notNull(),
    priority: int("priority").default(1).notNull(),
    active: boolean("active").default(true).notNull(),
    addedAt: timestamp("addedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("prompts_tenant_idx").on(table.tenantId),
  }),
);

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = typeof prompts.$inferInsert;

export const scans = mysqlTable(
  "scans",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    startedAt: timestamp("startedAt").notNull(),
    completedAt: timestamp("completedAt"),
    status: mysqlEnum("status", ["running", "complete", "partial", "failed"])
      .default("running")
      .notNull(),
    engineSet: json("engineSet").$type<string[]>().notNull(),
    // KPI snapshot for this scan — drives the dashboard KPIs, trend, and
    // scan history. Aggregates are seeded snapshots (source of truth for
    // exact report numbers); row-level mentions back the heatmap cells.
    metrics: json("metrics").$type<{
      score: number;
      mentionRate: number;
      recommendationShare: number;
      citationStrength: number;
      promptCoverage: number;
      sentimentAccuracy: number;
      leadGap: number; // % behind the leading competitor
      engineScores: Record<string, number>;
      categoryRates: Record<string, number>;
    }>(),
  },
  (table) => ({
    tenantIdx: index("scans_tenant_idx").on(table.tenantId),
  }),
);

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;

export const engineEnumValues = [
  "chatgpt",
  "gemini",
  "claude",
  "perplexity",
  "ai_overviews",
  "ai_search",
] as const;

export const mentions = mysqlTable(
  "mentions",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    scanId: bigint("scanId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => scans.id),
    promptId: bigint("promptId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => prompts.id),
    brandId: bigint("brandId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => brands.id),
    engine: mysqlEnum("engine", engineEnumValues).notNull(),
    mentioned: boolean("mentioned").default(false).notNull(),
    recommended: boolean("recommended").default(false).notNull(),
    position: int("position"),
    sentiment: mysqlEnum("sentiment", [
      "positive",
      "neutral",
      "negative",
      "inaccurate",
    ]),
    intensity: float("intensity").default(0).notNull(), // 0–1, heatmap alpha
    responseText: text("responseText"), // raw AI answer excerpt (response drawer)
  },
  (table) => ({
    tenantIdx: index("mentions_tenant_idx").on(table.tenantId),
    scanIdx: index("mentions_scan_idx").on(table.scanId),
    promptIdx: index("mentions_prompt_idx").on(table.promptId),
  }),
);

export type Mention = typeof mentions.$inferSelect;
export type InsertMention = typeof mentions.$inferInsert;

export const sources = mysqlTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", [
      "directory",
      "article",
      "listing",
      "reviews",
      "knowledge",
    ]).notNull(),
    authority: mysqlEnum("authority", ["high", "medium", "low"]).notNull(),
    status: mysqlEnum("status", ["present", "missing"]).notNull(),
    impact: mysqlEnum("impact", ["high", "medium", "low"]),
    url: varchar("url", { length: 512 }),
    whyItMatters: text("whyItMatters"),
  },
  (table) => ({
    tenantIdx: index("sources_tenant_idx").on(table.tenantId),
  }),
);

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

export const citations = mysqlTable(
  "citations",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    scanId: bigint("scanId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => scans.id),
    sourceId: bigint("sourceId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => sources.id),
    engine: mysqlEnum("engine", engineEnumValues).notNull(),
    citedUrl: varchar("citedUrl", { length: 512 }).notNull(),
    note: text("note"), // optional feed text override for the pickup feed
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("citations_tenant_idx").on(table.tenantId),
    scanIdx: index("citations_scan_idx").on(table.scanId),
    sourceIdx: index("citations_source_idx").on(table.sourceId),
  }),
);

export type Citation = typeof citations.$inferSelect;
export type InsertCitation = typeof citations.$inferInsert;

export const alerts = mysqlTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    type: varchar("type", { length: 128 }).notNull(),
    severity: mysqlEnum("severity", ["high", "medium", "low"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    enginesAffected: json("enginesAffected").$type<string[]>().notNull(),
    aiClaim: varchar("aiClaim", { length: 255 }),
    groundTruth: varchar("groundTruth", { length: 255 }),
    triggeringPrompts: json("triggeringPrompts").$type<string[]>(),
    recommendedFix: text("recommendedFix"),
    status: mysqlEnum("status", [
      "open",
      "in_progress",
      "resolved",
      "verified",
    ])
      .default("open")
      .notNull(),
    assignee: varchar("assignee", { length: 255 }),
    firstDetectedAt: timestamp("firstDetectedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  (table) => ({
    tenantIdx: index("alerts_tenant_idx").on(table.tenantId),
  }),
);

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

export const actions = mysqlTable(
  "actions",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    kind: mysqlEnum("kind", ["roadmap", "checklist"]).notNull(),
    phase: mysqlEnum("phase", ["d30", "d60", "d90"]),
    priority: int("priority"), // roadmap card number (1–8)
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    impact: mysqlEnum("impact", ["high", "medium", "low"]),
    effort: mysqlEnum("effort", ["low", "medium", "high"]),
    targetComponent: varchar("targetComponent", { length: 128 }),
    triggeredBy: varchar("triggeredBy", { length: 255 }),
    status: mysqlEnum("status", [
      "suggested",
      "accepted",
      "todo",
      "in_progress",
      "done",
    ])
      .default("suggested")
      .notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("actions_tenant_idx").on(table.tenantId),
  }),
);

export type Action = typeof actions.$inferSelect;
export type InsertAction = typeof actions.$inferInsert;

export const integrations = mysqlTable(
  "integrations",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    provider: mysqlEnum("provider", [
      "gbp",
      "gsc",
      "ga4",
      "dataforseo",
      "lighthouse",
    ]).notNull(),
    status: mysqlEnum("status", [
      "connected",
      "not_connected",
      "platform_managed",
    ])
      .default("not_connected")
      .notNull(),
    meta: json("meta").$type<Record<string, string>>(),
    // Per-tenant OAuth credentials for Google services (gsc/ga4/gbp):
    // { refreshToken, accessToken, expiryDate, scopes, accountLabel }.
    credentials: json("credentials").$type<IntegrationCredentials>(),
    // Tenant-picked resource: GA4 property ID / GSC site URL / GBP
    // {account, location} JSON.
    externalAccountId: varchar("externalAccountId", { length: 255 }),
    connectedAt: timestamp("connectedAt"),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    tenantProviderUnique: uniqueIndex("integrations_tenant_provider_unique").on(
      table.tenantId,
      table.provider,
    ),
  }),
);

/** Shape of the per-tenant OAuth token bundle stored in integrations.credentials. */
export interface IntegrationCredentials {
  refreshToken?: string;
  accessToken?: string;
  /** Epoch ms when the access token expires. */
  expiryDate?: number;
  scopes?: string[];
  accountLabel?: string;
}

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

// Third-party API response cache (cost control): providers like DataForSEO
// bill per task, so identical live calls within the TTL are served from here.
export const integrationCache = mysqlTable(
  "integration_cache",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    provider: varchar("provider", { length: 64 }).notNull(),
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    // sha256 hex of the canonical (sorted) request params.
    paramsHash: varchar("paramsHash", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => ({
    lookupUnique: uniqueIndex("integration_cache_lookup_unique").on(
      table.tenantId,
      table.provider,
      table.endpoint,
      table.paramsHash,
    ),
    tenantIdx: index("integration_cache_tenant_idx").on(table.tenantId),
  }),
);

export type IntegrationCache = typeof integrationCache.$inferSelect;
export type InsertIntegrationCache = typeof integrationCache.$inferInsert;

// PageSpeed Insights (Lighthouse) audits — one row per run, tenant-scoped.
// This table pre-existed in the live DB (schema drift); the definition below
// matches the live columns exactly (introspected via SHOW COLUMNS/INDEX):
//   id bigint unsigned auto_increment PK
//   tenantId bigint unsigned NOT NULL FK -> tenants.id, idx lighthouse_audits_tenant_idx
//   url varchar(512) NOT NULL
//   strategy enum('mobile','desktop') NOT NULL
//   scores json NOT NULL           (parsed audit summary — LighthouseAuditSummary)
//   fetchedAt timestamp NOT NULL   (NO default — always set explicitly on insert)
//   createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
// The trimmed raw API response is cached separately in integration_cache
// (provider 'pagespeed', 24h TTL) for cost/quota control.
export const lighthouseAudits = mysqlTable(
  "lighthouse_audits",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    url: varchar("url", { length: 512 }).notNull(),
    strategy: mysqlEnum("strategy", ["mobile", "desktop"]).notNull(),
    scores: json("scores").$type<LighthouseAuditSummary>().notNull(),
    fetchedAt: timestamp("fetchedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("lighthouse_audits_tenant_idx").on(table.tenantId),
  }),
);

/** Rating buckets match Lighthouse score bands (0.9 / 0.5 cutoffs). */
export type LighthouseRating = "good" | "average" | "poor";

export interface LighthouseMetricValue {
  /** Raw numeric value (ms for timings, unitless for CLS). */
  value: number;
  /** Lighthouse display string, e.g. "1.8 s". */
  displayValue: string;
  rating: LighthouseRating;
}

/** Parsed audit summary stored in lighthouse_audits.scores. */
export interface LighthouseAuditSummary {
  url: string;
  strategy: "mobile" | "desktop";
  /** Category scores normalized to 0–100. */
  scores: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };
  metrics: {
    firstContentfulPaint: LighthouseMetricValue;
    largestContentfulPaint: LighthouseMetricValue;
    totalBlockingTime: LighthouseMetricValue;
    cumulativeLayoutShift: LighthouseMetricValue;
    speedIndex: LighthouseMetricValue;
    /** Present on Lighthouse >= 10 (CrUX-driven); absent on older runs. */
    interactionToNextPaint?: LighthouseMetricValue;
  };
  /** Top 5 perf opportunities by estimated savings. */
  opportunities: {
    id: string;
    title: string;
    /** Estimated savings display string, e.g. "0.9 s" / "120 KiB". */
    savings: string;
  }[];
  /** ISO timestamp of the API fetch. */
  fetchedAt: string;
}

export type LighthouseAudit = typeof lighthouseAudits.$inferSelect;
export type InsertLighthouseAudit = typeof lighthouseAudits.$inferInsert;

// AI Channel Analytics (PRD §4.7) — server-side measurement of the AI
// channel. One row per captured request from a known AI bot or AI-surface
// referrer, tenant-scoped like every entity. Created in the live DB via a
// manual CREATE TABLE mirroring lighthouse_audits conventions:
//   id bigint unsigned auto_increment PK
//   tenantId bigint unsigned NOT NULL FK -> tenants.id, idx crawler_visits_tenant_idx
//   botName varchar(128) NULL        (null for referral_visit rows)
//   botClass enum('training_crawl','citation_fetch','referral_visit') NOT NULL
//   path varchar(1024) NOT NULL
//   httpStatus smallint NOT NULL
//   ip varchar(45) NOT NULL
//   verified tinyint(1) NOT NULL DEFAULT 0
//   referer varchar(1024) NULL
//   visitedAt timestamp NOT NULL     (NO default — always set explicitly)
//   createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
export const crawlerVisits = mysqlTable(
  "crawler_visits",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    botName: varchar("botName", { length: 128 }),
    botClass: mysqlEnum("botClass", [
      "training_crawl",
      "citation_fetch",
      "referral_visit",
    ]).notNull(),
    path: varchar("path", { length: 1024 }).notNull(),
    httpStatus: smallint("httpStatus").notNull(),
    ip: varchar("ip", { length: 45 }).notNull(),
    verified: boolean("verified").notNull().default(false),
    referer: varchar("referer", { length: 1024 }),
    visitedAt: timestamp("visitedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("crawler_visits_tenant_idx").on(table.tenantId),
    tenantTimeIdx: index("crawler_visits_tenant_time_idx").on(
      table.tenantId,
      table.visitedAt,
    ),
  }),
);

export type CrawlerVisit = typeof crawlerVisits.$inferSelect;
export type InsertCrawlerVisit = typeof crawlerVisits.$inferInsert;
/** Three-signal classification taxonomy (PRD §4.7). */
export type BotClass = CrawlerVisit["botClass"];

// Monthly reports are stored as assembled snapshots (not derived live) so past
// months render as frozen archives exactly as delivered — see report.md §S3.
export const reportMonths = mysqlTable(
  "report_months",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    month: varchar("month", { length: 7 }).notNull(), // e.g. "2026-07"
    reportId: varchar("reportId", { length: 64 }), // e.g. "AVI-2026-07-NS04"
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
    payload: json("payload").notNull(),
  },
  (table) => ({
    tenantMonthUnique: uniqueIndex("report_months_tenant_month_unique").on(
      table.tenantId,
      table.month,
    ),
  }),
);

export type ReportMonth = typeof reportMonths.$inferSelect;
export type InsertReportMonth = typeof reportMonths.$inferInsert;

// Deterministic grounded-answer fixtures for the MVP copilot (design.md §7:
// rule-based retrieval over seeded data — NOT a live LLM).
export const copilotQa = mysqlTable(
  "copilot_qa",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    questionPattern: varchar("questionPattern", { length: 512 }).notNull(),
    canonicalQuestion: varchar("canonicalQuestion", { length: 512 }).notNull(),
    category: varchar("category", { length: 64 }), // e.g. Interpretation / Diagnosis
    answerText: text("answerText").notNull(),
    citationRefs: json("citationRefs")
      .$type<{ label: string; path: string }[]>()
      .notNull(),
    followUps: json("followUps").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("copilot_qa_tenant_idx").on(table.tenantId),
  }),
);

export type CopilotQa = typeof copilotQa.$inferSelect;
export type InsertCopilotQa = typeof copilotQa.$inferInsert;

// ─── HQ — client management & onboarding (client-management-plan.md §3) ─────
// Created in the live DB via manual CREATE TABLE statements mirroring the
// lighthouse_audits conventions (bigint unsigned AI PK, tenantId FK + index,
// timestamp columns, createdAt DEFAULT CURRENT_TIMESTAMP).

// The two-emails requirement, done properly: exactly one primary + at least
// one backup per tenant at onboarding; a table so a third contact fits later.
export const clientContacts = mysqlTable(
  "client_contacts",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    role: mysqlEnum("role", ["primary", "backup"]).notNull().default("primary"),
    // Report-completed emails go to every contact with notifyReports=true.
    notifyReports: boolean("notifyReports").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("client_contacts_tenant_idx").on(table.tenantId),
  }),
);

export type ClientContact = typeof clientContacts.$inferSelect;
export type InsertClientContact = typeof clientContacts.$inferInsert;

export const onboardingStatusValues = [
  "new",
  "invited",
  "google_connected",
  // Phase 1.5: after Google connect the client owes the $399 audit fee
  // before the initial audit may run (charge-before-report gate).
  "awaiting_payment",
  "first_scan_done",
  "report_sent",
  "active",
] as const;

// Where each new client stands in the onboarding flow — one row per tenant.
// inviteToken ("asiq_inv_" + 32 hex) powers the public /connect/<token> page.
export const onboardingChecklists = mysqlTable(
  "onboarding_checklists",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    status: mysqlEnum("status", onboardingStatusValues).notNull().default("new"),
    inviteToken: varchar("inviteToken", { length: 64 }),
    inviteSentAt: timestamp("inviteSentAt"),
    googleConnectedAt: timestamp("googleConnectedAt"),
    firstScanAt: timestamp("firstScanAt"),
    reportSentAt: timestamp("reportSentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    tenantUnique: uniqueIndex("onboarding_checklists_tenant_unique").on(
      table.tenantId,
    ),
    inviteTokenUnique: uniqueIndex("onboarding_checklists_invite_token_unique").on(
      table.inviteToken,
    ),
  }),
);

export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type InsertOnboardingChecklist = typeof onboardingChecklists.$inferInsert;

// Every report we produce, one row each. initial_audit = the $399 one-time;
// monthly = Growth-plan recurring. Phase 1.5 review gate: triggerReport lands
// in 'in_review' (staff preview) and only 'sent' reports are emailed to the
// client. Legacy 'complete' rows predate the gate and mean "delivered".
export const REPORT_STATUS_VALUES = [
  "queued",
  "running",
  "in_review",
  "approved",
  "sent",
  "complete",
  "failed",
] as const;

export const reports = mysqlTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    type: mysqlEnum("type", ["initial_audit", "monthly"]).notNull(),
    periodLabel: varchar("periodLabel", { length: 64 }).notNull(),
    status: mysqlEnum("status", REPORT_STATUS_VALUES)
      .notNull()
      .default("queued"),
    payload: json("payload").$type<ReportPayload>(),
    completedAt: timestamp("completedAt"),
    // Scheduled results walkthrough with the client (Phase 1.5).
    walkthroughAt: timestamp("walkthroughAt"),
    walkthroughNotes: text("walkthroughNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("reports_tenant_idx").on(table.tenantId),
  }),
);

/** Assembled report snapshot (Phase 1: minimal summary of available data). */
export interface ReportPayload {
  headlineScore?: number;
  integrationsConnected?: number;
  summary?: string;
  generatedAt?: string;
}

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// Proof every notification went out (or didn't). HQ shows delivery status
// per email; failed ones get a "Resend" button.
export const emailLog = mysqlTable(
  "email_log",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => tenants.id),
    reportId: bigint("reportId", { mode: "number", unsigned: true }).references(
      () => reports.id,
    ),
    toEmail: varchar("toEmail", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    status: mysqlEnum("status", ["pending", "sent", "failed"])
      .notNull()
      .default("pending"),
    providerMessageId: varchar("providerMessageId", { length: 255 }),
    error: text("error"),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("email_log_tenant_idx").on(table.tenantId),
    reportIdx: index("email_log_report_idx").on(table.reportId),
  }),
);

export type EmailLogEntry = typeof emailLog.$inferSelect;
export type InsertEmailLogEntry = typeof emailLog.$inferInsert;
