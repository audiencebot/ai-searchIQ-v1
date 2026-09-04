import { relations } from "drizzle-orm";
import {
  users,
  tenants,
  tenantMembers,
  brands,
  prompts,
  scans,
  mentions,
  sources,
  citations,
  alerts,
  actions,
  integrations,
  integrationCache,
  lighthouseAudits,
  reportMonths,
  copilotQa,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMembers),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  brands: many(brands),
  prompts: many(prompts),
  scans: many(scans),
  mentions: many(mentions),
  sources: many(sources),
  citations: many(citations),
  alerts: many(alerts),
  actions: many(actions),
  integrations: many(integrations),
  integrationCache: many(integrationCache),
  lighthouseAudits: many(lighthouseAudits),
  reportMonths: many(reportMonths),
  copilotQa: many(copilotQa),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  user: one(users, { fields: [tenantMembers.userId], references: [users.id] }),
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  tenant: one(tenants, { fields: [brands.tenantId], references: [tenants.id] }),
  mentions: many(mentions),
}));

export const promptsRelations = relations(prompts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [prompts.tenantId],
    references: [tenants.id],
  }),
  mentions: many(mentions),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  tenant: one(tenants, { fields: [scans.tenantId], references: [tenants.id] }),
  mentions: many(mentions),
  citations: many(citations),
}));

export const mentionsRelations = relations(mentions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [mentions.tenantId],
    references: [tenants.id],
  }),
  scan: one(scans, { fields: [mentions.scanId], references: [scans.id] }),
  prompt: one(prompts, {
    fields: [mentions.promptId],
    references: [prompts.id],
  }),
  brand: one(brands, { fields: [mentions.brandId], references: [brands.id] }),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sources.tenantId],
    references: [tenants.id],
  }),
  citations: many(citations),
}));

export const citationsRelations = relations(citations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [citations.tenantId],
    references: [tenants.id],
  }),
  scan: one(scans, { fields: [citations.scanId], references: [scans.id] }),
  source: one(sources, {
    fields: [citations.sourceId],
    references: [sources.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  tenant: one(tenants, { fields: [alerts.tenantId], references: [tenants.id] }),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  tenant: one(tenants, { fields: [actions.tenantId], references: [tenants.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [integrations.tenantId],
    references: [tenants.id],
  }),
}));

export const integrationCacheRelations = relations(integrationCache, ({ one }) => ({
  tenant: one(tenants, {
    fields: [integrationCache.tenantId],
    references: [tenants.id],
  }),
}));

export const lighthouseAuditsRelations = relations(lighthouseAudits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [lighthouseAudits.tenantId],
    references: [tenants.id],
  }),
}));

export const reportMonthsRelations = relations(reportMonths, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reportMonths.tenantId],
    references: [tenants.id],
  }),
}));

export const copilotQaRelations = relations(copilotQa, ({ one }) => ({
  tenant: one(tenants, {
    fields: [copilotQa.tenantId],
    references: [tenants.id],
  }),
}));
