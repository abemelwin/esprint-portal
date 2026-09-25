/**
 * Session helpers (server side).
 *
 * Reads the current PortalUser from the request. In production this
 * validates the Cognito JWT from the Authorization header or an
 * httpOnly cookie. In dev mode it reads a mock user from a cookie.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { verifyToken, userFromClaims, isDevMode, DEV_USERS } from "./auth";
import type { PortalUser } from "./rbac";

export const SESSION_COOKIE = "esprint_session";
export const REFRESH_COOKIE = "esprint_refresh";
export const DEV_USER_COOKIE = "esprint_dev_user";

/**
 * Get the logged-in user from the current request, or null.
 * Memoized per-request using React cache() to avoid repeated cookie/JWT parsing.
 */
export const getCurrentUser = cache(async (): Promise<PortalUser | null> => {
  const jar = await cookies();

  // ── Dev mode: cookie holds the mock user's email ──
  if (isDevMode()) {
    const email = jar.get(DEV_USER_COOKIE)?.value;
    if (email && DEV_USERS[email]) {
      return DEV_USERS[email];
    }
    return null;
  }

  // ── Production: validate Cognito token ──
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = await verifyToken(token);
    return userFromClaims(claims);
  } catch {
    return null;
  }
});

