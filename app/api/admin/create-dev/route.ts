/**
 * ONE-TIME endpoint — creates melwin@esprintmedia.com as super_admin.
 * DELETE after use.
 * GET /api/admin/create-dev?secret=ESpmi2026!
 */
import { NextRequest, NextResponse } from "next/server";
import { createCognitoUser } from "@/lib/cognito-admin";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "ESpmi2026!") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await createCognitoUser({
      email:       "melwin@esprintmedia.com",
      fullName:    "Programmer",
      portalRole:  "super_admin",
      access:      [],
      tempPassword: "Esprint2026!",
    });
    return NextResponse.json({ ok: true, message: "melwin@esprintmedia.com created as super_admin. Temp password: Esprint2026!" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
