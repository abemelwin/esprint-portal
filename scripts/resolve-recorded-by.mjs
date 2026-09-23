/**
 * resolve-recorded-by.mjs
 *
 * Rebuilds the UUID → display-name map from Supabase auth users (with proper
 * pagination) and updates check_monitoring.events.recorded_by,
 * checks.created_by and check_notes.created_by_name on RDS.
 *
 * UUIDs that no longer exist in Supabase (truly deleted users) are left as-is;
 * the UI already renders those as "Deleted user".
 *
 * DRY RUN by default. Pass --commit to actually write.
 *
 *   node scripts/resolve-recorded-by.mjs           # preview only
 *   node scripts/resolve-recorded-by.mjs --commit  # apply
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = process.argv.includes("--commit");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readEnv(p) {
  return Object.fromEntries(
    fs.readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const portalEnv = readEnv(path.resolve(__dirname, "..", ".env.local"));
const cmEnv = readEnv(path.resolve(__dirname, "..", "..", "esprint-check-monitoring", ".env.local"));

const SUPABASE_URL = cmEnv.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = cmEnv.SUPABASE_SERVICE_ROLE_KEY;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── 1. Fetch ALL Supabase auth users, paginated ──────────────────────────────
async function buildUserMap() {
  const map = new Map();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=${perPage}&page=${page}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) { console.error("Supabase fetch failed:", res.status, await res.text()); break; }
    const data = await res.json();
    const users = data.users ?? [];
    for (const u of users) {
      const meta = u.user_metadata ?? {};
      const name = meta.full_name ?? meta.name ?? u.email ?? u.id;
      map.set(u.id, name);
    }
    if (users.length < perPage) break;
    page++;
  }
  return map;
}

const userMap = await buildUserMap();
console.log(`Fetched ${userMap.size} Supabase users.`);

const client = new pg.Client({
  connectionString: portalEnv.DATABASE_URL,
  ssl: portalEnv.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
await client.connect();
const S = "check_monitoring";

async function resolveColumn(table, col, extraNameCol = null) {
  const { rows } = await client.query(
    `SELECT id, ${col} AS v FROM ${S}.${table} WHERE ${col} IS NOT NULL`
  );
  let resolved = 0, alreadyName = 0, stillDeleted = 0;
  for (const r of rows) {
    const v = String(r.v ?? "").trim();
    if (!UUID_RE.test(v)) { alreadyName++; continue; }
    const name = userMap.get(v);
    if (!name) { stillDeleted++; continue; }
    if (COMMIT) {
      if (extraNameCol) {
        await client.query(
          `UPDATE ${S}.${table} SET ${col} = $1, ${extraNameCol} = $1 WHERE id = $2`,
          [name, r.id]
        );
      } else {
        await client.query(
          `UPDATE ${S}.${table} SET ${col} = $1 WHERE id = $2`,
          [name, r.id]
        );
      }
    }
    resolved++;
  }
  console.log(`${table}.${col}: resolved=${resolved}, alreadyName=${alreadyName}, stillDeleted=${stillDeleted}`);
}

await resolveColumn("events", "recorded_by");
await resolveColumn("checks", "created_by");
await resolveColumn("check_notes", "created_by", "created_by_name");

await client.end();
console.log(COMMIT ? "\n✅ Committed." : "\n(DRY RUN — pass --commit to apply)");
