import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getMachinePermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Machine } from "@/modules/machines/types";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const branch = searchParams.get("branch");
  const brand = searchParams.get("brand");
  const model = searchParams.get("model");
  const ae = searchParams.get("ae");
  const q = searchParams.get("q");

  try {
    let sql = `
      SELECT 
        id, serial_no, po_no, brand, model, branch, status,
        client_name, client_code, location, ae,
        reservation_date, delivery_date, dispatch_date, notes,
        created_at, updated_at
      FROM machine_monitoring.machines
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status && status !== "All") {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (branch && branch !== "All") {
      params.push(branch);
      sql += ` AND branch = $${params.length}`;
    }
    if (brand && brand !== "All") {
      params.push(brand);
      sql += ` AND brand = $${params.length}`;
    }
    if (model && model !== "All") {
      params.push(model);
      sql += ` AND model = $${params.length}`;
    }
    if (ae && ae !== "All") {
      params.push(ae);
      sql += ` AND ae = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (
        serial_no ILIKE $${params.length} OR
        po_no ILIKE $${params.length} OR
        model ILIKE $${params.length} OR
        client_name ILIKE $${params.length} OR
        client_code ILIKE $${params.length}
      )`;
    }

    sql += ` ORDER BY updated_at DESC, created_at DESC`;

    const machines = await query<Machine>(sql, params);

    // Apply AE visibility logic if not admin
    const perms = getMachinePermissions(user);
    const sanitized = machines.map((m) => {
      if (!perms.canViewClient) {
        // If user cannot view client details unless assigned to this AE
        const access = user.access.find((a) => a.module === "machines");
        const allowedAes = access?.aes || [];
        const isMyAe = m.ae && allowedAes.includes(m.ae);
        if (!isMyAe) {
          return {
            ...m,
            client_name: m.client_name ? "REDACTED (Restricted)" : null,
            client_code: m.client_code ? "REDACTED" : null,
          };
        }
      }
      return m;
    });

    return NextResponse.json({ machines: sanitized });
  } catch (err) {
    console.error("Error fetching machines:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getMachinePermissions(user);
  if (!perms.canEdit) {
    return NextResponse.json({ error: "Forbidden: Edit permission required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      serial_no,
      po_no,
      brand,
      model,
      branch,
      status = "In Stock",
      client_name,
      client_code,
      location,
      ae,
      reservation_date,
      delivery_date,
      dispatch_date,
      notes,
    } = body;

    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }

    const rows = await query<Machine>(
      `
      INSERT INTO machine_monitoring.machines (
        serial_no, po_no, brand, model, branch, status,
        client_name, client_code, location, ae,
        reservation_date, delivery_date, dispatch_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      ]
    );

    const newMachine = rows[0];

    // Log history
    await query(
      `INSERT INTO machine_monitoring.machine_history (machine_id, event, actor) VALUES ($1, $2, $3)`,
      [newMachine.id, `Unit added (${status})`, user.fullName]
    );

    return NextResponse.json({ machine: newMachine }, { status: 201 });
  } catch (err) {
    console.error("Error creating machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
