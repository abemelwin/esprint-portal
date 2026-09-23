import { serverLoad } from "@/modules/checks/lib/data";
import { getCheckContext } from "../../lib/access";
import { redirect } from "next/navigation";
import { ReconstructReportClient } from "./ReconstructReportClient";

export const dynamic = "force-dynamic";

export default async function ReconstructReportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  const data = await serverLoad();

  return (
    <ReconstructReportClient
      initialData={data}
      perms={{ role: ctx.role, branches: ctx.branches, aes: ctx.aes }}
      userName={ctx.user.fullName || ctx.user.email}
    />
  );
}
