/**
 * POST /api/auth/login
 *
 * Dev mode: accepts { email, password } and matches against DEV_USERS
 *           (any password works for the mock users). Sets a cookie.
 *
 * Production (Cognito): exchanges credentials with Cognito via
 * InitiateAuth (USER_PASSWORD_AUTH) and stores the returned ID token
 * in an httpOnly session cookie. Subsequent requests validate that
 * token via lib/auth.ts verifyToken().
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isDevMode,
  DEV_USERS,
  cognitoLogin,
  userFromClaims,
  verifyToken,
  NewPasswordRequiredError,
} from "@/lib/auth";
import { DEV_USER_COOKIE, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (isDevMode()) {
    const user = DEV_USERS[email];
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(DEV_USER_COOKIE, email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });
    return res;
  }

  // ── Production Cognito flow ──
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  try {
    const tokens = await cognitoLogin(email, password);
    const claims = await verifyToken(tokens.idToken);
    const user = userFromClaims(claims);

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, tokens.idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expiresIn, // matches Cognito token lifetime
    });
    return res;
  } catch (err) {
    // First login for an admin-created user: they must set a new password.
    if (err instanceof NewPasswordRequiredError) {
      return NextResponse.json(
        { error: "New password required.", newPasswordRequired: true, session: err.session },
        { status: 403 }
      );
    }

    // Cognito returns NotAuthorizedException / UserNotFoundException for
    // bad credentials. With "Prevent user existence errors" enabled these
    // both surface as NotAuthorizedException — return a generic message.
    const name = (err as { name?: string })?.name ?? "";
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }
    if (name === "UserNotConfirmedException") {
      return NextResponse.json(
        { error: "Account not confirmed. Contact your administrator." },
        { status: 403 }
      );
    }

    console.error("Cognito login error:", err);
    // TEMPORARY: surface the real error to diagnose the Amplify 500.
    // Remove the `detail` field once login is confirmed working.
    return NextResponse.json(
      {
        error: "Login failed. Please try again.",
        detail: `${(err as { name?: string })?.name ?? "Error"}: ${(err as Error)?.message ?? String(err)}`,
      },
      { status: 500 }
    );
  }
}
