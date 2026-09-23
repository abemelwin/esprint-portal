/**
 * ONE-TIME endpoint — sets melwin@esprintmedia.com password as permanent.
 * DELETE after use.
 * GET /api/admin/create-dev?secret=ESpmi2026!
 */
import { NextRequest, NextResponse } from "next/server";
import { resetCognitoPassword } from "@/lib/cognito-admin";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "ESpmi2026!") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Set permanent password so melwin can log in directly without forced change
    await resetCognitoPassword("melwin@esprintmedia.com", "Esprint2026!", true);
    return NextResponse.json({
      ok: true,
      message: "melwin@esprintmedia.com password set as permanent. Login with Esprint2026!",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
