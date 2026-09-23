/**
 * POST /api/auth/change-password
 *
 * Allows a logged-in user to change their own Cognito password.
 * Strategy: re-authenticate with the current password to obtain a
 * fresh AccessToken, then call Cognito ChangePassword.
 *
 * Body: { currentPassword, newPassword }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { cognitoLogin, cognitoChangePassword, isDevMode } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (isDevMode()) {
    return NextResponse.json({ ok: false, error: "Not available in dev mode." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword     = String(body.newPassword     ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ ok: false, error: "Both passwords are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "New password must be at least 8 characters." }, { status: 400 });
  }

  try {
    // Re-authenticate to obtain a fresh AccessToken
    const tokens = await cognitoLogin(user.email, currentPassword);
    // Then change the password using that token
    await cognitoChangePassword(tokens.accessToken, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "NotAuthorizedException") {
      return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
    }
    if (name === "InvalidPasswordException") {
      return NextResponse.json({
        ok: false,
        error: "New password does not meet requirements. Use at least 8 characters with uppercase, lowercase, number, and symbol.",
      }, { status: 400 });
    }
    if (name === "LimitExceededException") {
      return NextResponse.json({ ok: false, error: "Too many attempts. Please try again later." }, { status: 429 });
    }
    console.error("change-password error:", err);
    return NextResponse.json({ ok: false, error: "Failed to change password. Please try again." }, { status: 500 });
  }
}
