/**
 * migrate-penalty-badaccount.mjs
 *
 * Migrates penalty_records, bad_account_list, and recon_interest
 * from the old Supabase project into AWS RDS.
 *
 * Safe to re-run (ON CONFLICT DO NOTHING). DRY RUN by default; add --commit.
 *
 * Usage:
 *   node scripts/migrate-penalty-badaccount.mjs            # dry run
 *   node scripts/migrate-penalty-badaccount.mjs --commit
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");

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
const cmEnv = readEnv(path.resolve(__dirname, "..", "..", "esprint-check-monitoring", ".env.local"));

const DATABASE_URL = portalEnv.DATABASE_URL;
const SUPABASE_URL = cmEnv.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = cmEnv.SUPABASE_SERVICE_ROLE_KEY;

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function rds(sql, params = []) {
  const c = await pool.connect();
  try { return (await c.query(sql, params)).rows; } finally { c.release(); }
}

async function sbFetch(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Range: "0-99999" },
  });
  if (!res.ok) { console.log(`  ${table}: fetch failed ${res.status}`); return []; }
  const d = await res.json();
  return Array.isArray(d) ? d : [];
}

const S = "check_monitoring";

const [penalty, badAccount, reconInterest] = await Promise.all([
  sbFetch("penalty_records"),
  sbFetch("bad_account_list"),
  sbFetch("recon_interest"),
]);

console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"}`);
console.log(`  penalty_records:  ${penalty.length}`);
console.log(`  bad_account_list: ${badAccount.length}`);
console.log(`  recon_interest:   ${reconInterest.length}`);

if (!COMMIT) { console.log("\nDry run — no changes. Re-run with --commit."); await pool.end(); process.exit(0); }

let n = 0;
for (const r of penalty) {
  await rds(
    `INSERT INTO ${S}.penalty_records (id, client, move_num, check_no, check_date, amount, paid_charge, pending_charge, payment_details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
    [r.id, r.client, r.move_num ?? null, r.check_no ?? null, r.check_date ?? null,
     r.amount ?? 0, r.paid_charge ?? 0, r.pending_charge ?? 0, r.payment_details ?? null]
  );
  n++;
}
console.log(`  penalty inserted: ${n}`);

n = 0;
for (const r of badAccount) {
  await rds(
    `INSERT INTO ${S}.bad_account_list (id, ae, branch_id, client_name, status, notes, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
    [r.id, r.ae ?? null, r.branch_id ?? null, r.client_name, r.status,
     r.notes ?? null, r.created_by ?? null, r.created_at ?? new Date().toISOString(), r.updated_at ?? new Date().toISOString()]
  );
  n++;
}
console.log(`  bad_account inserted: ${n}`);

n = 0;
for (const r of reconInterest) {
  await rds(
    `INSERT INTO ${S}.recon_interest (client_code, interest_amount, updated_by, updated_at)
     VALUES ($1,$2,$3,$4) ON CONFLICT (client_code) DO NOTHING`,
    [r.client_code, r.interest_amount ?? 0, r.updated_by ?? null, r.updated_at ?? new Date().toISOString()]
  );
  n++;
}
console.log(`  recon_interest inserted: ${n}`);

await pool.end();
console.log("\n✅ Done.");
