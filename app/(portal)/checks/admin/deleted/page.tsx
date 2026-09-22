import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { query } from "@/lib/db";
import { fmtPHP, fmtDate, fmtDateTime } from "@/modules/checks/lib/format";
import { DeletedChecksClient } from "./DeletedChecksClient";

export const dynamic = "force-dynamic";

interface DeletedRow {
  id:              string;
  check_id:        string;
  check_snapshot:  Record<string, unknown>;
  deleted_by_name: string;
  deleted_at:      string;
}

export default async function DeletedChecksPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  let rows: DeletedRow[] = [];
  try {
    rows = await query<DeletedRow>(
      `SELECT id, check_id, check_snapshot, deleted_by_name, deleted_at
       FROM check_monitoring.deleted_checks
       ORDER BY deleted_at DESC`
    );
  } catch { rows = []; }

  const items = rows.map(r => {
    const snap = r.check_snapshot as Record<string, string | number | null>;
    return {
      id:            r.id,
      checkId:       r.check_id,
      client:        String(snap.client ?? snap.client_code ?? "—"),
      bank:          String(snap.bank ?? ""),
      checkNo:       String(snap.check_no ?? snap.checkNo ?? ""),
      checkDate:     String(snap.check_date ?? snap.checkDate ?? ""),
      originalAmount:Number(snap.original_amount ?? snap.originalAmount ?? 0),
      deletedByName: r.deleted_by_name,
      deletedAt:     r.deleted_at,
    };
  });

  return <DeletedChecksClient items={items} />;
}
