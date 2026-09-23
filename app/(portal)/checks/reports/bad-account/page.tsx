import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { serverLoad } from "@/modules/checks/lib/data";
import { canCreate, permsFromContext } from "@/modules/checks/lib/permissions";
import { BadAccountClient } from "./BadAccountClient";

export const dynamic = "force-dynamic";

export default async function BadAccountReportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  const data = await serverLoad();
  const perms = permsFromContext(ctx);

  return (
    <BadAccountClient
      branches={data.BRANCHES.map((b) => ({ id: b.id, name: b.name }))}
      aeList={data.AE_LIST}
      canEdit={canCreate(perms)}
      userEmail={ctx.user.email}
    />
  );
}
