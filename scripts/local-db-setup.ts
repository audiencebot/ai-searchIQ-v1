/**
 * Local dev kit — one-shot local DB bootstrap.
 *
 * Run:   npx tsx scripts/local-db-setup.ts
 * Flags: --allow-remote   required when DATABASE_URL points at a non-local
 *                         host (e.g. TiDB Cloud Serverless). The platform DB
 *                         (*.privatelink.aliyuncs.com) is ALWAYS refused.
 *
 * What it does:
 *   1. Validates DATABASE_URL (refuses the platform DB — see SAFETY below).
 *   2. Creates the database if it doesn't exist.
 *   3. Applies the full schema via `drizzle-kit push --force` (safe here:
 *      the local DB is a disposable sandbox — never run this against the
 *      platform DATABASE_URL).
 *   4. Seeds minimal demo data: owner user (unionId from OWNER_UNION_ID,
 *      falls back to "local-dev-owner"), the "Northwind Advisory" tenant
 *      (plan 'growth') with an ingestToken, and the owner's admin membership.
 *   5. Runs the crawler-visits seed (scripts/seed-crawler-visits.ts) which
 *      fills the first tenant — i.e. Northwind Advisory — with 90 days of
 *      AI-channel traffic.
 *
 * Idempotent: safe to re-run; existing rows are kept.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { tenantMembers, tenants } from "@db/schema";
import { getDb } from "../api/queries/connection";
import { upsertUser, findUserByUnionId } from "../api/queries/users";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PLATFORM_HOST_MARKER = "privatelink.aliyuncs.com";

function fail(message: string): never {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function parseDatabaseUrl(): { url: URL; dbName: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail("DATABASE_URL is not set — copy .env.local.example to .env and fill it in.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail(`DATABASE_URL is not a valid URL: ${raw}`);
  }
  if (!url.protocol.startsWith("mysql")) {
    fail(`DATABASE_URL must be a mysql:// connection string (got ${url.protocol}//…).`);
  }
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) fail("DATABASE_URL must include a database name, e.g. mysql://root:root@localhost:3306/aisearchiq");
  return { url, dbName };
}

function assertNotPlatformDb(url: URL) {
  const host = url.hostname;
  if (host.includes(PLATFORM_HOST_MARKER)) {
    fail(
      `DATABASE_URL points at the PLATFORM database (${host}).\n` +
        `This script must never touch the platform DB. Point DATABASE_URL at a local\n` +
        `MySQL instead, e.g. mysql://root:root@localhost:3306/aisearchiq`,
    );
  }
  if (!LOCAL_HOSTS.has(host) && !process.argv.includes("--allow-remote")) {
    fail(
      `DATABASE_URL host "${host}" is not localhost. Refusing to run without --allow-remote.\n` +
        `If this is your own disposable cloud sandbox (e.g. TiDB Cloud Serverless),\n` +
        `re-run with:  npx tsx scripts/local-db-setup.ts --allow-remote`,
    );
  }
}

async function createDatabaseIfMissing(url: URL, dbName: string) {
  // Connect to the server without a default database, preserving any query
  // params (TiDB Cloud encodes TLS settings in the query string).
  const serverUrl = new URL(url.toString());
  serverUrl.pathname = "";
  const conn = await mysql.createConnection(serverUrl.toString());
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName.replaceAll("`", "")}\``,
    );
    console.log(`  · database "${dbName}" ready on ${url.hostname}:${url.port || 3306}`);
  } finally {
    await conn.end();
  }
}

function applySchema() {
  console.log("  · applying schema via drizzle-kit push --force (local sandbox only)…");
  const res = spawnSync("npx", ["drizzle-kit", "push", "--force"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    fail("drizzle-kit push failed — check that MySQL is running and DATABASE_URL is correct.");
  }
}

async function seedDemoData() {
  const db = getDb();

  // Owner user — upsertUser grants role "admin" when unionId === OWNER_UNION_ID.
  const ownerUnionId = process.env.OWNER_UNION_ID || "local-dev-owner";
  await upsertUser({
    unionId: ownerUnionId,
    name: "Local Owner",
    email: "owner@localhost.dev",
    lastSignInAt: new Date(),
  });
  const owner = await findUserByUnionId(ownerUnionId);
  if (!owner) fail("Owner user insert failed unexpectedly.");
  console.log(`  · owner user #${owner.id} (unionId=${ownerUnionId}, role=${owner.role})`);

  // Northwind Advisory tenant (matches scripts/seed-crawler-visits.ts, which
  // seeds the first tenant by id — on a fresh local DB that is this one).
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.name, "Northwind Advisory"),
  });
  if (!tenant) {
    const ingestToken = `asiq_${crypto.randomBytes(16).toString("hex")}`;
    const [{ id }] = await db
      .insert(tenants)
      .values({
        name: "Northwind Advisory",
        industry: "Professional Services",
        websiteUrl: "northwindadvisory.com",
        plan: "growth",
        ingestToken,
        profile: {
          legalName: "Northwind Advisory",
          founded: 2009,
          serviceRegions: ["Metro North", "Downtown", "Harbor District", "Westside"],
          services: ["Wealth management", "Tax planning", "Estate planning", "Retirement planning"],
          pricingVisibility: "Not published",
        },
      })
      .$returningId();
    tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
    console.log(`  · tenant #${id} "Northwind Advisory" (plan=growth, ingestToken=${ingestToken})`);
  } else {
    if (!tenant.ingestToken) {
      const ingestToken = `asiq_${crypto.randomBytes(16).toString("hex")}`;
      await db.update(tenants).set({ ingestToken }).where(eq(tenants.id, tenant.id));
      console.log(`  · tenant #${tenant.id} already existed — added ingestToken=${ingestToken}`);
    } else {
      console.log(`  · tenant #${tenant.id} "Northwind Advisory" already exists — keeping as-is`);
    }
  }
  if (!tenant) fail("Tenant insert failed unexpectedly.");

  // Owner membership (admin) on the demo tenant.
  await db
    .insert(tenantMembers)
    .values({ userId: owner.id, tenantId: tenant.id, role: "admin" })
    .onDuplicateKeyUpdate({ set: { role: "admin" } });
  console.log(`  · membership: owner #${owner.id} → tenant #${tenant.id} (admin)`);

  return tenant.id;
}

function seedCrawlerVisits() {
  console.log("  · seeding ~90 days of AI crawler visits (scripts/seed-crawler-visits.ts)…");
  const res = spawnSync("npx", ["tsx", "scripts/seed-crawler-visits.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.warn("  ! crawler-visits seed reported a failure — you can retry it later with:");
    console.warn("    npx tsx scripts/seed-crawler-visits.ts");
  }
}

async function main() {
  console.log("AI Search IQ — local DB bootstrap\n");
  const { url, dbName } = parseDatabaseUrl();
  assertNotPlatformDb(url);

  console.log("1/4  Creating database if missing…");
  await createDatabaseIfMissing(url, dbName);

  console.log("2/4  Applying schema…");
  applySchema();

  console.log("3/4  Seeding demo data (owner + Northwind Advisory tenant)…");
  await seedDemoData();

  console.log("4/4  Seeding crawler visits…");
  seedCrawlerVisits();

  console.log(`
Done. Next steps:
  1. Make sure DEV_LOGIN_KEY is set in .env (e.g. DEV_LOGIN_KEY=changeme-local-only).
  2. Start the app:            npm run dev
  3. Open http://localhost:3000/dev-login, enter the key → you land in the
     portal as the owner, on the Northwind Advisory tenant.

Optional: for the full demo dataset (scans, mentions, alerts, reports):
  npx tsx db/seed.ts
`);
  process.exit(0);
}

main().catch((err) => {
  if (err && typeof err === "object" && "code" in err && err.code === "ECONNREFUSED") {
    fail("Connection refused — is the MySQL service running? See docs/LOCAL_DEV.md § Troubleshooting.");
  }
  console.error(err);
  process.exit(1);
});
