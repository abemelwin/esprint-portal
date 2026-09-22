/**
 * POST /api/checks/reconstruct-bulk
 *
 * Atomic batch:
 * 1. Mark selectedIds → finalStatus = 'RECON REPLACED'
 * 2. Create new RECON REPLACEMENT checks from fileRows (copied Client/Branch/AE
 *    from the source check), plus a RECONSTRUCT event per new check.
 *
 * Adapted from esprint-check-monitoring for AWS RDS (plain pg).
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { query, transaction } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

interface FileRow {
  bank:            string;
  checkNo:         string;
  checkDate?:      string;
  originalAmount:  number;
  nextDeposit?:    string;
}

const BLOCKED_STATUSES = [
  "RECON REPLACED","RECON REPLACEMENT","CLEARED","DEPOSITED",
  "SETTLED (PAID)","REPLACED","CANCELLED",
];

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok:false, error:"Your role cannot perform this action." }, { status:403 });
  }

  let body: {
    selectedIds?:   string[];
    fileRows?:      FileRow[];
    sourceCheckId?: string;
    paymentFor?:    string;
    paymentDesc?:   string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok:false, error:"Invalid JSON body" }, { status:400 }); }

  const {
    selectedIds   = [] as string[],
    fileRows      = [] as FileRow[],
    sourceCheckId = "",
    paymentFor    = "Reconstruct Balance",
    paymentDesc   = "",
  } = body;

  const reconstructedBy = guard.ctx.user.fullName || guard.ctx.user.email;

  if (!selectedIds.length) {
    return NextResponse.json({ ok:false, error:"No checks selected" }, { status:400 });
  }

  // Load source check
  const srcId = sourceCheckId || selectedIds[0];
  const srcRows = await query<{
    id:string; client_code:string; branch_id:string; subsidiary:string|null; ae:string|null;
  }>(`SELECT id, client_code, branch_id, subsidiary, ae FROM ${SCHEMA}.checks WHERE id = $1`, [srcId]);

  if (!srcRows[0]) {
    return NextResponse.json({ ok:false, error:"Source check not found" }, { status:404 });
  }
  const src = srcRows[0];

  // Validate selected checks
  const placeholders = selectedIds.map((_,i) => `$${i+1}`).join(",");
  const existingChecks = await query<{ id:string; check_no:string; bank:string|null; final_status:string|null }>(
    `SELECT id, check_no, bank, final_status FROM ${SCHEMA}.checks WHERE id IN (${placeholders})`,
    selectedIds
  );

  const blocked = existingChecks.filter(c => BLOCKED_STATUSES.includes(c.final_status ?? ""));
  if (blocked.length > 0) {
    const labels = blocked.slice(0,3).map(c=>`${c.bank} ${c.check_no} (${c.final_status})`).join(", ");
    return NextResponse.json({ ok:false, error:`${blocked.length} check(s) cannot be reconstructed: ${labels}${blocked.length>3?` and ${blocked.length-3} more`:""}` }, { status:400 });
  }

  const now   = new Date().toISOString();
  const today = now.slice(0, 10);

  await transaction(async (client) => {
    // 1. Mark selected as RECON REPLACED
    await client.query(
      `UPDATE ${SCHEMA}.checks SET final_status = 'RECON REPLACED' WHERE id = ANY($1)`,
      [selectedIds]
    );

    // 2. Create new RECON REPLACEMENT checks + RECONSTRUCT events
    for (const row of fileRows) {
      const checkId = randomUUID();
      await client.query(
        `INSERT INTO ${SCHEMA}.checks
           (id, client_code, branch_id, subsidiary, ae, bank, check_no,
            check_date, original_amount, payment_for, payment_description,
            notes, final_status, replacement_of, created_by, created_at, blacklist_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,'RECON REPLACEMENT',$12,$13,$14,NULL)`,
        [
          checkId, src.client_code, src.branch_id, src.subsidiary, src.ae,
          row.bank?.trim() ?? null,
          String(row.checkNo).trim(),
          row.nextDeposit || row.checkDate || null,
          row.originalAmount,
          paymentFor || "Reconstruct Balance",
          paymentDesc || null,
          srcId,
          reconstructedBy,
          now,
        ]
      );
      await client.query(
        `INSERT INTO ${SCHEMA}.events
           (id, check_id, type, event_date, move_date, reason,
            method, reference, amount, notes, recorded_by, recorded_at)
         VALUES ($1,$2,'RECONSTRUCT',$3,$4,$5,NULL,NULL,NULL,'',$6,$7)`,
        [
          randomUUID(), checkId, today,
          row.nextDeposit || row.checkDate || null,
          "Reconstruct replacement check",
          reconstructedBy, now,
        ]
      );
    }
  });

  invalidateCache();
  return NextResponse.json({ ok:true, replaced:selectedIds.length, created:fileRows.length });
}
