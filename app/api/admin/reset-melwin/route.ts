/**
 * ONE-TIME endpoint — resets melwin@esprintmedia.com password to Melwin@410.
 * DELETE after use.
 * GET /api/admin/reset-melwin?secret=ESpmi2026!
 */
import { NextRequest, NextResponse } from "next/server";
import { resetCognitoPassword } from "@/lib/cognito-admin";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "ESpmi2026!") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await resetCognitoPassword("melwin@esprintmedia.com", "Melwin@410", true);
    return NextResponse.json({ ok: true, message: "Password reset to Melwin@410" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
