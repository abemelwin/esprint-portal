/**
 * verify-cognito-users.mjs  (READ-ONLY)
 *
 * Lists all users now in the Cognito pool and shows their portal_role
 * and Check Monitoring access (role / branch count / AE count), so we
 * can confirm the migration landed correctly. Makes no changes.
 *
 * Usage: node scripts/verify-cognito-users.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = readEnv(path.resolve(__dirname, "..", ".env.local"));
const cognito = new CognitoIdentityProviderClient({
  region: env.COGNITO_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const attr = (u, name) =>
  (u.Attributes ?? []).find((a) => a.Name === name)?.Value ?? "";

let token;
const all = [];
do {
  const res = await cognito.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Limit: 60,
      PaginationToken: token,
    })
  );
  all.push(...(res.Users ?? []));
  token = res.PaginationToken;
} while (token);

let superAdmins = 0;
let users = 0;
let noRole = 0;

console.log(`\nCognito pool has ${all.length} users.\n`);
console.log("EMAIL".padEnd(38), "PORTAL", "   ", "MODULE ROLE".padEnd(24), "BR/AE");
console.log("-".repeat(85));

for (const u of all) {
  const email = attr(u, "email");
  const portalRole = attr(u, "custom:portal_role") || "(none)";
  let access = [];
  try {
    access = JSON.parse(attr(u, "custom:access") || "[]");
  } catch {
    access = [];
  }
  const checks = access.find((a) => a.module === "checks");
  const mRole = checks?.role ?? (portalRole === "super_admin" ? "(all)" : "(none)");
  const br = checks?.branches?.length ?? 0;
  const ae = checks?.aes?.length ?? 0;

  if (portalRole === "super_admin") superAdmins += 1;
  else if (portalRole === "user") users += 1;
  else noRole += 1;

  console.log(
    email.padEnd(38),
    portalRole === "super_admin" ? "SUPER " : "user  ",
    "   ",
    String(mRole).padEnd(24),
    `${br}/${ae}`
  );
}

console.log("-".repeat(85));
console.log(
  `\nTotals: super_admin=${superAdmins}, user=${users}, missing_role=${noRole}`
);
console.log("(Expected: super_admin=1 (Eileen), the rest users, missing_role=0)");
console.log("\nRead-only — nothing was changed.");
