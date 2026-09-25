/**
 * /api/sales/users
 *   GET   — list all Cognito users that have sales module access
 *   PATCH — update a user's sales role / permission overrides / name
 *           or reset password (admin_reset)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import {
  listCognitoUsers,
  updateCognitoUser,
  resetCognitoPassword,
} from "@/lib/cognito-admin";
import type { ModuleAccess } from "@/lib/rbac";

async function requireSalesAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const perms = getSalesPermissions(user);
  if (!perms.canManageUsers) {
    return { ok: false as const, res: NextResponse.json({ error: "Sales admin only" }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export async function GET() {
  const guard = await requireSalesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const allUsers = await listCognitoUsers();
    // Filter to only users with sales module access
    const salesUsers = allUsers.filter(u => {
      try {
        const access: ModuleAccess[] = JSON.parse((u.access as unknown as string) || "[]");
        return access.some(a => a.module === "sales");
      } catch { return false; }
    });
    return NextResponse.json({ ok: true, users: salesUsers });
  } catch (err) {
    console.error("GET /api/sales/users error:", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireSalesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const body = await req.json();
    const { username, action } = body;
    if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

    if (action === "reset_password") {
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      await resetCognitoPassword(username, newPassword);
      return NextResponse.json({ ok: true });
    }

    // Update sales module role/permissions in custom:access
    if (body.salesRole !== undefined || body.salesPerms !== undefined || body.name !== undefined) {
      const allUsers = await listCognitoUsers();
      const u = allUsers.find(x => x.username === username || x.email?.toLowerCase() === username.toLowerCase());
      if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

      let access: ModuleAccess[] = [];
      try { access = JSON.parse((u.access as unknown as string) || "[]"); } catch {}

      const salesIdx = access.findIndex(a => a.module === "sales");
      const ROLE_ADMIN = ["Admin", "sales_admin_manager", "Super Admin"];

      if (salesIdx >= 0) {
        if (body.salesRole !== undefined) {
          access[salesIdx].role = body.salesRole;
          access[salesIdx].isModuleAdmin = ROLE_ADMIN.includes(body.salesRole);
        }
        if (body.salesPerms !== undefined) {
          (access[salesIdx] as any).perms = body.salesPerms;
        }
      } else if (body.salesRole !== undefined) {
        access.push({
          module: "sales",
          role: body.salesRole,
          isModuleAdmin: ROLE_ADMIN.includes(body.salesRole),
          branches: [],
          aes: [],
        });
      }

      await updateCognitoUser({
        username,
        fullName: body.name,
        access,
      });
      return NextResponse.json({ ok: true });
    }

    // name-only update
    if (body.name) {
      await updateCognitoUser({ username, fullName: body.name });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/sales/users error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
