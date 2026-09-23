import { serverLoad } from "@/modules/checks/lib/data";
import { buildDashboardSummary } from "@/modules/checks/lib/summary";
import { DashboardClient } from "@/modules/checks/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function ChecksDashboardPage() {
  const data = await serverLoad();
  const summary = buildDashboardSummary(data);
  return <DashboardClient summary={summary} />;
}
