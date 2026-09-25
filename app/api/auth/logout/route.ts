/**
 * POST /api/auth/logout — clears the session cookie.
 */

import { NextResponse } from "next/server";
import { DEV_USER_COOKIE, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_USER_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
