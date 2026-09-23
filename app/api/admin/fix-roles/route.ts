/**
 * ONE-TIME endpoint to fix super admin accounts.
 * DELETE after use.
 *
 * GET /api/admin/fix-roles?secret=ESpmi2026!
 *
 * Actions:
 *   - beverly@esprintmedia.com    → user / Admin role
 *   - chepieteng@esprintmedia.com → user / Admin role
 *   - melwin@esprintmedia.com     → super_admin
 *   - dev-super@test.local        → deleted
 */
import { NextRequest, NextResponse } from "next/server";
import {
  updateCognitoUser,
  deleteCognitoUser,
} from "@/lib/cognito-admin";
import type { ModuleAccess } from "@/lib/rbac";

const ADMIN_ACCESS: ModuleAccess[] = [{
  module: "checks", role: "Admin", isModuleAdmin: true, branches: [], aes: [],
}];

export async function GET(req: NextRequest) {
  // Simple secret guard so this can't be called accidentally
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "ESpmi2026!") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, string> = {};

  try {
    await updateCognitoUser({ username: "beverly@esprintmedia.com", portalRole: "user", access: ADMIN_ACCESS });
    results["beverly@esprintmedia.com"] = "✅ downgraded to user/Admin";
  } catch (e) { results["beverly@esprintmedia.com"] = `❌ ${(e as Error).message}`; }

  try {
    await updateCognitoUser({ username: "chepieteng@esprintmedia.com", portalRole: "user", access: ADMIN_ACCESS });
    results["chepieteng@esprintmedia.com"] = "✅ downgraded to user/Admin";
  } catch (e) { results["chepieteng@esprintmedia.com"] = `❌ ${(e as Error).message}`; }

  try {
    await updateCognitoUser({ username: "melwin@esprintmedia.com", portalRole: "super_admin", access: [] });
    results["melwin@esprintmedia.com"] = "✅ upgraded to super_admin";
  } catch (e) { results["melwin@esprintmedia.com"] = `❌ ${(e as Error).message}`; }

  try {
    await deleteCognitoUser("dev-super@test.local");
    results["dev-super@test.local"] = "🗑 deleted";
  } catch (e) { results["dev-super@test.local"] = `❌ ${(e as Error).message}`; }

  return NextResponse.json({ ok: true, results });
}
