import { redirect } from "next/navigation";
import { getCheckContext } from "../lib/access";
import { serverLoad } from "@/modules/checks/lib/data";
import { AdminUsersClient } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function CheckAdminPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  const data = await serverLoad();
  return (
    <AdminUsersClient
      branches={data.BRANCHES.map((b) => ({ id: b.id, name: b.name }))}
      aeList={data.AE_LIST}
    />
  );
}
