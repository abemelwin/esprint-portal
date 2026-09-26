/**
 * POST /api/admin/fix-sales-roles
 *
 * One-time endpoint: corrects the sales role stored in Cognito custom:access
 * for all users whose role was incorrectly mapped by the original migration.
 *
 * Incorrect mappings from original migration ROLE_MAP:
 *   product_development_manager → stored as "product_manager"  (should be "product_development_manager")
 *   product_technical_head      → stored as "product_manager"  (should be "product_technical_head")
 *   service_manager             → stored as "service_manager"  ✓ correct already
 *   superadmin                  → stored as "Admin"            ✓ correct (keep as Admin)
 *
 * Source of truth: Supabase user list (via .sales-users-from-supabase.json or live fetch)
 * Uses: SYNC_SECRET for auth, Amplify compute role for Cognito
 *
 * DELETE this file after use.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "sync-esprint-2026";
const POOL_ID     = process.env.COGNITO_USER_POOL_ID!;
const REGION      = process.env.COGNITO_REGION ?? "ap-southeast-1";
const SB_URL      = "https://zujxmjnuushqnplakryg.supabase.co";
const SB_KEY      = process.env.SALES_PORTAL_SERVICE_KEY;

// Correct role mapping: supabase role → portal sales role
const ROLE_MAP: Record<string, string> = {
  superadmin:                  "Admin",
  product_manager:             "Admin",
  sales_admin_manager:         "sales_admin_manager",
  sales_admin_supervisor:      "sales_admin_supervisor",
  sales_admin_assistant:       "sales_admin_assistant",
  sales_admin:                 "sales_admin_assistant",
  area_sales_manager:          "area_sales_manager",
  account_executive:           "account_executive",
  sales_assistant:             "sales_assistant",
  product_development_manager: "product_development_manager",
  product_technical_head:      "product_technical_head",
  service_manager:             "service_manager",
  product_development_manager2: "product_development_manager",
};

const ADMIN_ROLES = new Set(["Admin", "sales_admin_manager"]);

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SB_KEY) {
    return NextResponse.json({ error: "SALES_PORTAL_SERVICE_KEY not set" }, { status: 500 });
  }

  // 1. Fetch correct roles from Supabase
  const sbRes = await fetch(
    `${SB_URL}/rest/v1/user_profiles_with_email?select=email,role,display_name&is_active=eq.true&limit=500`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  if (!sbRes.ok) {
    return NextResponse.json({ error: `Supabase fetch failed: ${sbRes.status}` }, { status: 500 });
  }
  const sbUsers: { email: string; role: string; display_name: string }[] = await sbRes.json();

  // Build email → correct portal role map
  const correctRoles = new Map<string, string>();
  for (const u of sbUsers) {
    if (!u.email) continue;
    const email = u.email.toLowerCase().trim();
    const correctRole = ROLE_MAP[u.role] ?? "account_executive";
    correctRoles.set(email, correctRole);
  }

  // 2. Fetch all Cognito users
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  const cognitoUsers: { Username: string; email: string; access: any[] }[] = [];
  let token: string | undefined;
  do {
    const res = await cognito.send(new ListUsersCommand({
      UserPoolId: POOL_ID, Limit: 60, PaginationToken: token,
    }));
    for (const u of res.Users ?? []) {
      const attrs = Object.fromEntries((u.Attributes ?? []).map(a => [a.Name, a.Value]));
      const email = (attrs.email ?? "").toLowerCase();
      if (!email) continue;
      let access = [];
      try { access = JSON.parse(attrs["custom:access"] ?? "[]"); } catch {}
      cognitoUsers.push({ Username: u.Username!, email, access });
    }
    token = res.PaginationToken;
  } while (token);

  // 3. Fix each user whose sales role is wrong
  let fixed = 0, skipped = 0, notInSB = 0;
  const errors: string[] = [];

  for (const cu of cognitoUsers) {
    const correctRole = correctRoles.get(cu.email);
    if (!correctRole) { notInSB++; continue; }

    const salesIdx = cu.access.findIndex((a: any) => a.module === "sales");
    if (salesIdx < 0) { skipped++; continue; }

    const currentRole = cu.access[salesIdx].role;
    if (currentRole === correctRole) { skipped++; continue; }

    // Role is wrong — fix it
    const newAccess = [...cu.access];
    newAccess[salesIdx] = {
      ...newAccess[salesIdx],
      role: correctRole,
      isModuleAdmin: ADMIN_ROLES.has(correctRole),
    };

    try {
      await cognito.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: POOL_ID,
        Username: cu.Username,
        UserAttributes: [
          { Name: "custom:access", Value: JSON.stringify(newAccess) },
        ],
      }));
      fixed++;
    } catch (err: any) {
      errors.push(`${cu.email}: ${err.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Fixed ${fixed} users, skipped ${skipped} (already correct), ${notInSB} not in Supabase`,
    errors: errors.length ? errors : undefined,
  });
}
