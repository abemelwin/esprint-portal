/**
 * migrate-sales-users.mjs
 *
 * Creates / updates Cognito users for the Sales Portal module.
 * Source: Sales Portal/supabase/seed-users.sql (email + role pairs).
 *
 * For each user:
 *   - If the user ALREADY EXISTS in Cognito → adds the "sales" module access
 *     to their existing custom:access attribute (preserves checks module access).
 *   - If the user DOES NOT EXIST → creates a new Cognito user with:
 *       • temp password: ESpmi2026!   (must change on first login)
 *       • portal_role: "user"
 *       • custom:access: sales module entry
 *
 * DRY RUN by default. Pass --commit to apply.
 * Pass --force-existing to also update already-correct existing users.
 *
 * Role mapping (orig Sales Portal role → portal sales access role):
 *   sales_admin_manager     → "sales_admin_manager"
 *   sales_admin_supervisor  → "sales_admin_supervisor"
 *   sales_admin             → "sales_admin_assistant"
 *   area_sales_manager      → "area_sales_manager"
 *   account_executive       → "account_executive"
 *   sales_assistant         → "sales_assistant"
 *   superadmin / admin      → isModuleAdmin: true
 *
 * Usage:
 *   node scripts/migrate-sales-users.mjs              # dry run
 *   node scripts/migrate-sales-users.mjs --commit     # apply
 */
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const COMMIT     = process.argv.includes("--commit");
const ORIG_DIR   = path.resolve(__dirname, "../../Sales Portal");

// ── Load env ─────────────────────────────────────────────────────────────────
const readEnv = (p) => Object.fromEntries(
  fs.readFileSync(p, "utf8").split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const env = readEnv(path.resolve(__dirname, "../.env.local"));
const POOL_ID   = env.COGNITO_USER_POOL_ID;
const REGION    = env.COGNITO_REGION;
const TEMP_PASS = "ESpmi2026!";

const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Parse seed-users.sql ─────────────────────────────────────────────────────
const sql = fs.readFileSync(path.join(ORIG_DIR, "supabase/seed-users.sql"), "utf8");
const userRows = [];
// Also parse seed-pm-users.sql (product manager / superadmin)
let pmSql = "";
try { pmSql = fs.readFileSync(path.join(ORIG_DIR, "supabase/seed-pm-users.sql"), "utf8"); } catch {}

for (const src of [sql, pmSql]) {
  const re = /INSERT INTO user_profiles[^)]+\)\s*VALUES\s*\([^,]+,\s*'([^']+)',\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    userRows.push({ email: m[1].trim().toLowerCase(), role: m[2].trim() });
  }
}

// De-dup by email (keep first occurrence)
const seen = new Set();
const users = userRows.filter(u => {
  if (seen.has(u.email)) return false;
  seen.add(u.email); return true;
});

console.log(`Found ${users.length} sales users in seed files`);
if (!COMMIT) console.log("(DRY RUN — pass --commit to apply)\n");

// ── Role → portal module access entry ────────────────────────────────────────
function toModuleAccess(origRole) {
  const isAdmin = ["superadmin","admin","product_manager","sales_admin_manager","sales_admin_supervisor"].includes(origRole);
  const roleMap = {
    superadmin:             "Admin",
    admin:                  "Admin",
    product_manager:        "Admin",
    sales_admin_manager:    "sales_admin_manager",
    sales_admin_supervisor: "sales_admin_supervisor",
    sales_admin:            "sales_admin_assistant",
    sales_admin_assistant:  "sales_admin_assistant",
    area_sales_manager:     "area_sales_manager",
    account_executive:      "account_executive",
    sales_assistant:        "sales_assistant",
  };
  return {
    module: "sales",
    role: roleMap[origRole] ?? "account_executive",
    isModuleAdmin: isAdmin,
    branches: [],
    aes: [],
  };
}

// ── Get all Cognito users once (paginated) ────────────────────────────────────
console.log("Fetching Cognito user pool…");
const cognitoUserMap = new Map(); // email.lower → { Username, attributes{} }
let paginationToken = undefined;
do {
  const res = await cognito.send(new ListUsersCommand({
    UserPoolId: POOL_ID,
    Limit: 60,
    PaginationToken: paginationToken,
  }));
  for (const u of (res.Users ?? [])) {
    const attrs = Object.fromEntries((u.Attributes ?? []).map(a => [a.Name, a.Value]));
    const email = (attrs.email ?? "").toLowerCase();
    if (email) cognitoUserMap.set(email, { Username: u.Username, attrs });
  }
  paginationToken = res.PaginationToken;
} while (paginationToken);
console.log(`Cognito pool has ${cognitoUserMap.size} users\n`);

// ── Process each sales user ──────────────────────────────────────────────────
let created = 0, updated = 0, skipped = 0, errors = 0;

for (const { email, role } of users) {
  const salesAccess = toModuleAccess(role);
  const existing    = cognitoUserMap.get(email);

  if (existing) {
    // Check if sales access is already in their custom:access
    let currentAccess = [];
    try {
      const raw = existing.attrs["custom:access"];
      if (raw) currentAccess = JSON.parse(raw);
    } catch {}

    const alreadyHasSales = currentAccess.some(a => a.module === "sales");
    if (alreadyHasSales) {
      console.log(`  SKIP (already has sales)  ${email}`);
      skipped++;
      continue;
    }

    // Add sales access to existing user
    const newAccess = [...currentAccess, salesAccess];
    console.log(`  UPDATE existing           ${email}  → add sales/${salesAccess.role}`);
    if (COMMIT) {
      try {
        await cognito.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: POOL_ID,
          Username: existing.Username,
          UserAttributes: [
            { Name: "custom:access", Value: JSON.stringify(newAccess) },
          ],
        }));
        updated++;
      } catch (err) {
        console.error(`    ERROR updating ${email}: ${err.message}`);
        errors++;
      }
    } else { updated++; }

  } else {
    // Create new Cognito user
    const displayName = email.split("@")[0]; // best-effort name
    const accessJson  = JSON.stringify([salesAccess]);
    console.log(`  CREATE new                ${email}  role=${salesAccess.role}`);
    if (COMMIT) {
      try {
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId:        POOL_ID,
          Username:          email,
          TemporaryPassword: TEMP_PASS,
          MessageAction:     "SUPPRESS", // don't send welcome email via Cognito
          UserAttributes: [
            { Name: "email",                    Value: email },
            { Name: "email_verified",           Value: "true" },
            { Name: "name",                     Value: displayName },
            { Name: "custom:portal_role",       Value: "user" },
            { Name: "custom:access",            Value: accessJson },
          ],
        }));
        created++;
      } catch (err) {
        if (err.name === "UsernameExistsException") {
          console.log(`    Already exists (race) — skipping`);
          skipped++;
        } else {
          console.error(`    ERROR creating ${email}: ${err.message}`);
          errors++;
        }
      }
    } else { created++; }
  }
}

console.log(`\n${COMMIT ? "" : "(DRY RUN) "}Summary:`);
console.log(`  Would create:  ${created}`);
console.log(`  Would update:  ${updated}`);
console.log(`  Skip (exists): ${skipped}`);
console.log(`  Errors:        ${errors}`);
if (!COMMIT) console.log("\nRun with --commit to apply.");
