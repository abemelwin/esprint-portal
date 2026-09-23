/**
 * Authentication layer — AWS Cognito.
 *
 * Responsibilities:
 *   - Verify Cognito JWT access tokens (server side).
 *   - Map Cognito user attributes/groups -> PortalUser (portal role,
 *     module access, per-module roles).
 *
 * Configuration (see .env.example):
 *   COGNITO_REGION           — e.g. ap-southeast-1
 *   COGNITO_USER_POOL_ID     — e.g. ap-southeast-1_xxxxxxxxx
 *   COGNITO_CLIENT_ID        — app client id
 *
 * When AWS is ready, plug these into .env.local. Until then, a DEV
 * bypass lets us build/test the portal with mock users.
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ChangePasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { PortalUser, ModuleAccess } from "./rbac";

const REGION = process.env.COGNITO_REGION;
const POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

/** Cached Cognito client. */
let cognito: CognitoIdentityProviderClient | null = null;
function getCognito(): CognitoIdentityProviderClient {
  if (cognito) return cognito;
  cognito = new CognitoIdentityProviderClient({ region: REGION });
  return cognito;
}

/**
 * Compute the SECRET_HASH required when the app client has a secret.
 * Returns undefined for public clients (no COGNITO_CLIENT_SECRET set),
 * in which case Cognito must NOT receive a SecretHash.
 */
function secretHash(username: string): string | undefined {
  if (!CLIENT_SECRET) return undefined;
  return crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest("base64");
}

export interface LoginResult {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Signals that the user must set a new password before they can log in.
 * Thrown for the Cognito NEW_PASSWORD_REQUIRED challenge (users created
 * by an admin with a temporary password hit this on first login).
 */
export class NewPasswordRequiredError extends Error {
  constructor(public session: string) {
    super("New password required");
    this.name = "NewPasswordRequiredError";
  }
}

/**
 * Authenticate a user against Cognito using USER_PASSWORD_AUTH.
 * Works with both public clients (no secret) and confidential clients
 * (SECRET_HASH added automatically when COGNITO_CLIENT_SECRET is set).
 */
export async function cognitoLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  const hash = secretHash(email);
  const res = await getCognito().send(
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
    throw new NewPasswordRequiredError(res.Session ?? "");
  }

  const r = res.AuthenticationResult;
  if (!r?.IdToken || !r.AccessToken) {
    throw new Error("Authentication failed");
  }
  return {
    idToken: r.IdToken,
    accessToken: r.AccessToken,
    refreshToken: r.RefreshToken,
    expiresIn: r.ExpiresIn ?? 3600,
  };
}

/**
 * Complete a NEW_PASSWORD_REQUIRED challenge (first login for an
 * admin-created user with a temporary password).
 */
export async function cognitoSetNewPassword(
  email: string,
  newPassword: string,
  session: string
): Promise<LoginResult> {
  const hash = secretHash(email);
  const res = await getCognito().send(
    new RespondToAuthChallengeCommand({
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: CLIENT_ID,
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        NEW_PASSWORD: newPassword,
        ...(hash ? { SECRET_HASH: hash } : {}),
      },
    })
  );

  const r = res.AuthenticationResult;
  if (!r?.IdToken || !r.AccessToken) {
    throw new Error("Failed to set new password");
  }
  return {
    idToken: r.IdToken,
    accessToken: r.AccessToken,
    refreshToken: r.RefreshToken,
    expiresIn: r.ExpiresIn ?? 3600,
  };
}

/**
 * Change a user's own password. Requires the user's current AccessToken
 * (returned by cognitoLogin) plus their old and new passwords.
 * Uses the Cognito ChangePassword API (user-initiated, not admin).
 */
export async function cognitoChangePassword(
  accessToken: string,
  previousPassword: string,
  proposedPassword: string
): Promise<void> {
  await getCognito().send(
    new ChangePasswordCommand({
      AccessToken:      accessToken,
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword,
    })
  );
}

/** Cached JWKS client for verifying Cognito token signatures. */
let jwks: JwksClient | null = null;
function getJwks(): JwksClient {
  if (jwks) return jwks;
  jwks = new JwksClient({
    jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
  });
  return jwks;
}

/** Verify a Cognito access/id token and return its decoded claims. */
export async function verifyToken(
  token: string
): Promise<Record<string, unknown>> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid token");
  }
  const kid = decoded.header.kid;
  if (!kid) throw new Error("Token missing kid");

  const key = await getJwks().getSigningKey(kid);
  const publicKey = key.getPublicKey();

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      { algorithms: ["RS256"] },
      (err, payload) => {
        if (err) return reject(err);
        resolve(payload as Record<string, unknown>);
      }
    );
  });
}

/**
 * Build a PortalUser from Cognito token claims.
 *
 * Cognito stores portal data in custom attributes:
 *   custom:portal_role   -> "super_admin" | "user"
 *   custom:access        -> JSON string of ModuleAccess[]
 * and standard claims: sub, email, name.
 */
export function userFromClaims(
  claims: Record<string, unknown>
): PortalUser {
  const access: ModuleAccess[] = parseAccess(
    claims["custom:access"] as string | undefined
  );

  return {
    id: String(claims.sub ?? ""),
    email: String(claims.email ?? ""),
    fullName: String(claims.name ?? claims.email ?? "User"),
    portalRole:
      (claims["custom:portal_role"] as "super_admin" | "user") ?? "user",
    access,
  };
}

function parseAccess(raw?: string): ModuleAccess[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── DEV BYPASS ───────────────────────────────────────────────────
// While AWS/Cognito is not yet configured, this lets us develop the
// portal with mock users. Controlled by AUTH_DEV_MODE=true in .env.
// REMOVE or set false once Cognito is wired.

export function isDevMode(): boolean {
  return process.env.AUTH_DEV_MODE === "true";
}

export const DEV_USERS: Record<string, PortalUser> = {
  "melwin@esprintmedia.com": {
    id: "dev-melwin",
    email: "melwin@esprintmedia.com",
    fullName: "Melwin",
    portalRole: "super_admin",
    access: [],
  },
  "admin@esprint.com": {
    id: "dev-admin",
    email: "admin@esprint.com",
    fullName: "Juan Dela Cruz",
    portalRole: "super_admin",
    access: [],
  },
  "checkadmin@esprint.com": {
    id: "dev-checkadmin",
    email: "checkadmin@esprint.com",
    fullName: "Pedro Reyes",
    portalRole: "user",
    access: [
      {
        module: "checks",
        role: "Admin",
        isModuleAdmin: true,
        branches: [],
        aes: [],
      },
    ],
  },
  "arstaff@esprint.com": {
    id: "dev-arstaff",
    email: "arstaff@esprint.com",
    fullName: "Maria Santos",
    portalRole: "user",
    access: [
      {
        module: "checks",
        role: "AR Staff",
        isModuleAdmin: false,
        branches: ["MAKATI"],
        aes: [],
      },
    ],
  },
};
