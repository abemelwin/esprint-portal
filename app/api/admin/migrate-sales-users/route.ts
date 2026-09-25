/**
 * POST /api/admin/migrate-sales-users
 *
 * One-time endpoint: creates / updates Cognito users for the Sales Portal module.
 * Fetches the actual active user list from the Sales Portal Supabase project
 * (user_profiles_with_email view) and mirrors them into this Cognito pool.
 *
 * For each user:
 *   - Already in Cognito WITHOUT sales access → adds sales module access
 *   - Already in Cognito WITH sales access    → skips
 *   - Not yet in Cognito                      → creates with temp password ESpmi2026!
 *
 * Protected by SYNC_SECRET header (same as /api/admin/sync).
 * DELETE this file after use.
 *
 * Usage:
 *   curl -X POST https://<portal>/api/admin/migrate-sales-users \
 *     -H "x-sync-secret: sync-esprint-2026"
 */
import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "sync-esprint-2026";
const POOL_ID     = process.env.COGNITO_USER_POOL_ID!;
const REGION      = process.env.COGNITO_REGION!;
const SB_URL      = process.env.SALES_PORTAL_SUPABASE_URL  ?? "https://zujxmjnuushqnplakryg.supabase.co";
const SB_KEY      = process.env.SALES_PORTAL_SERVICE_KEY;
const TEMP_PASS   = "ESpmi2026!";

// ── Role mapping: orig Sales Portal role → portal sales module access ──────
const ROLE_MAP: Record<string, { role: string; isAdmin: boolean }> = {
  superadmin:                  { role: "Admin",                 isAdmin: true  },
  product_manager:             { role: "Admin",                 isAdmin: true  },
  sales_admin_manager:         { role: "sales_admin_manager",   isAdmin: true  },
  sales_admin_supervisor:      { role: "sales_admin_supervisor", isAdmin: false },
  sales_admin_assistant:       { role: "sales_admin_assistant", isAdmin: false },
  sales_admin:                 { role: "sales_admin_assistant", isAdmin: false },
  area_sales_manager:          { role: "area_sales_manager",    isAdmin: false },
  account_executive:           { role: "account_executive",     isAdmin: false },
  sales_assistant:             { role: "sales_assistant",       isAdmin: false },
  product_development_manager: { role: "product_manager",       isAdmin: false },
  product_technical_head:      { role: "product_manager",       isAdmin: false },
  service_manager:             { role: "service_manager",       isAdmin: false },
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SB_KEY) {
    return NextResponse.json({
      error: "SALES_PORTAL_SERVICE_KEY env var is not set. Add it to Amplify environment variables.",
    }, { status: 500 });
  }

  // ── 1. Fetch active sales users from Supabase ──────────────────────────
  const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const sbRes = await fetch(
    `${SB_URL}/rest/v1/user_profiles_with_email?select=user_id,email,display_name,role,is_active,is_sp_member&is_active=eq.true&limit=500`,
    { headers: H }
  );
  if (!sbRes.ok) {
    return NextResponse.json({ error: `Supabase fetch failed: ${sbRes.status}` }, { status: 500 });
  }
  const sbUsers: any[] = await sbRes.json();
  // Filter: only sp_members (sales portal users), exclude test accounts
  const salesUsers = sbUsers.filter(
    u => u.email && !u.email.includes("@test.local") && u.is_sp_member !== false
  );

  // ── 2. Fetch all Cognito users (paginated) ──────────────────────────────
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  const cognitoMap = new Map<string, { Username: string; access: any[] }>();
  let paginationToken: string | undefined;
  do {
    const res = await cognito.send(new ListUsersCommand({
      UserPoolId: POOL_ID,
      Limit: 60,
      PaginationToken: paginationToken,
    }));
    for (const u of (res.Users ?? [])) {
      const attrs = Object.fromEntries((u.Attributes ?? []).map((a) => [a.Name!, a.Value!]));
      const email = (attrs.email ?? "").toLowerCase();
      let access: any[] = [];
      try { if (attrs["custom:access"]) access = JSON.parse(attrs["custom:access"]); } catch {}
      if (email) cognitoMap.set(email, { Username: u.Username!, access });
    }
    paginationToken = res.PaginationToken;
  } while (paginationToken);

  // ── 3. Create / update each sales user in Cognito ──────────────────────
  const results = {
    total: salesUsers.length,
    created: 0, updated: 0, skipped: 0,
    errors: [] as string[],
  };

  for (const u of salesUsers) {
    const email       = (u.email as string).toLowerCase();
    const displayName = (u.display_name as string) || email.split("@")[0];
    const origRole    = (u.role as string) || "account_executive";
    const rm          = ROLE_MAP[origRole] ?? ROLE_MAP["account_executive"];

    const salesEntry = {
      module: "sales",
      role: rm.role,
      isModuleAdmin: rm.isAdmin,
      branches: [],
      aes: [],
    };

    const existing = cognitoMap.get(email);
    if (existing) {
      const alreadyHasSales = existing.access.some((a) => a.module === "sales");
      if (alreadyHasSales) { results.skipped++; continue; }

      const newAccess = [...existing.access, salesEntry];
      try {
        await cognito.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: POOL_ID,
          Username: existing.Username,
          UserAttributes: [
            { Name: "custom:access", Value: JSON.stringify(newAccess) },
          ],
        }));
        results.updated++;
      } catch (err: any) {
        results.errors.push(`update ${email}: ${err.message}`);
      }
    } else {
      // New user — create with temp password, must change on first login
      try {
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId: POOL_ID,
          Username: email,
          TemporaryPassword: TEMP_PASS,
          MessageAction: "SUPPRESS", // don't send Cognito's default invite email
          UserAttributes: [
            { Name: "email",              Value: email },
            { Name: "email_verified",     Value: "true" },
            { Name: "name",               Value: displayName },
            { Name: "custom:portal_role", Value: "user" },
            { Name: "custom:access",      Value: JSON.stringify([salesEntry]) },
          ],
        }));
        results.created++;
      } catch (err: any) {
        if (err.name === "UsernameExistsException") {
          results.skipped++;
        } else {
          results.errors.push(`create ${email}: ${err.message}`);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    message: `Migration complete: created=${results.created}, updated=${results.updated}, skipped=${results.skipped}, errors=${results.errors.length}`,
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
}
