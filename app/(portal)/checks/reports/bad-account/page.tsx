import { loadReportData } from "@/modules/checks/lib/report-data";
import { ReportView } from "@/modules/checks/components/report-view";

export const dynamic = "force-dynamic";

export default async function BadAccountReportPage() {
  const { checks, branches, aeList } = await loadReportData();
  return (
    <ReportView
      title="Bad Account"
      description="Checks flagged as bad accounts or write-offs."
      statuses={["BAD ACCOUNT", "CANCELLED"]}
      checks={checks}
      branches={branches}
      aeList={aeList}
    />
  );
}
