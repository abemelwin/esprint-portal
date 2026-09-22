/**
 * GET /api/auth/me
 * Returns the current user's identity and Check Monitoring perms.
 * Used by client components that need role/branch/AE scope.
 */
import { NextResponse } from "next/server";
import { getCheckContext } from "@/app/(portal)/checks/lib/access";

export async function GET() {
  const ctx = await getCheckContext();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({
    ok:       true,
    email:    ctx.user.email,
    fullName: ctx.user.fullName,
    role:     ctx.role,
    branches: ctx.branches,
    aes:      ctx.aes,
    isAdmin:  ctx.isAdmin,
  });
}
