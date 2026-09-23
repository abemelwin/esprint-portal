/**
 * Cognito Admin API helper (server-side only).
 *
 * Used by the Admin & Users page to list/create/update/disable users in the
 * Cognito user pool. These are admin-level operations that require AWS
 * credentials with Cognito permissions.
 *
 * Credentials resolution:
 *   - If AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are set in env, use them.
 *   - Otherwise, fall back to the default provider chain (Amplify/EC2 IAM role).
 *
 * Portal user data is stored in Cognito custom attributes:
 *   custom:portal_role  -> "super_admin" | "user"
 *   custom:access       -> JSON string of ModuleAccess[]
 * plus standard: email, name, sub.
 */
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import type { ModuleAccess } from "./rbac";

const REGION = process.env.COGNITO_REGION;
const POOL_ID = process.env.COGNITO_USER_POOL_ID;

let client: CognitoIdentityProviderClient | null = null;
function getAdminClient(): CognitoIdentityProviderClient {
  if (client) return client;
  // In production (Amplify SSR compute), rely on the attached compute role via
  // the default provider chain. Only use explicit static keys for LOCAL dev,
  // gated behind AWS_USE_STATIC_KEYS=true so stale/invalid AWS_* env vars that
  // may linger in the Amplify runtime never override the compute role.
  const useStatic =
    process.env.AWS_USE_STATIC_KEYS === "true" &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY;
  client = new CognitoIdentityProviderClient({
    region: REGION,
    ...(useStatic
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        }
      : {}),
  });
  return client;
}

export interface AdminUser {
  username:   string;
  email:      string;
  fullName:   string;
  portalRole: "super_admin" | "user";
  access:     ModuleAccess[];
  enabled:    boolean;
  status:     string;
  createdAt:  string | null;
}

function attr(u: UserType, name: string): string {
  return (u.Attributes ?? []).find((a) => a.Name === name)?.Value ?? "";
}

function toAdminUser(u: UserType): AdminUser {
  let access: ModuleAccess[] = [];
  try { const raw = attr(u, "custom:access"); access = raw ? JSON.parse(raw) : []; } catch { access = []; }
  return {
    username:   u.Username ?? "",
    email:      attr(u, "email"),
    fullName:   attr(u, "name") || attr(u, "email"),
    portalRole: (attr(u, "custom:portal_role") as "super_admin" | "user") || "user",
    access,
    enabled:    u.Enabled ?? true,
    status:     u.UserStatus ?? "",
    createdAt:  u.UserCreateDate ? u.UserCreateDate.toISOString() : null,
  };
}

/** List every user in the pool (paginated). */
export async function listCognitoUsers(): Promise<AdminUser[]> {
  const all: AdminUser[] = [];
  let token: string | undefined;
  do {
    const res = await getAdminClient().send(
      new ListUsersCommand({ UserPoolId: POOL_ID, Limit: 60, PaginationToken: token })
    );
    for (const u of res.Users ?? []) all.push(toAdminUser(u));
    token = res.PaginationToken;
  } while (token);
  return all;
}

/** Create a new user with a temporary password and portal attributes. */
export async function createCognitoUser(opts: {
  email: string;
  fullName: string;
  portalRole: "super_admin" | "user";
  access: ModuleAccess[];
  tempPassword: string;
  permanent?: boolean;
}): Promise<void> {
  await getAdminClient().send(
    new AdminCreateUserCommand({
      UserPoolId: POOL_ID,
      Username: opts.email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: opts.email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: opts.fullName },
        { Name: "custom:portal_role", Value: opts.portalRole },
        { Name: "custom:access", Value: JSON.stringify(opts.access) },
      ],
    })
  );
  await getAdminClient().send(
    new AdminSetUserPasswordCommand({
      UserPoolId: POOL_ID,
      Username: opts.email,
      Password: opts.tempPassword,
      Permanent: opts.permanent ?? false,
    })
  );
}

/** Update a user's name / portal role / module access. */
export async function updateCognitoUser(opts: {
  username: string;
  fullName?: string;
  portalRole?: "super_admin" | "user";
  access?: ModuleAccess[];
}): Promise<void> {
  const attrs = [];
  if (opts.fullName !== undefined)   attrs.push({ Name: "name", Value: opts.fullName });
  if (opts.portalRole !== undefined) attrs.push({ Name: "custom:portal_role", Value: opts.portalRole });
  if (opts.access !== undefined)     attrs.push({ Name: "custom:access", Value: JSON.stringify(opts.access) });
  if (!attrs.length) return;
  await getAdminClient().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: POOL_ID,
      Username: opts.username,
      UserAttributes: attrs,
    })
  );
}

/** Reset a user's password. Pass permanent=true to set it without forced change. */
export async function resetCognitoPassword(username: string, tempPassword: string, permanent = false): Promise<void> {
  await getAdminClient().send(
    new AdminSetUserPasswordCommand({
      UserPoolId: POOL_ID, Username: username, Password: tempPassword, Permanent: permanent,
    })
  );
}

/** Disable (soft-lock) or enable a user. */
export async function setCognitoUserEnabled(username: string, enabled: boolean): Promise<void> {
  await getAdminClient().send(
    enabled
      ? new AdminEnableUserCommand({ UserPoolId: POOL_ID, Username: username })
      : new AdminDisableUserCommand({ UserPoolId: POOL_ID, Username: username })
  );
}

/** Permanently delete a user. */
export async function deleteCognitoUser(username: string): Promise<void> {
  await getAdminClient().send(
    new AdminDeleteUserCommand({ UserPoolId: POOL_ID, Username: username })
  );
}
