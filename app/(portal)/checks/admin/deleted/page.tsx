import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { query } from "@/lib/db";
import { serverLoad } from "@/modules/checks/lib/data";
import { DeletedChecksClient, type DeletedRow } from "./DeletedChecksClient";

export const dynamic = "force-dynamic";

export default async function DeletedChecksPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  const [data, rows] = await Promise.all([
    serverLoad(),
    query<DeletedRow>(
      `SELECT id, check_id, check_snapshot, events_snapshot, deleted_by, deleted_by_name, deleted_at
       FROM check_monitoring.deleted_checks
       ORDER BY deleted_at DESC`
    ).catch(() => []),
  ]);

  return (
    <DeletedChecksClient
      initialRows={rows}
      clients={data.CLIENTS}
      branches={data.BRANCHES}
    />
  );
}
