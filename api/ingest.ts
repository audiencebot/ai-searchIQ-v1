import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { crawlerVisits, tenants } from "@db/schema";
import type { InsertCrawlerVisit } from "@db/schema";
import { getDb } from "./queries/connection";
import { classifyRequest, verifyBotIp } from "./services/crawlerClassification";

/**
 * AI Channel Analytics log-drain ingest (PRD §4.7 collection).
 *
 *   POST /api/ingest/crawler-visit
 *   { "tenantKey": "asiq_…", "visits": [{ ua, path, status, ip, referer, ts }] }
 *
 * Each tenant connects a log drain (Vercel/Netlify/Cloudflare native, or
 * batched upload) to this endpoint with its per-tenant ingest token. Payloads
 * are Zod-validated; each visit is classified into the three-signal taxonomy
 * and only known-bot or AI-referrer hits are persisted — unknown traffic is
 * discarded at the edge. Bad payloads get inline 4xx errors, never a thrown
 * 500.
 */

const MAX_BATCH = 1000;

const visitSchema = z.object({
  ua: z.string().max(512).nullish(),
  path: z.string().min(1).max(1024),
  status: z.number().int().min(100).max(599),
  ip: z.string().min(1).max(45),
  referer: z.string().max(1024).nullish(),
  // Epoch ms or ISO-8601 string.
  ts: z.union([z.number().int().positive(), z.string().min(1)]),
});

const payloadSchema = z.object({
  tenantKey: z.string().min(1).max(64),
  visits: z.array(visitSchema).min(1).max(MAX_BATCH),
});

function toDate(ts: number | string): Date | null {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function crawlerVisitIngestHandler(c: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) },
      400,
    );
  }

  const db = getDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.ingestToken, parsed.data.tenantKey),
  });
  if (!tenant) {
    return c.json({ error: "Unknown tenant key" }, 401);
  }

  const rows: InsertCrawlerVisit[] = [];
  let discarded = 0;
  for (const v of parsed.data.visits) {
    const cls = classifyRequest(v.ua, v.referer);
    if (!cls.known || !cls.botClass) {
      discarded++;
      continue;
    }
    const visitedAt = toDate(v.ts);
    if (!visitedAt) {
      discarded++;
      continue;
    }
    // IP verification against published vendor bot ranges (stub — always
    // false until verifyBotIp lands; see crawlerClassification.ts TODO).
    const verified = cls.botName ? await verifyBotIp(v.ip, cls.botName) : false;
    rows.push({
      tenantId: tenant.id,
      botName: cls.botName,
      botClass: cls.botClass,
      path: v.path.slice(0, 1024),
      httpStatus: v.status,
      ip: v.ip.slice(0, 45),
      verified,
      referer: v.referer ? v.referer.slice(0, 1024) : null,
      visitedAt,
    });
  }

  if (rows.length > 0) {
    try {
      await db.insert(crawlerVisits).values(rows);
    } catch (err) {
      // Storage failure is a server problem, not a payload problem — still
      // return a JSON error, never an uncaught throw.
      return c.json(
        { error: err instanceof Error ? err.message : "Failed to persist visits" },
        500,
      );
    }
  }

  return c.json({ accepted: rows.length, discarded });
}
