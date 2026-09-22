import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { query } from "@/lib/db";
import { DeleteRequestsClient } from "./DeleteRequestsClient";

export const dynamic = "force-dynamic";

interface DeleteRequestRow {
  id:                 string;
  check_id:           string;
  event_id:           string | null;
  target_type:        string;
  reason:             string;
  requested_by:       string;
  requested_by_name:  string;
  status:             string;
  created_at:         string;
}

export default async function DeleteRequestsPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  let rows: DeleteRequestRow[] = [];
  try {
    rows = await query<DeleteRequestRow>(
      `SELECT dr.id, dr.check_id, dr.event_id, dr.target_type, dr.reason,
              dr.requested_by, dr.requested_by_name, dr.status, dr.created_at,
              c.check_no, c.bank, c.client_code as client
       FROM check_monitoring.delete_requests dr
       LEFT JOIN check_monitoring.checks c ON c.id = dr.check_id
       ORDER BY dr.created_at DESC
       LIMIT 200`
    );
  } catch { rows = []; }

  return <DeleteRequestsClient initialRows={rows as unknown as DeleteRequestItem[]} />;
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
}
