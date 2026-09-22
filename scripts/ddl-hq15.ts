/**
 * HQ Phase 1.5 DDL — ALREADY APPLIED to the platform DB.
 * Kept as the migration record; re-running will fail on duplicate columns.
 * Proof output (SHOW COLUMNS) is printed at the end.
 */
import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
async function main() {
  const db = getDb();
  const stmts = [
    `ALTER TABLE tenants ADD COLUMN businessCategory varchar(64) NULL, ADD COLUMN businessDescription text NULL`,
    `ALTER TABLE onboarding_checklists MODIFY COLUMN status enum('new','invited','google_connected','awaiting_payment','first_scan_done','report_sent','active') NOT NULL DEFAULT 'new'`,
    `ALTER TABLE reports MODIFY COLUMN status enum('queued','running','in_review','approved','sent','complete','failed') NOT NULL DEFAULT 'queued'`,
    `ALTER TABLE reports ADD COLUMN walkthroughAt timestamp NULL, ADD COLUMN walkthroughNotes text NULL`,
  ];
  for (const s of stmts) {
    console.log("APPLY:", s.slice(0, 80));
    await db.execute(sql.raw(s));
  }
  // Proof
  for (const t of ["tenants", "reports", "onboarding_checklists"]) {
    const rows: any = await db.execute(sql.raw(`SHOW COLUMNS FROM ${t}`));
    for (const r of rows[0] ?? rows) console.log(`PROOF ${t}:`, r.Field, "|", r.Type, "|", r.Null);
  }
  // Enum migration safety: existing rows still readable
  const oc: any = await db.execute(sql.raw(`SELECT id, status FROM onboarding_checklists LIMIT 5`));
  console.log("checklists readable:", JSON.stringify(oc[0] ?? oc));
  const rp: any = await db.execute(sql.raw(`SELECT id, status FROM reports LIMIT 5`));
  console.log("reports readable:", JSON.stringify(rp[0] ?? rp));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
