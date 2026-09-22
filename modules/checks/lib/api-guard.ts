/**
 * Server-side guard for Check Monitoring API routes.
 *
 * Wraps getCheckContext() and returns either the context (with a
 * ready-to-use CheckPerms) or a NextResponse error to return early.
 */

import { NextResponse } from "next/server";
import { getCheckContext, type CheckContext } from "@/app/(portal)/checks/lib/access";
import { permsFromContext, type CheckPerms } from "./permissions";

export interface GuardOk {
  ok: true;
  ctx: CheckContext;
  perms: CheckPerms;
}
export interface GuardErr {
  ok: false;
  response: NextResponse;
}

/** Require an authenticated user with access to the checks module. */
export async function requireCheckAccess(): Promise<GuardOk | GuardErr> {
  const ctx = await getCheckContext();
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authorized for Check Monitoring." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, ctx, perms: permsFromContext(ctx) };
}
