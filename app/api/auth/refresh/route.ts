/**
 * POST /api/auth/refresh
 *
 * Silently renews the session using the Cognito refresh token stored in the
 * httpOnly `esprint_refresh` cookie. Called periodically by the client (see
 * SessionKeepAlive) before the ~1-hour ID token expires, so an active user is
 * never kicked out mid-session. Returns 401 if there is no valid refresh token
 * (refresh token expired after 30 days, or user logged out).
 */

import { NextRequest, NextResponse } from "next/server";
import { isDevMode, cognitoRefresh, verifyToken, userFromClaims } from "@/lib/auth";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  // Dev mode has no Cognito tokens; nothing to refresh.
  if (isDevMode()) {
    return NextResponse.json({ ok: true, dev: true });
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "No refresh token." }, { status: 401 });
  }

  // Cognito needs the SECRET_HASH when the app client has a secret. For the
  // REFRESH_TOKEN_AUTH flow the username used to compute SECRET_HASH must be
  // the user's `sub` (NOT the email). We read it from the current (possibly
  // expired) ID token — token expiry doesn't matter for reading claims since
  // we decode, not verify.
  let username: string | undefined;
  const idToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (idToken) {
    try {
      const parts = idToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        username = payload["cognito:username"] ?? payload.sub;
      }
    } catch {
      /* ignore — username stays undefined */
    }
  }

  try {
    const tokens = await cognitoRefresh(refreshToken, username);
    const claims = await verifyToken(tokens.idToken);
    const user = userFromClaims(claims);

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, tokens.idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    // Cognito reuses the same refresh token; re-set it to extend the cookie window.
    res.cookies.set(REFRESH_COOKIE, tokens.refreshToken ?? refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    // Refresh token expired/revoked → the user must log in again.
    console.error("Token refresh failed:", (err as { name?: string })?.name ?? err);
    return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });
  }
}
