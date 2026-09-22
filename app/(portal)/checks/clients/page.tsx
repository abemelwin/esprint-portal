import { serverLoad } from "@/modules/checks/lib/data";
import { ClientsTable } from "@/modules/checks/components/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const data = await serverLoad();

  const branchName = new Map(data.BRANCHES.map((b) => [b.id, b.name]));

  // Count checks per client
  const checkCounts = new Map<string, number>();
  for (const c of data.CHECKS) {
    checkCounts.set(c.client, (checkCounts.get(c.client) ?? 0) + 1);
  }

  const clients = data.CLIENTS.map((c) => ({
    code: c.code,
    name: c.name,
    branch: c.branch,
    branchName: branchName.get(c.branch) ?? c.branch,
    ae: c.ae,
    checkCount: checkCounts.get(c.code) ?? 0,
  }));

  const branches = data.BRANCHES.map((b) => ({ id: b.id, name: b.name }));

  return <ClientsTable clients={clients} branches={branches} />;
}
