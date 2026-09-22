/**
 * /api/reference/[table]
 *   POST   — upsert or rename a reference row.
 *   DELETE — delete a reference row.
 *
 * Adapted from esprint-check-monitoring for AWS RDS (plain pg).
 * Only admins may access this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canManageUsers } from "@/modules/checks/lib/permissions";
import { query, transaction } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

const ALLOWED_TABLES = ["subsidiaries", "ae_list", "banks", "branches"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: { table: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.perms)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const table = params.table as AllowedTable;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Unknown table." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { op, row, oldPk, cascadeChecks, cascadeClients } = body;

  try {
    if (op === "upsert") {
      await upsertRow(table, row);
    } else if (op === "rename") {
      const merged = await renameRow(table, oldPk, row, cascadeChecks, cascadeClients);
      invalidateCache();
      return NextResponse.json({ ok: true, merged: merged ?? false });
    } else {
      return NextResponse.json({ error: "Unknown op." }, { status: 400 });
    }
    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`reference/${table} POST failed:`, err);
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { table: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.perms)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const table = params.table as AllowedTable;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Unknown table." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { pk } = body;

  try {
    await deleteRow(table, pk);
    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`reference/${table} DELETE failed:`, err);
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 });
  }
}

// ── Row operations ─────────────────────────────────────────────────────────

async function upsertRow(table: AllowedTable, row: Record<string, unknown>) {
  switch (table) {
    case "subsidiaries":
      await query(
        `INSERT INTO ${SCHEMA}.subsidiaries (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name`,
        [row.name]
      );
      break;
    case "ae_list":
      await query(
        `INSERT INTO ${SCHEMA}.ae_list (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name`,
        [row.name]
      );
      break;
    case "banks":
      await query(
        `INSERT INTO ${SCHEMA}.banks (code, name) VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [row.code, row.name]
      );
      break;
    case "branches":
      await query(
        `INSERT INTO ${SCHEMA}.branches (id, name, subsidiary) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, subsidiary = EXCLUDED.subsidiary`,
        [row.id, row.name, row.subsidiary ?? null]
      );
      break;
  }
}

async function renameRow(
  table: AllowedTable,
  oldPk: string,
  row: Record<string, unknown>,
  cascadeChecks?: { field: string; oldValue: string; newValue: string },
  cascadeClients?: { field: string; oldValue: string; newValue: string }
): Promise<boolean> {
  return await transaction(async (client) => {
    switch (table) {
      case "subsidiaries": {
        const newName = String(row.name);
        // Check if target already exists (merge case)
        const existing = await client.query(`SELECT name FROM ${SCHEMA}.subsidiaries WHERE name = $1`, [newName]);
        const isMerge = existing.rows.length > 0 && newName !== oldPk;
        if (isMerge) {
          // Cascade to checks, then delete old
          await client.query(`UPDATE ${SCHEMA}.checks SET subsidiary = $1 WHERE subsidiary = $2`, [newName, oldPk]);
          await client.query(`DELETE FROM ${SCHEMA}.subsidiaries WHERE name = $1`, [oldPk]);
          return true;
        }
        await client.query(`UPDATE ${SCHEMA}.subsidiaries SET name = $1 WHERE name = $2`, [newName, oldPk]);
        if (cascadeChecks) {
          await client.query(`UPDATE ${SCHEMA}.checks SET ${cascadeChecks.field} = $1 WHERE ${cascadeChecks.field} = $2`, [newName, oldPk]);
        }
        return false;
      }
      case "ae_list": {
        const newName = String(row.name);
        const existing = await client.query(`SELECT name FROM ${SCHEMA}.ae_list WHERE name = $1`, [newName]);
        const isMerge = existing.rows.length > 0 && newName !== oldPk;
        if (isMerge) {
          await client.query(`UPDATE ${SCHEMA}.checks SET ae = $1 WHERE ae = $2`, [newName, oldPk]);
          await client.query(`UPDATE ${SCHEMA}.clients SET ae = $1 WHERE ae = $2`, [newName, oldPk]);
          await client.query(`DELETE FROM ${SCHEMA}.ae_list WHERE name = $1`, [oldPk]);
          return true;
        }
        await client.query(`UPDATE ${SCHEMA}.ae_list SET name = $1 WHERE name = $2`, [newName, oldPk]);
        if (cascadeChecks)  await client.query(`UPDATE ${SCHEMA}.checks SET ae = $1 WHERE ae = $2`,   [newName, oldPk]);
        if (cascadeClients) await client.query(`UPDATE ${SCHEMA}.clients SET ae = $1 WHERE ae = $2`, [newName, oldPk]);
        return false;
      }
      case "banks": {
        const newCode = String(row.code);
        const newName = String(row.name);
        if (newCode !== oldPk) {
          // Insert new code, cascade, delete old
          await client.query(`INSERT INTO ${SCHEMA}.banks (code, name) VALUES ($1, $2)`, [newCode, newName]);
          await client.query(`UPDATE ${SCHEMA}.checks SET bank = $1 WHERE bank = $2`, [newCode, oldPk]);
          await client.query(`DELETE FROM ${SCHEMA}.banks WHERE code = $1`, [oldPk]);
        } else {
          await client.query(`UPDATE ${SCHEMA}.banks SET name = $1 WHERE code = $2`, [newName, oldPk]);
        }
        return false;
      }
      case "branches": {
        // Branch id is immutable; only name/subsidiary can change (handled by upsert)
        await client.query(`UPDATE ${SCHEMA}.branches SET name = $1, subsidiary = $2 WHERE id = $3`, [row.name, row.subsidiary ?? null, oldPk]);
        return false;
      }
    }
  });
}

async function deleteRow(table: AllowedTable, pk: string) {
  switch (table) {
    case "subsidiaries":
      await query(`DELETE FROM ${SCHEMA}.subsidiaries WHERE name = $1`, [pk]);
      break;
    case "ae_list":
      await query(`DELETE FROM ${SCHEMA}.ae_list WHERE name = $1`, [pk]);
      break;
    case "banks":
      await query(`DELETE FROM ${SCHEMA}.banks WHERE code = $1`, [pk]);
      break;
    case "branches":
      await query(`DELETE FROM ${SCHEMA}.branches WHERE id = $1`, [pk]);
      break;
  }
}
