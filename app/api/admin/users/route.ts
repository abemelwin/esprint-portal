/**
 * /api/admin/users
 *   GET    — list all Cognito users (admin only).
 *   POST   — create a user with a temporary password.
 *   PATCH  — update a user's name / role / access, or reset password, or enable/disable.
 *   DELETE — permanently delete a user.
 *
 * Guarded: only portal super_admin or a Check Monitoring module admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isSuperAdmin, isModuleAdmin } from "@/lib/rbac";
import {
  listCognitoUsers, createCognitoUser, updateCognitoUser,
  resetCognitoPassword, setCognitoUserEnabled, deleteCognitoUser,
} from "@/lib/cognito-admin";
import type { ModuleAccess } from "@/lib/rbac";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 }) };
  if (!isSuperAdmin(user) && !isModuleAdmin(user, "checks")) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;
  try {
    const users = await listCognitoUsers();
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    console.error("GET /api/admin/users failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to load users. Check IAM permissions." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.fullName ?? "").trim();
  const portalRole = body.portalRole === "super_admin" ? "super_admin" : "user";
  const access: ModuleAccess[] = Array.isArray(body.access) ? body.access : [];
  const tempPassword = String(body.tempPassword ?? "Esprint2026!");

  if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });

  try {
    await createCognitoUser({ email, fullName: fullName || email, portalRole, access, tempPassword });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "UsernameExistsException") {
      return NextResponse.json({ ok: false, error: "A user with this email already exists." }, { status: 409 });
    }
    console.error("POST /api/admin/users failed:", err);
    return NextResponse.json({ ok: false, error: `Failed to create user: ${(err as Error).message}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "");
  if (!username) return NextResponse.json({ ok: false, error: "username required." }, { status: 400 });

  try {
    // Enable / disable
    if (typeof body.enabled === "boolean") {
      await setCognitoUserEnabled(username, body.enabled);
    }
    // Reset password
    if (body.resetPassword) {
      await resetCognitoPassword(username, String(body.tempPassword ?? "Esprint2026!"));
    }
    // Update attributes
    if (body.fullName !== undefined || body.portalRole !== undefined || body.access !== undefined) {
      await updateCognitoUser({
        username,
        fullName: body.fullName,
        portalRole: body.portalRole,
        access: body.access,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/users failed:", err);
    return NextResponse.json({ ok: false, error: `Failed to update user: ${(err as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "");
  if (!username) return NextResponse.json({ ok: false, error: "username required." }, { status: 400 });

  try {
    await deleteCognitoUser(username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/users failed:", err);
    return NextResponse.json({ ok: false, error: `Failed to delete user: ${(err as Error).message}` }, { status: 500 });
  }
}
