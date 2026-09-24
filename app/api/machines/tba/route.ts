import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getMachinePermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { TBAListItem } from "@/modules/machines/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await query<TBAListItem>(
      `SELECT * FROM machine_monitoring.tba_list ORDER BY reservation_date DESC, created_at DESC`
    );

    const perms = getMachinePermissions(user);
    const sanitized = rows.map((r) => {
      if (!perms.canViewClient) {
        const access = user.access.find((a) => a.module === "machines");
        const allowedAes = access?.aes || [];
        const isMyAe = r.ae && allowedAes.includes(r.ae);
        if (!isMyAe) {
          return {
            ...r,
            client_name: r.client_name ? "REDACTED" : null,
            client_code: r.client_code ? "REDACTED" : null,
          };
        }
      }
      return r;
    });

    return NextResponse.json({ tba: sanitized });
  } catch (err) {
    console.error("Error fetching TBA list:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { brand, model, client_name, client_code, location, ae, reservation_date, notes } = body;

    if (!model || !client_name) {
      return NextResponse.json({ error: "Model and Client Name are required" }, { status: 400 });
    }

    const rows = await query<TBAListItem>(
      `
      INSERT INTO machine_monitoring.tba_list (
        brand, model, client_name, client_code, location, ae, reservation_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8)
      RETURNING *
      `,
      [
        brand || null,
        model,
        client_name,
        client_code || null,
        location || null,
        ae || null,
        reservation_date || null,
        notes || null,
      ]
    );

    return NextResponse.json({ tba: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Error creating TBA item:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    await query(`DELETE FROM machine_monitoring.tba_list WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting TBA item:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
