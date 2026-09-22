/**
 * list-supabase-users.mjs  (READ-ONLY)
 *
 * Lists all users from the old Check Monitoring Supabase project so we
 * can see who needs to be migrated to Cognito. Reads NOTHING but the
 * user directory; makes no changes anywhere.
 *
 * Config: reads Supabase URL + service-role key from the check-monitoring
 * .env.local (one level up from esprint-portal). Nothing is hardcoded.
 *
 * Usage:
 *   node scripts/list-supabase-users.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load the check-monitoring .env.local ──
const envPath = path.resolve(
  __dirname,
  "..",
  "..",
  "esprint-check-monitoring",
  ".env.local"
);

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = readEnv(envPath);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Could not find Supabase URL / service key in:", envPath);
  process.exit(1);
}

// ── Fetch users via the Supabase Admin API (paginated) ──
async function listUsers() {
  const all = [];
  let page = 1;
  const perPage = 1000;

  for (;;) {
    const url = `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!res.ok) {
      console.error("Supabase request failed:", res.status, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    const users = data.users ?? data;
    if (!users.length) break;
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

const users = await listUsers();

console.log(`\nFound ${users.length} user(s) in Supabase:\n`);
console.log("EMAIL".padEnd(40), "ROLE".padEnd(20), "NAME");
console.log("-".repeat(80));

for (const u of users) {
  const meta = u.user_metadata ?? {};
  const role = meta.role ?? meta.portal_role ?? "(none)";
  const name = meta.full_name ?? meta.name ?? "";
  console.log(String(u.email ?? "").padEnd(40), String(role).padEnd(20), name);
}

console.log("\nDone. This was read-only — nothing was changed.\n");
