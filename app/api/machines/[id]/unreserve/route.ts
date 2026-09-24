import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getMachinePermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Machine } from "@/modules/machines/types";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getMachinePermissions(user);
  if (!perms.canUnreserve) {
    return NextResponse.json({ error: "Forbidden: Cannot unreserve unit" }, { status: 403 });
  }

  try {
    const prev = await query<Machine>(
      `SELECT * FROM machine_monitoring.machines WHERE id = $1`,
      [params.id]
    );
    if (!prev.length) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }
    const oldClient = prev[0].client_name;

    const rows = await query<Machine>(
      `
      UPDATE machine_monitoring.machines SET
        status = 'In Stock',
        client_name = null,
        client_code = null,
        location = null,
        ae = null,
        reservation_date = null,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [params.id]
    );

    await query(
      `INSERT INTO machine_monitoring.machine_history (machine_id, event, actor) VALUES ($1, $2, $3)`,
      [
        params.id,
        `Unreserved (was reserved for: ${oldClient || "unknown"}), returned to In Stock`,
        user.fullName,
      ]
    );

    return NextResponse.json({ machine: rows[0] });
  } catch (err) {
    console.error("Error unreserving machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
