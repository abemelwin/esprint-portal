import { loadReportData } from "@/modules/checks/lib/report-data";
import { ReportView } from "@/modules/checks/components/report-view";

export const dynamic = "force-dynamic";

export default async function PenaltyReportPage() {
  const { checks, branches, aeList } = await loadReportData();
  return (
    <ReportView
      title="Penalty"
      description="Returned checks subject to penalty charges."
      statuses={["RETURNED"]}
      checks={checks}
      branches={branches}
      aeList={aeList}
    />
  );
}
