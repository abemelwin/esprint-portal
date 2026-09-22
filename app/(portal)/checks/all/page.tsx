import { serverLoad } from "@/modules/checks/lib/data";
import { getCheckContext } from "../lib/access";
import { AllChecksTable } from "@/modules/checks/components/all-checks-table";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AllChecksPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  const data = await serverLoad();

  return (
    <AllChecksTable
      initialData={data}
      perms={{ role: ctx.role, branches: ctx.branches, aes: ctx.aes }}
      userEmail={ctx.user.email}
      userName={ctx.user.fullName}
    />
  );
}
