/**
 * Offline smoke test for the PageSpeed/Lighthouse integration (no live API
 * calls — the sandbox cannot reach googleapis.com).
 * Run: npx tsx scripts/smoke-pagespeed.ts [--unconfigured]
 *
 *   default        fixture parser assertions + DB round-trip (live DATABASE_URL)
 *   --unconfigured key absent → isPageSpeedConfigured false, runAudit rejects
 *                  with PageSpeedError before any network call
 */

let failures = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

// ─── Realistic v5 API fixture (documented schema subset) ─────────────────────
const FIXTURE_URL = "https://northwindadvisory.com/";
const fixture = {
  captchaResult: "CAPTCHA_NOT_NEEDED",
  kind: "pagespeedonline#result",
  id: FIXTURE_URL,
  loadingExperience: { metrics: {}, overall_category: "AVERAGE" },
  originLoadingExperience: { metrics: {}, overall_category: "AVERAGE" },
  lighthouseResult: {
    requestedUrl: FIXTURE_URL,
    finalUrl: FIXTURE_URL,
    fetchTime: "2026-07-14T09:30:00.000Z",
    lighthouseVersion: "12.5.1",
    userAgent: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) Chrome/136",
    environment: { networkUserAgent: "", hostUserAgent: "", benchmarkIndex: 1000 },
    configSettings: { formFactor: "mobile", locale: "en-US", channel: "api" },
    categories: {
      performance: { id: "performance", title: "Performance", score: 0.62 },
      seo: { id: "seo", title: "SEO", score: 0.92 },
      accessibility: { id: "accessibility", title: "Accessibility", score: 0.88 },
      "best-practices": { id: "best-practices", title: "Best Practices", score: 0.79 },
    },
    audits: {
      "first-contentful-paint": {
        id: "first-contentful-paint",
        title: "First Contentful Paint",
        score: 0.71,
        numericValue: 2210.4,
        displayValue: "2.2 s",
      },
      "largest-contentful-paint": {
        id: "largest-contentful-paint",
        title: "Largest Contentful Paint",
        score: 0.45,
        numericValue: 3810.2,
        displayValue: "3.8 s",
      },
      "total-blocking-time": {
        id: "total-blocking-time",
        title: "Total Blocking Time",
        score: 0.66,
        numericValue: 420,
        displayValue: "420 ms",
      },
      "cumulative-layout-shift": {
        id: "cumulative-layout-shift",
        title: "Cumulative Layout Shift",
        score: 0.95,
        numericValue: 0.08,
        displayValue: "0.08",
      },
      "speed-index": {
        id: "speed-index",
        title: "Speed Index",
        score: 0.8,
        numericValue: 3400,
        displayValue: "3.4 s",
      },
      "interaction-to-next-paint": {
        id: "interaction-to-next-paint",
        title: "Interaction to Next Paint",
        score: 0.58,
        numericValue: 390,
        displayValue: "390 ms",
      },
      "render-blocking-resources": {
        id: "render-blocking-resources",
        title: "Eliminate render-blocking resources",
        score: 0.2,
        details: { type: "opportunity", overallSavingsMs: 750 },
      },
      "unused-javascript": {
        id: "unused-javascript",
        title: "Reduce unused JavaScript",
        score: 0.4,
        details: { type: "opportunity", overallSavingsMs: 600, overallSavingsBytes: 153600 },
      },
      "uses-optimized-images": {
        id: "uses-optimized-images",
        title: "Efficiently encode images",
        score: 0.5,
        details: { type: "opportunity", overallSavingsBytes: 92160 },
      },
      "server-response-time": {
        id: "server-response-time",
        title: "Reduce initial server response time",
        score: 0.9,
        details: { type: "opportunity", overallSavingsMs: 120 },
      },
      "unminified-css": {
        id: "unminified-css",
        title: "Minify CSS",
        score: 0.8,
        details: { type: "opportunity", overallSavingsMs: 60 },
      },
      "meta-description": {
        id: "meta-description",
        title: "Document has a meta description",
        score: 1,
      },
    },
  },
  analysisUTCTimestamp: "2026-07-14T09:30:00.000Z",
};

