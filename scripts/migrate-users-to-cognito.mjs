/**
 * migrate-users-to-cognito.mjs
 *
 * Migrates all Check Monitoring users from the old Supabase project
 * into the new AWS Cognito user pool.
 *
 * What it does per user:
 *   - Reads role / branches / aes / full_name from Supabase user_metadata
 *   - Maps the 14-role model onto the portal's two-level RBAC:
 *       "Super Admin"  -> portal_role = super_admin  (no module access needed)
 *       anything else  -> portal_role = user, with a Check Monitoring
 *                         module-access entry carrying the same role/branches/aes
 *   - Creates the user in Cognito via AdminCreateUser with:
 *       email (verified), a temporary password,
 *       custom:portal_role and custom:access (JSON)
 *   - Records the temp password so you can hand it to each person.
 *
 * SAFETY:
 *   - Skips dev/test accounts (*@test.local).
 *   - Skips users that already exist in Cognito (safe to re-run).
 *   - DRY RUN by default. Add --commit to actually create users.
 *
 * Config (from esprint-portal/.env.local):
 *   COGNITO_REGION, COGNITO_USER_POOL_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * Supabase source (from ../esprint-check-monitoring/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/migrate-users-to-cognito.mjs            # dry run (no changes)
 *   node scripts/migrate-users-to-cognito.mjs --commit   # actually create users
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");

// ── Load env files ──
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

const REGION = portalEnv.COGNITO_REGION;
const POOL_ID = portalEnv.COGNITO_USER_POOL_ID;
const ACCESS_KEY = portalEnv.AWS_ACCESS_KEY_ID;
const SECRET_KEY = portalEnv.AWS_SECRET_ACCESS_KEY;
const SUPABASE_URL = cmEnv.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = cmEnv.SUPABASE_SERVICE_ROLE_KEY;

for (const [k, v] of Object.entries({
  COGNITO_REGION: REGION,
  COGNITO_USER_POOL_ID: POOL_ID,
  AWS_ACCESS_KEY_ID: ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY: SECRET_KEY,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
})) {
  if (!v) {
    console.error(`Missing config: ${k}. Fill it in the relevant .env.local.`);
    process.exit(1);
  }
}

// ── Fetch users from Supabase ──
async function listSupabaseUsers() {
  const all = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) {
      console.error("Supabase error:", res.status, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    const users = data.users ?? data;
    if (!users.length) break;
    all.push(...users);
    if (users.length < 1000) break;
    page += 1;
  }
  return all;
}

// The ONLY portal-wide super admin. Everyone else (including people who
// were "Super Admin" in the old Check Monitoring system) becomes a normal
// portal user with module-level access.
const PORTAL_SUPER_ADMIN = "eileensokua@esprintmedia.com";

// ── Role mapping: 14-role model -> portal two-level RBAC ──
function mapUser(email, meta) {
  const role = meta.role ?? "";
  const isPortalSuper = email.toLowerCase() === PORTAL_SUPER_ADMIN;

  const portalRole = isPortalSuper ? "super_admin" : "user";

  // The portal super admin sees everything, so needs no module access entry.
  if (isPortalSuper) return { portalRole, access: [] };

  // Old "Super Admin" users (other than Eileen) have no equivalent module
  // role, so map them to Check Monitoring "Admin" (module-level admin).
  const moduleRole = role === "Super Admin" ? "Admin" : role;

  const access = [
    {
      module: "checks",
      role: moduleRole,
      isModuleAdmin: ["Admin", "Operations", "Acctg Head", "AR Manager"].includes(moduleRole),
      branches: Array.isArray(meta.branches) ? meta.branches : [],
      aes: Array.isArray(meta.aes) ? meta.aes : [],
    },
  ];

  return { portalRole, access };
}

// ── Temp password generator (meets Cognito default policy) ──
function tempPassword() {
  // 12 chars: upper, lower, digit, symbol guaranteed.
  const pick = (set) => set[crypto.randomInt(set.length)];
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const L = "abcdefghijkmnpqrstuvwxyz";
  const D = "23456789";
  const S = "!@#$%^&*";
  const rest = U + L + D;
  let pw = pick(U) + pick(L) + pick(D) + pick(S);
  for (let i = 0; i < 8; i++) pw += pick(rest);
  return pw
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
}

// ── Main ──
const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const supaUsers = await listSupabaseUsers();
const real = supaUsers.filter((u) => u.email && !u.email.endsWith("@test.local"));

console.log(
  `\n${COMMIT ? "COMMIT" : "DRY RUN"} — ${real.length} users to migrate ` +
    `(${supaUsers.length - real.length} test accounts skipped)\n`
);

const created = [];
const skipped = [];
const failed = [];

for (const u of real) {
  const meta = u.user_metadata ?? {};
  const { portalRole, access } = mapUser(u.email, meta);
  const fullName = meta.full_name ?? meta.name ?? u.email;

  if (!COMMIT) {
    console.log(
      `[dry] ${u.email.padEnd(38)} ${portalRole.padEnd(11)} ` +
        `${(meta.role ?? "").padEnd(24)} branches=${(meta.branches ?? []).length} aes=${(meta.aes ?? []).length}`
    );
    continue;
  }

  const pw = tempPassword();
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: u.email,
        MessageAction: "SUPPRESS", // we distribute passwords ourselves
        UserAttributes: [
          { Name: "email", Value: u.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: fullName },
          { Name: "custom:portal_role", Value: portalRole },
          { Name: "custom:access", Value: JSON.stringify(access) },
        ],
      })
    );
    // Set the temp password (user must change on first login).
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: POOL_ID,
        Username: u.email,
        Password: pw,
        Permanent: false,
      })
    );
    created.push({ email: u.email, name: fullName, portalRole, tempPassword: pw });
    console.log(`  ok   ${u.email}`);
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      skipped.push(u.email);
      console.log(`  skip ${u.email} (already exists)`);
    } else {
      failed.push({ email: u.email, error: err.name || String(err) });
      console.log(`  FAIL ${u.email}: ${err.name || err}`);
    }
  }
}

if (COMMIT) {
  // Write temp passwords to a CSV so you can distribute them.
  const outPath = path.resolve(__dirname, "..", "migrated-users-passwords.csv");
  const rows = [
    "email,full_name,portal_role,temp_password",
    ...created.map(
      (c) => `${c.email},"${c.name}",${c.portalRole},${c.tempPassword}`
    ),
  ];
  fs.writeFileSync(outPath, rows.join("\n"), "utf8");

  console.log(
    `\nDone. created=${created.length} skipped=${skipped.length} failed=${failed.length}`
  );
  console.log(`Temp passwords written to: ${outPath}`);
  console.log("KEEP THIS FILE PRIVATE. Delete it after distributing passwords.");
  if (failed.length) console.log("Failures:", failed);
} else {
  console.log("\nDry run complete. No changes made. Re-run with --commit to migrate.");
}
