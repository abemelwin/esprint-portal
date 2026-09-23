import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { serverLoad } from "@/modules/checks/lib/data";
import { canCreate, permsFromContext } from "@/modules/checks/lib/permissions";
import { BulkImportClient } from "./BulkImportClient";

export const dynamic = "force-dynamic";

export default async function BulkImportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");
  const perms = permsFromContext(ctx);
  if (!canCreate(perms)) redirect("/checks");

  const data = await serverLoad();
  return <BulkImportClient branches={data.BRANCHES.map((b) => ({ id: b.id, name: b.name }))} />;
}
