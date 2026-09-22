/**
 * set-default-password.mjs
 *
 * Sets ONE shared temporary password for every migrated Cognito user,
 * instead of individual random passwords. The password is temporary:
 * each user is forced to set their own on first login.
 *
 * It reads the migrated user list from migrated-users-passwords.csv
 * (produced by the migration) so it only touches users we created.
 *
 * SAFETY:
 *   - DRY RUN by default. Add --commit to actually apply.
 *   - Only sets passwords for users listed in the CSV.
 *
 * Usage:
 *   node scripts/set-default-password.mjs            # dry run
 *   node scripts/set-default-password.mjs --commit   # apply
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");

// ── The shared temporary password everyone gets ──
const DEFAULT_PASSWORD = "Esprint2026!";

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = readEnv(path.resolve(__dirname, "..", ".env.local"));
const REGION = env.COGNITO_REGION;
const POOL_ID = env.COGNITO_USER_POOL_ID;

// ── Read the migrated users list ──
const csvPath = path.resolve(__dirname, "..", "migrated-users-passwords.csv");
if (!fs.existsSync(csvPath)) {
  console.error("Cannot find migrated-users-passwords.csv. Run the migration first.");
  process.exit(1);
}
const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).slice(1).filter(Boolean);
const emails = lines.map((l) => l.split(",")[0]).filter(Boolean);

// Eileen was migrated in the test step (not in the CSV); include her too.
if (!emails.includes("eileensokua@esprintmedia.com")) {
  emails.push("eileensokua@esprintmedia.com");
}

console.log(
  `\n${COMMIT ? "COMMIT" : "DRY RUN"} — set password "${DEFAULT_PASSWORD}" ` +
    `(temporary) for ${emails.length} users\n`
);

if (!COMMIT) {
  emails.forEach((e) => console.log(`  [dry] ${e}`));
  console.log("\nDry run complete. Re-run with --commit to apply.");
  process.exit(0);
}

const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

let ok = 0;
const failed = [];
for (const email of emails) {
  try {
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: POOL_ID,
        Username: email,
        Password: DEFAULT_PASSWORD,
        Permanent: false, // temporary — user must change on first login
      })
    );
    ok += 1;
    console.log(`  ok   ${email}`);
  } catch (err) {
    failed.push({ email, error: err.name || String(err) });
    console.log(`  FAIL ${email}: ${err.name || err}`);
  }
}

console.log(`\nDone. updated=${ok} failed=${failed.length}`);
console.log(`\nShared temporary password: ${DEFAULT_PASSWORD}`);
console.log("Tell users this password; they will be asked to change it on first login.");
if (failed.length) console.log("Failures:", failed);
