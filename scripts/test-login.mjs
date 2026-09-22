/**
 * test-login.mjs
 *
 * Tests a real Cognito login end-to-end using the same USER_PASSWORD_AUTH
 * flow the portal uses, including SECRET_HASH (since the app client has a
 * secret). Confirms the client id/secret and auth flow are all correct.
 *
 * Uses Eileen + the shared temp password. Because it's a temporary
 * password, Cognito responds with NEW_PASSWORD_REQUIRED — which is the
 * EXPECTED, correct result (proves credentials + config are valid).
 *
 * Usage: node scripts/test-login.mjs
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
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
const CLIENT_ID = env.COGNITO_CLIENT_ID;
const CLIENT_SECRET = env.COGNITO_CLIENT_SECRET;

const email = "eileensokua@esprintmedia.com";
const password = "Esprint2026!";

function secretHash(username) {
  if (!CLIENT_SECRET) return undefined;
  return crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest("base64");
}

const cognito = new CognitoIdentityProviderClient({ region: env.COGNITO_REGION });

console.log(`\nAttempting Cognito login as ${email}...\n`);

try {
  const hash = secretHash(email);
  const res = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        ...(hash ? { SECRET_HASH: hash } : {}),
      },
    })
  );

  if (res.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    console.log("SUCCESS (expected challenge): NEW_PASSWORD_REQUIRED");
    console.log("This means credentials + client config are CORRECT.");
    console.log("On the real login page, the user will be asked to set a new password.");
  } else if (res.AuthenticationResult?.IdToken) {
    console.log("SUCCESS: logged in and received tokens (password was already permanent).");
  } else {
    console.log("Unexpected response:", JSON.stringify(res, null, 2));
  }
} catch (err) {
  console.log("LOGIN FAILED:", err.name, "-", err.message);
  if (err.name === "NotAuthorizedException") {
    console.log("→ Wrong password, or SECRET_HASH mismatch (check client secret).");
  } else if (err.name === "InvalidParameterException") {
    console.log("→ USER_PASSWORD_AUTH may not be enabled on the app client.");
  }
}
