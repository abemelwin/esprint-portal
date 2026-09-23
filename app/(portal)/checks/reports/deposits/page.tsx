import { serverLoad } from "@/modules/checks/lib/data";
import { getCheckContext } from "../../lib/access";
import { redirect } from "next/navigation";
import { DepositsReportClient } from "./DepositsReportClient";

export const dynamic = "force-dynamic";

export default async function DepositsReportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  const data = await serverLoad();

  return (
    <DepositsReportClient
      initialData={data}
      perms={{ role: ctx.role, branches: ctx.branches, aes: ctx.aes }}
    />
  );
}
