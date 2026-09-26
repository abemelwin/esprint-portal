import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getMachinePermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Machine, MachineHistoryItem } from "@/modules/machines/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const machines = await query<Machine>(
      `SELECT * FROM machine_monitoring.machines WHERE id = $1`,
      [params.id]
    );
    if (!machines.length) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    const history = await query<MachineHistoryItem>(
      `SELECT * FROM machine_monitoring.machine_history WHERE machine_id = $1 ORDER BY created_at DESC`,
      [params.id]
    );

    return NextResponse.json({ machine: machines[0], history });
  } catch (err) {
    console.error("Error fetching machine detail:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getMachinePermissions(user);
  if (!perms.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      serial_no,
      po_no,
      brand,
      model,
      branch,
      status,
      client_name,
      client_code,
      location,
      ae,
      reservation_date,
      delivery_date,
      dispatch_date,
      notes,
      history_note,  // optional extra note written to machine_history (e.g. for Demo/Recertified)
    } = body;

    const rows = await query<Machine>(
      `
      UPDATE machine_monitoring.machines SET
        serial_no = $1,
        po_no = $2,
        brand = $3,
        model = $4,
        branch = $5,
        status = $6,
        client_name = $7,
        client_code = $8,
        location = $9,
        ae = $10,
        reservation_date = $11,
        delivery_date = $12,
        dispatch_date = $13,
        notes = $14,
        updated_at = NOW()
      WHERE id = $15
      RETURNING *
      `,
      [
        serial_no || null,
        po_no || null,
        brand || null,
        model,
        branch || null,
        status,
        client_name || null,
        client_code || null,
        location || null,
        ae || null,
        reservation_date || null,
        delivery_date || null,
        dispatch_date || null,
        notes || null,
        params.id,
      ]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    await query(
      `INSERT INTO machine_monitoring.machine_history (machine_id, event, actor) VALUES ($1, $2, $3)`,
      [params.id, `Details updated (Status: ${status})`, user.fullName]
    );

    // Write optional history note (e.g. from Demo / Recertified status change)
    if (history_note?.trim()) {
      await query(
        `INSERT INTO machine_monitoring.machine_history (machine_id, event, actor) VALUES ($1, $2, $3)`,
        [params.id, history_note.trim(), user.fullName]
      );
    }

    return NextResponse.json({ machine: rows[0] });
  } catch (err) {
    console.error("Error updating machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getMachinePermissions(user);
  if (!perms.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await query(`DELETE FROM machine_monitoring.machines WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
