/**
 * test-one-cognito-user.mjs
 *
 * Creates ONE test user (Eileen, the super admin) in Cognito to confirm
 * the pool is set up correctly — especially the custom attributes
 * (custom:portal_role, custom:access). If this succeeds, the full
 * migration will work. If the custom attributes are missing, this fails
 * loudly with a clear message.
 *
 * Safe to re-run: if the user already exists it just reports that.
 *
 * Usage: node scripts/test-one-cognito-user.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  UsernameExistsException,
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
const REGION = env.COGNITO_REGION;
const POOL_ID = env.COGNITO_USER_POOL_ID;

const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const email = "eileensokua@esprintmedia.com";
const tempPw = "EsPrint2026!Temp";

console.log(`\nTesting Cognito setup by creating: ${email}\n`);

try {
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: POOL_ID,
      Username: email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: "Eileen So Kua" },
        { Name: "custom:portal_role", Value: "super_admin" },
        { Name: "custom:access", Value: "[]" },
      ],
    })
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: POOL_ID,
      Username: email,
      Password: tempPw,
      Permanent: false,
    })
  );
  console.log("SUCCESS — Cognito is set up correctly. Custom attributes work.");
  console.log(`Eileen created. Temp password: ${tempPw}`);
  console.log("She will be asked to set a new password on first login.");
  console.log("\nThe full migration is ready to run.");
} catch (err) {
  if (err instanceof UsernameExistsException) {
    console.log("Eileen already exists in Cognito — that's fine.");
    console.log("Cognito is reachable. If she was created by an earlier run,");
    console.log("the setup is working.");
  } else if (
    String(err.message || "").toLowerCase().includes("custom") ||
    err.name === "InvalidParameterException"
  ) {
    console.log("FAILED — likely the custom attributes are missing.");
    console.log("Error:", err.name, "-", err.message);
    console.log("\nFIX: In Cognito > your user pool > Sign-up experience >");
    console.log("Custom attributes, add: portal_role (String) and");
    console.log("access (String, max 2048). Then re-run this test.");
  } else {
    console.log("FAILED:", err.name, "-", err.message);
  }
}
