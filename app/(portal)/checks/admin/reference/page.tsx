import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { serverLoad } from "@/modules/checks/lib/data";
import { ReferenceTablesClient } from "./ReferenceTablesClient";

export const dynamic = "force-dynamic";

export default async function ReferenceTablesPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  const data = await serverLoad();

  return (
    <ReferenceTablesClient
      initialSubsidiaries={data.SUBSIDIARIES}
      initialAeList={data.AE_LIST}
      initialBanks={data.BANKS}
      initialBranches={data.BRANCHES}
      checksCount={data.CHECKS.length}
      checksPerSubsidiary={Object.fromEntries(
        data.SUBSIDIARIES.map(s => [s, data.CHECKS.filter(c => c.subsidiary === s).length])
      )}
      checksPerAe={Object.fromEntries(
        data.AE_LIST.map(ae => [ae, data.CHECKS.filter(c => c.ae === ae).length])
      )}
      clientsPerAe={Object.fromEntries(
        data.AE_LIST.map(ae => [ae, data.CLIENTS.filter(c => c.ae === ae).length])
      )}
      checksPerBank={Object.fromEntries(
        data.BANKS.map(b => [b.code, data.CHECKS.filter(c => c.bank === b.code).length])
      )}
      checksPerBranch={Object.fromEntries(
        data.BRANCHES.map(b => [b.id, data.CHECKS.filter(c => c.branch === b.id).length])
      )}
      clientsPerBranch={Object.fromEntries(
        data.BRANCHES.map(b => [b.id, data.CLIENTS.filter(c => c.branch === b.id).length])
      )}
    />
  );
}
