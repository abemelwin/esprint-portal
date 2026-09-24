import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { query } from "@/lib/db";
import { DeleteRequestsClient } from "./DeleteRequestsClient";

export default async function DeleteRequestsPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  let rows: DeleteRequestItem[] = [];
  try {
    const rawRows = await query<any>(
      `SELECT dr.id, dr.check_id, dr.event_id, dr.target_type, dr.reason,
              dr.requested_by, dr.requested_by_name, dr.status, dr.created_at,
              c.check_no, c.bank, c.client_code,
              cl.name as client_name,
              c.check_date
       FROM check_monitoring.delete_requests dr
       LEFT JOIN check_monitoring.checks c ON c.id = dr.check_id
       LEFT JOIN check_monitoring.clients cl ON cl.code = c.client_code
       ORDER BY dr.created_at DESC
       LIMIT 200`
    );
    rows = rawRows.map(r => ({
      id:              r.id,
      checkId:         r.check_id,
      eventId:         r.event_id,
      targetType:      r.target_type,
      reason:          r.reason,
      requestedBy:     r.requested_by,
      requestedByName: r.requested_by_name || r.requested_by || '—',
      status:          r.status,
      createdAt:       r.created_at,
      checkNo:         r.check_no,
      bank:            r.bank,
      client:          r.client_code,
      clientName:      r.client_name,
      checkDate:       r.check_date,
    }));
  } catch { rows = []; }

  return <DeleteRequestsClient initialRows={rows} />;
}

export interface DeleteRequestItem {
  id:                string;
  checkId:           string;
  eventId:           string | null;
  targetType:        string;
  reason:            string;
  requestedBy:       string;
  requestedByName:   string;
  status:            string;
  createdAt:         string;
  checkNo?:          string;
  bank?:             string;
  client?:           string;
  clientName?:       string;
  checkDate?:        string;
}
