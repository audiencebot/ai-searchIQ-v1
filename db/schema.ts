import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
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
