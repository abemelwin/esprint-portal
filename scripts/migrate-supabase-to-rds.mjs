/**
 * migrate-supabase-to-rds.mjs
 *
 * One-time migration: copies ALL data from the old Supabase project
 * (esprint-check-monitoring) into the new AWS RDS PostgreSQL database
 * (esprint-portal).
 *
 * What is migrated (in order):
 *   1. Reference tables: subsidiaries, ae_list, banks, branches
 *   2. Clients
 *   3. Checks
 *   4. Events
 *   5. Check notes
 *
 * SAFETY:
 *   - Uses INSERT ... ON CONFLICT DO NOTHING — safe to re-run.
 *   - DRY RUN by default. Add --commit to actually write to RDS.
 *
 * Config:
 *   RDS   → esprint-portal/.env.local      (DATABASE_URL)
 *   Supabase → esprint-check-monitoring/.env.local  (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * Usage:
 *   node scripts/migrate-supabase-to-rds.mjs            # dry run
 *   node scripts/migrate-supabase-to-rds.mjs --commit   # migrate for real
 */

import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");

// ── Load env files ────────────────────────────────────────────────────────────
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const portalEnv = readEnv(path.resolve(__dirname, "..", ".env.local"));
const cmEnv = readEnv(
  path.resolve(__dirname, "..", "..", "esprint-check-monitoring", ".env.local")
);

const DATABASE_URL  = portalEnv.DATABASE_URL;
const SUPABASE_URL  = cmEnv.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = cmEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing DATABASE_URL, SUPABASE_URL, or SERVICE_KEY.");
  process.exit(1);
}

// ── RDS connection ────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function rdsQuery(sql, params = []) {
  const client = await pool.connect();
  try { return (await client.query(sql, params)).rows; }
  finally { client.release(); }
}

// ── Supabase REST fetcher (paginated — handles >1000 rows) ───────────────────
async function sbFetch(path_, params = "") {
  const PAGE  = 1000;
  const all   = [];
  let offset  = 0;
  for (;;) {
    const range = `${offset}-${offset + PAGE - 1}`;
    const url   = `${SUPABASE_URL}/rest/v1/${path_}${params ? "?" + params : ""}`;
    const res   = await fetch(url, {
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Range":       range,
        "Prefer":      "count=none",
      },
    });
    if (res.status === 416) break;          // range out of bounds — done
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${path_} failed: ${res.status} ${text}`);
    }
    const rows = await res.json();
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < PAGE) break;          // last page
    offset += PAGE;
  }
  return all;
}

// ── Supabase auth users (for display_name lookup) ─────────────────────────────
async function getSupabaseUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const data = await res.json();
  const users = data.users ?? [];
  const map = new Map();
  for (const u of users) {
    const meta = u.user_metadata ?? {};
    map.set(u.id, meta.full_name ?? meta.name ?? u.email ?? u.id);
  }
  return map;
}

// ── Batch insert helper ───────────────────────────────────────────────────────
async function batchInsert(table, rows, onConflict = "DO NOTHING") {
  if (!rows.length) return 0;
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const keys  = Object.keys(batch[0]);
    const cols  = keys.map(k => `"${k}"`).join(", ");
    const vals  = batch.map((row, ri) =>
      `(${keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(", ")})`
    ).join(", ");
    const flat  = batch.flatMap(row => keys.map(k => row[k] ?? null));
    await rdsQuery(
      `INSERT INTO ${table} (${cols}) VALUES ${vals} ON CONFLICT ${onConflict}`,
      flat
    );
    inserted += batch.length;
  }
  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"} — Supabase → RDS migration\n`);

// 1. Fetch all Supabase data
console.log("Fetching data from Supabase…");
const [
  sbSubsidiaries,
  sbAeList,
  sbBanks,
  sbBranches,
  sbClients,
  sbChecks,
  sbEvents,
  sbNotes,
  userMap,
] = await Promise.all([
  sbFetch("subsidiaries",  "select=name&order=name"),
  sbFetch("ae_list",       "select=name&order=name"),
  sbFetch("banks",         "select=code,name&order=name"),
  sbFetch("branches",      "select=id,name,subsidiary&order=name"),
  sbFetch("clients",       "select=code,name,branch_id,ae&order=name"),
  sbFetch("checks",        "select=*&order=created_at"),
  sbFetch("events",        "select=*&order=recorded_at"),
  sbFetch("check_notes",   "select=*&order=created_at").catch(() => []),
  getSupabaseUsers(),
]);

console.log(`  subsidiaries: ${sbSubsidiaries.length}`);
console.log(`  ae_list:      ${sbAeList.length}`);
console.log(`  banks:        ${sbBanks.length}`);
console.log(`  branches:     ${sbBranches.length}`);
console.log(`  clients:      ${sbClients.length}`);
console.log(`  checks:       ${sbChecks.length}`);
console.log(`  events:       ${sbEvents.length}`);
console.log(`  notes:        ${sbNotes.length}`);
console.log(`  users:        ${userMap.size}`);

