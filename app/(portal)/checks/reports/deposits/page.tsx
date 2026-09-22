import { loadReportData } from "@/modules/checks/lib/report-data";
import { ReportView } from "@/modules/checks/components/report-view";

export const dynamic = "force-dynamic";

export default async function DepositsReportPage() {
  const { checks, branches, aeList } = await loadReportData();
  return (
    <ReportView
      title="Deposits"
      description="Checks that have been deposited or cleared."
      statuses={["DEPOSITED", "CLEARED"]}
      checks={checks}
      branches={branches}
      aeList={aeList}
    />
  );
}
