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
  if (!perms.canDeliver) {
    return NextResponse.json({ error: "Forbidden: Cannot deliver unit" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { delivery_date, dispatch_date, notes } = body;

    const rows = await query<Machine>(
      `
      UPDATE machine_monitoring.machines SET
        status = 'Delivered',
        delivery_date = COALESCE($1, CURRENT_DATE),
        dispatch_date = COALESCE($2, dispatch_date),
        notes = COALESCE($3, notes),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [
        delivery_date || null,
        dispatch_date || null,
        notes || null,
        params.id,
      ]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    const machine = rows[0];
    await query(
      `INSERT INTO machine_monitoring.machine_history (machine_id, event, actor) VALUES ($1, $2, $3)`,
      [
        params.id,
        `Marked as Delivered to ${machine.client_name || "client"}`,
        user.fullName,
      ]
    );

    return NextResponse.json({ machine });
  } catch (err) {
    console.error("Error delivering machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
