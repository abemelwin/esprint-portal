/**
 * import-backup.mjs
 *
 * Loads a Supabase JSON backup (from check-monitoring/database-backup/)
 * into the AWS RDS `check_monitoring` schema.
 *
 * SAFE: only touches the NEW RDS database. Does NOT touch production Supabase.
 *
 * Usage:
 *   node scripts/import-backup.mjs <path-to-backup.json>
 *
 * Prereqs:
 *   - .env.local has DATABASE_URL pointing to RDS
 *   - Schema already loaded (db/schema/00_portal_core.sql + 01_check_monitoring.sql)
 *
 * Order matters (FK dependencies):
 *   subsidiaries, banks, ae_list, branches → clients → checks → events,
 *   check_notes, deleted_checks, delete_requests
 */

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load DATABASE_URL from .env.local ──
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("Usage: node scripts/import-backup.mjs <path-to-backup.json>");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = "check_monitoring";

/** Insert rows in batches with an explicit column list. */
async function insertRows(client, table, columns, rows, mapFn) {
  if (!rows || rows.length === 0) {
    console.log(`  ${table.padEnd(18)} 0 rows (skipped)`);
    return;
  }
  const colList = columns.join(", ");
  let inserted = 0;
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values = [];
    const placeholders = slice
      .map((row, r) => {
        const vals = mapFn(row);
        const ph = vals.map((_, c) => `$${r * columns.length + c + 1}`);
        values.push(...vals);
        return `(${ph.join(", ")})`;
      })
      .join(", ");

    await client.query(
      `INSERT INTO ${SCHEMA}.${table} (${colList}) VALUES ${placeholders}
       ON CONFLICT DO NOTHING`,
      values
    );
    inserted += slice.length;
  }
  console.log(`  ${table.padEnd(18)} ${inserted} rows`);
}

async function main() {
  console.log("Reading backup:", backupPath);
  const data = JSON.parse(readFileSync(backupPath, "utf8"));
  console.log("Backup exported at:", data.exportedAt);
  console.log("");

  const client = await pool.connect();
  try {
    // Verify connection + schema
    await client.query(`SET search_path TO ${SCHEMA}, public`);
    console.log("Connected to RDS. Importing into schema:", SCHEMA);
    console.log("");

    // 1. Reference tables (no FK deps)
    await insertRows(client, "subsidiaries", ["name"], data.subsidiaries, (r) => [r.name]);
    await insertRows(client, "banks", ["code", "name"], data.banks, (r) => [r.code, r.name]);
    await insertRows(client, "ae_list", ["name"], data.ae_list, (r) => [r.name]);
    await insertRows(client, "branches", ["id", "name", "subsidiary"], data.branches, (r) => [r.id, r.name, r.subsidiary ?? null]);

    // 2. Clients (FK → branches)
    await insertRows(client, "clients", ["code", "name", "branch_id", "ae"], data.clients, (r) => [r.code, r.name, r.branch_id ?? null, r.ae ?? null]);

    // 3. Checks (FK → clients, branches)
    await insertRows(
      client,
      "checks",
      ["id", "client_code", "branch_id", "subsidiary", "ae", "bank", "check_no", "check_date", "original_amount", "payment_for", "payment_description", "notes", "final_status", "blacklist_reason", "replacement_of", "created_by", "created_at"],
      data.checks,
      (r) => [r.id, r.client_code, r.branch_id ?? null, r.subsidiary ?? null, r.ae ?? null, r.bank ?? null, r.check_no, r.check_date ?? null, r.original_amount ?? 0, r.payment_for ?? null, r.payment_description ?? null, r.notes ?? null, r.final_status ?? null, r.blacklist_reason ?? null, r.replacement_of ?? null, r.created_by ?? null, r.created_at]
    );

    // 4. Events (FK → checks)
    await insertRows(
      client,
      "events",
      ["id", "check_id", "type", "event_date", "move_date", "reason", "method", "reference", "amount", "notes", "recorded_by", "recorded_at"],
      data.events,
      (r) => [r.id, r.check_id, r.type, r.event_date ?? null, r.move_date ?? null, r.reason ?? null, r.method ?? null, r.reference ?? null, r.amount ?? null, r.notes ?? null, r.recorded_by ?? null, r.recorded_at]
    );

    // 5. Check notes (FK → checks)
    await insertRows(
      client,
      "check_notes",
      ["id", "check_id", "content", "created_by", "created_by_name", "created_at"],
      data.check_notes,
      (r) => [r.id, r.check_id, r.content, r.created_by, r.created_by_name ?? "", r.created_at]
    );

    // 6. Deleted checks (archive — no live FK)
    await insertRows(
      client,
      "deleted_checks",
      ["id", "check_id", "check_snapshot", "events_snapshot", "deleted_by", "deleted_by_name", "deleted_at"],
      data.deleted_checks,
      (r) => [r.id, r.check_id, JSON.stringify(r.check_snapshot ?? {}), JSON.stringify(r.events_snapshot ?? []), r.deleted_by, r.deleted_by_name ?? "", r.deleted_at]
    );

    // 7. Delete requests (FK → checks; some reference already-deleted
    //    checks. Null out check_id when the referenced check no longer
    //    exists so the FK constraint is satisfied — the request record
    //    is still preserved for audit history.)
    const liveCheckIds = new Set((data.checks ?? []).map((c) => c.id));
    await insertRows(
      client,
      "delete_requests",
      ["id", "check_id", "requested_by", "requested_by_name", "status", "created_at", "reason", "target_type", "event_id"],
      data.delete_requests,
      (r) => [
        r.id,
        r.check_id && liveCheckIds.has(r.check_id) ? r.check_id : null,
        r.requested_by,
        r.requested_by_name ?? null,
        r.status ?? "pending",
        r.created_at ?? new Date().toISOString(),
        r.reason ?? "",
        r.target_type ?? "check",
        r.event_id ?? null,
      ]
    );

    console.log("");
    console.log("✅ Import complete.");

    // Verify counts
    console.log("");
    console.log("Verification (row counts in RDS):");
    for (const t of ["checks", "events", "clients", "branches", "ae_list", "banks", "subsidiaries", "check_notes", "deleted_checks", "delete_requests"]) {
      const res = await client.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.${t}`);
      console.log(`  ${t.padEnd(18)} ${res.rows[0].n} rows`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Import failed:", e.message);
  process.exit(1);
});
