/**
 * GET /api/checks/load
 * Returns the full AppData payload for client-side refresh.
 * ?full=1 skips the cache and loads all checks.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { serverLoad, invalidateCache } from "@/modules/checks/lib/data";

export async function GET(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const full = req.nextUrl.searchParams.get("full") === "1";
  if (full) invalidateCache();

  const data = await serverLoad({ fresh: full });
  return NextResponse.json({ ok: true, data });
}
