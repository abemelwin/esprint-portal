import { loadReportData } from "@/modules/checks/lib/report-data";
import { ReportView } from "@/modules/checks/components/report-view";

export const dynamic = "force-dynamic";

export default async function ClientReportPage() {
  const { checks, branches, aeList } = await loadReportData();
  return (
    <ReportView
      title="Client Report"
      description="All checks grouped by client and branch."
      checks={checks}
      branches={branches}
      aeList={aeList}
    />
  );
}