async function main() {
  const unconfiguredMode = process.argv.includes("--unconfigured");

  const svc = await import("../api/services/pagespeed");
  if (unconfiguredMode) {
    // Clear AFTER import (dotenv/config re-stages .env on module load); the
    // service reads the key lazily on first use, so this sticks.
    delete process.env.PAGESPEED_API_KEY;
  }

  if (unconfiguredMode) {
    ok(!svc.isPageSpeedConfigured(), "unconfigured: isPageSpeedConfigured() === false");
    try {
      await svc.runAudit(FIXTURE_URL, "mobile");
      ok(false, "unconfigured: runAudit should reject");
    } catch (err) {
      ok(
        err instanceof svc.PageSpeedError && /not configured/.test(err.message),
        `unconfigured: runAudit rejects with PageSpeedError (no network) — ${(err as Error).message}`,
      );
    }
    finish();
  }

  // 1. Configured check (key staged in .env).
  ok(svc.isPageSpeedConfigured(), "configured: PAGESPEED_API_KEY present");

  // 2. Fixture through the parser → compact shape.
  const summary = svc.parseLighthouseResult(fixture, FIXTURE_URL, "mobile");
  ok(summary.url === FIXTURE_URL, `url = ${summary.url}`);
  ok(summary.strategy === "mobile", "strategy = mobile");
  ok(summary.scores.performance === 62, `performance = ${summary.scores.performance} (0-100)`);
  ok(summary.scores.seo === 92, `seo = ${summary.scores.seo}`);
  ok(summary.scores.accessibility === 88, `accessibility = ${summary.scores.accessibility}`);
  ok(summary.scores.bestPractices === 79, `bestPractices = ${summary.scores.bestPractices}`);
  const m = summary.metrics;
  ok(m.largestContentfulPaint.displayValue === "3.8 s", `LCP displayValue = ${m.largestContentfulPaint.displayValue}`);
  ok(m.largestContentfulPaint.rating === "poor", `LCP rating = ${m.largestContentfulPaint.rating} (score 0.45)`);
  ok(m.firstContentfulPaint.displayValue === "2.2 s", `FCP displayValue = ${m.firstContentfulPaint.displayValue}`);
  ok(m.firstContentfulPaint.rating === "average", `FCP rating = ${m.firstContentfulPaint.rating}`);
  ok(m.totalBlockingTime.value === 420, `TBT value = ${m.totalBlockingTime.value}`);
  ok(m.cumulativeLayoutShift.rating === "good", `CLS rating = ${m.cumulativeLayoutShift.rating}`);
  ok(m.speedIndex.displayValue === "3.4 s", `SI displayValue = ${m.speedIndex.displayValue}`);
  ok(m.interactionToNextPaint?.displayValue === "390 ms", `INP displayValue = ${m.interactionToNextPaint?.displayValue}`);
  ok(summary.fetchedAt === "2026-07-14T09:30:00.000Z", `fetchedAt = ${summary.fetchedAt}`);
  ok(summary.opportunities.length === 5, `top 5 opportunities (${summary.opportunities.length})`);
  ok(
    summary.opportunities[0]?.id === "render-blocking-resources" &&
      summary.opportunities[0]?.savings === "750 ms",
    `top opportunity = ${summary.opportunities[0]?.id} (${summary.opportunities[0]?.savings})`,
  );
  ok(
    summary.opportunities[1]?.id === "unused-javascript",
    `2nd opportunity = ${summary.opportunities[1]?.id} (sorted by est. savings)`,
  );

  // 3. Trimmed raw re-parses to the same summary (integration_cache fidelity).
  const trimmed = svc.trimRawResult(fixture);
  const reparsed = svc.parseLighthouseResult(trimmed, FIXTURE_URL, "mobile");
  ok(
    JSON.stringify(reparsed) === JSON.stringify(summary),
    "trimmed cache payload re-parses to identical summary",
  );

  // 4. INP absent on older LHR runs → metric omitted, parse still succeeds.
  const oldFixture = JSON.parse(JSON.stringify(fixture)) as typeof fixture;
  delete oldFixture.lighthouseResult.audits["interaction-to-next-paint"];
  const oldSummary = svc.parseLighthouseResult(oldFixture, FIXTURE_URL, "desktop");
  ok(oldSummary.metrics.interactionToNextPaint === undefined, "INP omitted when absent (older runs)");
  ok(oldSummary.strategy === "desktop", "strategy = desktop");

  // 5. Malformed payload → typed ZodError (never a silent garbage parse).
  try {
    svc.parseLighthouseResult({ nope: true }, FIXTURE_URL, "mobile");
    ok(false, "malformed payload should throw");
  } catch (err) {
    ok((err as Error).name === "ZodError", `malformed payload → ZodError (${(err as Error).name})`);
  }

  // 6. DB round-trip: insert + latest read through the drizzle schema
  //    (verifies the schema drift fix against the live lighthouse_audits).
  const { getDb } = await import("../api/queries/connection");
  const { lighthouseAudits, tenants } = await import("@db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const tenant = await db.query.tenants.findFirst();
  if (!tenant) {
    ok(false, "DB round-trip: no tenant found (seed the DB first)");
    finish();
  }
  const tenantId = (tenant as typeof tenants.$inferSelect).id;
  // Clean any leftovers from a previous smoke run of this exact URL.
  await db.delete(lighthouseAudits).where(eq(lighthouseAudits.url, summary.url));
  await db.insert(lighthouseAudits).values({
    tenantId,
    url: summary.url,
    strategy: "mobile",
    scores: summary,
    fetchedAt: new Date(summary.fetchedAt),
  });
  // A newer row must win the latest-audit read.
  const newer = { ...summary, fetchedAt: "2026-07-14T10:00:00.000Z" };
  await db.insert(lighthouseAudits).values({
    tenantId,
    url: summary.url,
    strategy: "mobile",
    scores: newer,
    fetchedAt: new Date(newer.fetchedAt),
  });
  const latest = await svc.getLatestAudit(tenantId);
  ok(latest !== null, "DB round-trip: latest audit read back");
  ok(latest?.fetchedAt === "2026-07-14T10:00:00.000Z", `latest = newest row (${latest?.fetchedAt})`);
  ok(
    latest?.scores.performance === 62 && latest?.opportunities.length === 5,
    "latest summary JSON round-trips intact",
  );
  await db.delete(lighthouseAudits).where(eq(lighthouseAudits.url, summary.url));
  const afterCleanup = await svc.getLatestAudit(tenantId);
  ok(
    afterCleanup === null || afterCleanup.url !== summary.url,
    "cleanup: smoke rows removed (no residue)",
  );

  finish();
}

function finish(): never {
  if (failures) {
    console.error(`\n${failures} smoke check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
