import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { copilotQa } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requireTenant } from "./tenant";

/**
 * Ask AI Search IQ — the MVP copilot (design.md §7, ask.md §S3).
 *
 * Deterministic and grounded: questions are matched (case-insensitive
 * keyword/pattern match) against tenant-scoped `copilot_qa` fixtures seeded
 * from the tenant's own data. No live LLM. Fixtures are ALWAYS filtered by
 * the caller's tenantId, so answers can never leak across tenants.
 *
 * questionPattern format: space-separated keyword groups; every group must
 * match; "|" separates alternates inside a group. Example:
 *   "score improve|improved|increase" matches "Why did my score improve?"
 */
function matchesFixture(pattern: string, question: string): boolean {
  const q = question.toLowerCase();
  return pattern
    .toLowerCase()
    .split(/\s+/)
    .every((group) => group.split("|").some((kw) => kw.length > 0 && q.includes(kw)));
}

/**
 * Cross-tenant / off-limits probes (ask.md §S3): asking for other clients'
 * data or competitor financials yields an explicit refusal, never data.
 */
const REFUSAL_PATTERN =
  /(another|other)\s+(client|tenant|account|company)|someone\s+else'?s|(?:beacon|atlas|cedarwood|competitor)'?s?\s+(revenue|financials|profit|client)|\b(revenue|financials|profit)\s+of\s+(beacon|atlas|cedarwood)/i;

const REFUSAL_TEXT =
  "I can only answer questions about Northwind Advisory's own data.";

const INSUFFICIENT_TEXT =
  "I don't have enough grounded data to answer that yet. I can answer questions about Northwind Advisory's visibility score, prompt heatmap, competitors, citations, alerts, and 30/60/90 plan — try one of the starter prompts.";

export const askRouter = createRouter({
  /** Starter prompt grid (ask.md §S2). */
  starters: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(copilotQa)
      .where(eq(copilotQa.tenantId, tenantId))
      .orderBy(copilotQa.id);
    return rows.map((r) => ({
      id: r.id,
      question: r.canonicalQuestion,
      category: r.category,
    }));
  }),

  /** Conversation history rail (ask.md §S1 left rail) — fixture-backed MVP. */
  history: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(copilotQa)
      .where(eq(copilotQa.tenantId, tenantId))
      .orderBy(desc(copilotQa.createdAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.canonicalQuestion,
      date: r.createdAt,
    }));
  }),

  /**
   * Ask a question. Returns one of:
   *  - kind "answer"       — matched fixture, grounded answer + citations
   *  - kind "refusal"      — cross-tenant / off-limits probe
   *  - kind "insufficient" — no fixture matches; explicit insufficient-data
   */
  ask: authedQuery
    .input(z.object({ question: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId, tenant } = await requireTenant(ctx.user.id);
      const rows = await getDb()
        .select()
        .from(copilotQa)
        .where(eq(copilotQa.tenantId, tenantId))
        .orderBy(copilotQa.id);

      const fixture = rows.find((r) => matchesFixture(r.questionPattern, input.question));
      if (fixture) {
        return {
          kind: "answer" as const,
          fixtureId: fixture.id,
          question: fixture.canonicalQuestion,
          answerText: fixture.answerText,
          citationRefs: fixture.citationRefs,
          followUps: fixture.followUps ?? [],
        };
      }

      if (REFUSAL_PATTERN.test(input.question)) {
        return {
          kind: "refusal" as const,
          fixtureId: null,
          question: input.question,
          // Tenant name is the caller's own — never another tenant's data.
          answerText: `I can only answer questions about ${tenant.name}'s own data.`,
          citationRefs: [],
          followUps: [],
        };
      }

      return {
        kind: "insufficient" as const,
        fixtureId: null,
        question: input.question,
        answerText: INSUFFICIENT_TEXT,
        citationRefs: [{ label: "Dashboard · latest scan", path: "/app" }],
        followUps: [],
      };
    }),
});

// Exported for tests/documentation of the refusal contract.
export const __askInternals = { matchesFixture, REFUSAL_PATTERN, REFUSAL_TEXT };
