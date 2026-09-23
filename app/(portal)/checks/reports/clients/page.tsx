import { serverLoad } from "@/modules/checks/lib/data";
import { getCheckContext } from "../../lib/access";
import { redirect } from "next/navigation";
import { ClientReportClient } from "./ClientReportClient";

export const dynamic = "force-dynamic";

export default async function ClientReportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  const data = await serverLoad();

  return (
    <ClientReportClient
      initialData={data}
      perms={{ role: ctx.role, branches: ctx.branches, aes: ctx.aes }}
    />
  );
}
