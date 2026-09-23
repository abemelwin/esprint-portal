import { serverLoad } from "@/modules/checks/lib/data";
import { ClientsClient } from "./ClientsClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const data = await serverLoad();

  return (
    <ClientsClient
      initialClients={data.CLIENTS}
      branches={data.BRANCHES}
      subsidiaries={data.SUBSIDIARIES}
      aeList={data.AE_LIST}
      checks={data.CHECKS}
      events={data.EVENTS}
    />
  );
}
