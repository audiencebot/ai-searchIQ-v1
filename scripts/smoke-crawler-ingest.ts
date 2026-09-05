/**
 * Local smoke test for POST /api/ingest/crawler-visit — exercises the Hono
 * handler in-process against the live DATABASE_URL, then cleans up its rows.
 * Run: npx tsx scripts/smoke-crawler-ingest.ts
 */
import { eq, like, and } from "drizzle-orm";
import { crawlerVisits, tenants } from "@db/schema";
import { getDb } from "../api/queries/connection";
import app from "../api/boot";

let failures = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

const MARKER = "/__ingest_smoke__";

async function post(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await app.fetch(
    new Request("http://localhost/api/ingest/crawler-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function main() {
  const db = getDb();
  const tenant = await db.query.tenants.findFirst({ orderBy: tenants.id });
  if (!tenant?.ingestToken) {
    ok(false, "tenant with ingestToken exists (run the DDL/token step first)");
    process.exit(1);
  }
  const token = tenant.ingestToken;
  const now = Date.now();

  // 1. Valid batch: known bot, citation fetch, AI referer, unknown bot, bad ts.
  const good = await post({
    tenantKey: token,
    visits: [
      { ua: "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", path: MARKER + "/gptbot", status: 200, ip: "20.171.207.14", referer: null, ts: now },
      { ua: "Mozilla/5.0 (compatible; ChatGPT-User/1.0)", path: MARKER + "/chatgpt-user", status: 200, ip: "23.98.142.90", referer: null, ts: now - 1000 },
      { ua: "Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36", path: MARKER + "/referral", status: 200, ip: "73.10.20.30", referer: "https://chatgpt.com/c/xyz", ts: new Date(now).toISOString() },
      { ua: "Mozilla/5.0 (compatible; Googlebot/2.1)", path: MARKER + "/googlebot", status: 200, ip: "66.249.66.1", referer: null, ts: now },
      { ua: "", path: MARKER + "/empty-ua", status: 200, ip: "1.2.3.4", referer: null, ts: now },
      { ua: "GPTBot/1.2", path: MARKER + "/bad-ts", status: 200, ip: "1.2.3.4", referer: null, ts: "not-a-date" },
    ],
  });
  ok(good.status === 200, `valid batch → 200 (got ${good.status})`);
  ok(good.json.accepted === 3, `accepted === 3 (got ${String(good.json.accepted)})`);
  ok(good.json.discarded === 3, `discarded === 3 (unknown bot, empty UA, bad ts — got ${String(good.json.discarded)})`);

  // 2. Stored rows are classified + unverified (stub) and tenant-scoped.
  const rows = await db
    .select()
    .from(crawlerVisits)
    .where(and(eq(crawlerVisits.tenantId, tenant.id), like(crawlerVisits.path, `${MARKER}%`)));
  ok(rows.length === 3, `3 rows persisted for tenant ${tenant.id} (got ${rows.length})`);
  const byPath = new Map(rows.map((r) => [r.path, r]));
  ok(byPath.get(MARKER + "/gptbot")?.botClass === "training_crawl", "GPTBot row → training_crawl");
  ok(byPath.get(MARKER + "/chatgpt-user")?.botClass === "citation_fetch", "ChatGPT-User row → citation_fetch");
  ok(byPath.get(MARKER + "/referral")?.botClass === "referral_visit", "AI-referer row → referral_visit");
  ok(byPath.get(MARKER + "/referral")?.botName === null, "referral row botName null");
  ok(rows.every((r) => r.verified === false), "ingested rows verified=false (stub)");

  // 3. Error paths — inline 4xx, never a thrown 500.
  const badToken = await post({ tenantKey: "asiq_deadbeef", visits: [{ ua: "GPTBot", path: "/x", status: 200, ip: "1.1.1.1", referer: null, ts: now }] });
  ok(badToken.status === 401 && typeof badToken.json.error === "string", `bad token → 401 inline error (got ${badToken.status})`);

  const badPayload = await post({ tenantKey: token, visits: [{ ua: "GPTBot" }] });
  ok(badPayload.status === 400 && typeof badPayload.json.error === "string", `malformed visits → 400 inline error (got ${badPayload.status})`);

  const notJson = await post("{no json");
  ok(notJson.status === 400, `non-JSON body → 400 (got ${notJson.status})`);

  const emptyBatch = await post({ tenantKey: token, visits: [] });
  ok(emptyBatch.status === 400, `empty visits array → 400 (got ${emptyBatch.status})`);

  // 4. Cleanup — leave no smoke residue.
  await db
    .delete(crawlerVisits)
    .where(and(eq(crawlerVisits.tenantId, tenant.id), like(crawlerVisits.path, `${MARKER}%`)));
  const residue = await db
    .select({ id: crawlerVisits.id })
    .from(crawlerVisits)
    .where(and(eq(crawlerVisits.tenantId, tenant.id), like(crawlerVisits.path, `${MARKER}%`)));
  ok(residue.length === 0, "cleanup: smoke rows removed");

  if (failures) {
    console.error(`\n${failures} ingest check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll ingest checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
