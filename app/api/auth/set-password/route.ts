/**
 * POST /api/auth/set-password
 *
 * Completes the Cognito NEW_PASSWORD_REQUIRED challenge for a user who
 * is logging in for the first time with a temporary password. On success
 * the user is fully logged in (session cookie is set), same as a normal
 * login.
 *
 * Body: { email, newPassword, session }
 *   - session comes from the 403 response of /api/auth/login
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isDevMode,
  cognitoSetNewPassword,
  userFromClaims,
  verifyToken,
} from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  if (isDevMode()) {
    return NextResponse.json(
      { error: "Not available in dev mode." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const newPassword = String(body.newPassword ?? "");
  const session = String(body.session ?? "");

  if (!email || !newPassword || !session) {
    return NextResponse.json(
      { error: "Email, new password, and session are required." },
      { status: 400 }
    );
  }

  try {
    const tokens = await cognitoSetNewPassword(email, newPassword, session);
    const claims = await verifyToken(tokens.idToken);
    const user = userFromClaims(claims);

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, tokens.idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expiresIn,
    });
    return res;
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "InvalidPasswordException") {
      return NextResponse.json(
        { error: "Password does not meet the requirements. Use at least 8 characters with upper, lower, number, and symbol." },
        { status: 400 }
      );
    }
    if (name === "NotAuthorizedException") {
      // Session expired — user must start the login over.
      return NextResponse.json(
        { error: "Session expired. Please sign in again.", restart: true },
        { status: 401 }
      );
    }
    console.error("set-password error:", err);
    return NextResponse.json(
      { error: "Could not set the new password. Please try again." },
      { status: 500 }
    );
  }
}