if (!COMMIT) {
  console.log("\nDry run complete — no changes made. Re-run with --commit to migrate.");
  await pool.end();
  process.exit(0);
}

// ── 2. Write to RDS ───────────────────────────────────────────────────────────
const S = "check_monitoring";

// 2a. Subsidiaries
console.log("\n[1/8] Subsidiaries…");
const subRows = sbSubsidiaries.map(r => ({ name: r.name }));
console.log(`  inserted ${await batchInsert(`${S}.subsidiaries`, subRows)}`);

// 2b. AE list
console.log("[2/8] AE list…");
const aeRows = sbAeList.map(r => ({ name: r.name }));
console.log(`  inserted ${await batchInsert(`${S}.ae_list`, aeRows)}`);

// 2c. Banks
console.log("[3/8] Banks…");
const bankRows = sbBanks.map(r => ({ code: r.code, name: r.name }));
console.log(`  inserted ${await batchInsert(`${S}.banks`, bankRows)}`);

// 2d. Branches
console.log("[4/8] Branches…");
const branchRows = sbBranches.map(r => ({
  id:         r.id,
  name:       r.name,
  subsidiary: r.subsidiary ?? null,
}));
console.log(`  inserted ${await batchInsert(`${S}.branches`, branchRows)}`);

// 2e. Clients
console.log("[5/8] Clients…");
const clientRows = sbClients.map(r => ({
  code:      r.code,
  name:      r.name,
  branch_id: r.branch_id,
  ae:        r.ae ?? null,
}));
console.log(`  inserted ${await batchInsert(`${S}.clients`, clientRows)}`);

// 2f. Checks
// Supabase columns: id, client_code, branch_id, subsidiary, ae, bank,
//   check_no, check_date, original_amount, payment_for, payment_description,
//   notes, final_status, blacklist_reason, replacement_of,
//   created_by (UUID), created_at, version
console.log("[6/8] Checks…");
const checkRows = sbChecks.map(r => ({
  id:                  r.id,
  client_code:         r.client_code,
  branch_id:           r.branch_id,
  subsidiary:          r.subsidiary ?? null,
  ae:                  r.ae ?? null,
  bank:                r.bank ?? null,
  check_no:            r.check_no,
  check_date:          r.check_date ?? null,
  original_amount:     r.original_amount ?? 0,
  payment_for:         r.payment_for ?? null,
  payment_description: r.payment_description ?? null,
  notes:               r.notes ?? null,
  final_status:        r.final_status ?? null,
  blacklist_reason:    r.blacklist_reason ?? null,
  replacement_of:      r.replacement_of ?? null,
  // Resolve UUID → display name for readability; fall back to UUID
  created_by:          userMap.get(r.created_by) ?? r.created_by ?? null,
  created_at:          r.created_at,
}));
console.log(`  inserted ${await batchInsert(`${S}.checks`, checkRows)}`);

// 2g. Events
console.log("[7/8] Events…");
const eventRows = sbEvents.map(r => ({
  id:          r.id,
  check_id:    r.check_id,
  type:        r.type,
  event_date:  r.event_date ?? null,
  move_date:   r.move_date ?? null,
  reason:      r.reason ?? null,
  method:      r.method ?? null,
  reference:   r.reference ?? null,
  amount:      r.amount ?? null,
  notes:       r.notes ?? "",
  recorded_by: userMap.get(r.recorded_by) ?? r.recorded_by ?? null,
  recorded_at: r.recorded_at,
}));
console.log(`  inserted ${await batchInsert(`${S}.events`, eventRows)}`);

// 2h. Check notes
console.log("[8/8] Check notes…");
const noteRows = sbNotes.map(r => ({
  id:              r.id,
  check_id:        r.check_id,
  content:         r.content,
  created_by:      r.created_by ?? "",
  created_by_name: userMap.get(r.created_by) ?? r.created_by ?? "",
  created_at:      r.created_at,
}));
console.log(`  inserted ${await batchInsert(`${S}.check_notes`, noteRows)}`);

await pool.end();

console.log("\n✅ Migration complete!");
console.log(`   subsidiaries: ${subRows.length}`);
console.log(`   ae_list:      ${aeRows.length}`);
console.log(`   banks:        ${bankRows.length}`);
console.log(`   branches:     ${branchRows.length}`);
console.log(`   clients:      ${clientRows.length}`);
console.log(`   checks:       ${checkRows.length}`);
console.log(`   events:       ${eventRows.length}`);
console.log(`   notes:        ${noteRows.length}`);
