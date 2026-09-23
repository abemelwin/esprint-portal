import { redirect } from "next/navigation";
import { getCheckContext } from "../lib/access";
import { serverLoad } from "@/modules/checks/lib/data";
import { query } from "@/lib/db";
import { AdminUsersClient } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function CheckAdminPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  const [data, drCountRows] = await Promise.all([
    serverLoad(),
    query<{ count: string }>(
      `SELECT count(*)::text as count FROM check_monitoring.delete_requests WHERE status = 'pending'`
    ).catch(() => [{ count: "0" }]),
  ]);

  const deleteRequestCount = parseInt(drCountRows[0]?.count ?? "0", 10) || 0;

  return (
    <AdminUsersClient
      branches={data.BRANCHES.map((b) => ({ id: b.id, name: b.name }))}
      aeList={data.AE_LIST}
      subsidiaries={data.SUBSIDIARIES}
      deleteRequestCount={deleteRequestCount}
    />
  );
}
