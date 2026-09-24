import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getMachinePermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Machine } from "@/modules/machines/types";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getMachinePermissions(user);
  if (!perms.canReserve) {
    return NextResponse.json({ error: "Forbidden: Cannot reserve unit" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { client_name, client_code, location, ae, reservation_date, notes } = body;

    if (!client_name) {
      return NextResponse.json({ error: "Client Name is required" }, { status: 400 });
    }

    const rows = await query<Machine>(
      `
      UPDATE machine_monitoring.machines SET
        status = 'Reserved',
        client_name = $1,
        client_code = $2,
        location = $3,
        ae = $4,
        reservation_date = COALESCE($5, CURRENT_DATE),
        notes = COALESCE($6, notes),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [
        client_name,
        client_code || null,
        location || null,
        ae || null,
        reservation_date || null,
        notes || null,
        params.id,
      ]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    await query(
      `INSERT INTO machine_monitoring.machine_history (machine_id, event, actor) VALUES ($1, $2, $3)`,
      [
        params.id,
        `Reserved for ${client_name}${ae ? ` (AE: ${ae})` : ""}`,
        user.fullName,
      ]
    );

    return NextResponse.json({ machine: rows[0] });
  } catch (err) {
    console.error("Error reserving machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
