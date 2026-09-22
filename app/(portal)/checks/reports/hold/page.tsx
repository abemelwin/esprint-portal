import { loadReportData } from "@/modules/checks/lib/report-data";
import { ReportView } from "@/modules/checks/components/report-view";

export const dynamic = "force-dynamic";

export default async function HoldReportPage() {
  const { checks, branches, aeList } = await loadReportData();
  return (
    <ReportView
      title="Hold Checks"
      description="Checks currently held or returned (open)."
      statuses={["HELD", "RETURNED"]}
      checks={checks}
      branches={branches}
      aeList={aeList}
    />
  );
}
