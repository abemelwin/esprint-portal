import { loadReportData } from "@/modules/checks/lib/report-data";
import { ReportView } from "@/modules/checks/components/report-view";

export const dynamic = "force-dynamic";

export default async function ReconstructReportPage() {
  const { checks, branches, aeList } = await loadReportData();
  return (
    <ReportView
      title="Reconstruct"
      description="Checks under reconstruction / restructured payment."
      statuses={["RECONSTRUCT", "RECON REPLACED", "RECON REPLACEMENT"]}
      checks={checks}
      branches={branches}
      aeList={aeList}
    />
  );
}
