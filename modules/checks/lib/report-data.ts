import { serverLoad } from "./data";
import { enrichChecks, type EnrichedCheck } from "./enrich";

/** Shared loader for all report pages. */
export async function loadReportData(): Promise<{
  checks: EnrichedCheck[];
  branches: { id: string; name: string }[];
  aeList: string[];
}> {
  const data = await serverLoad();
  return {
    checks: enrichChecks(data),
    branches: data.BRANCHES.map((b) => ({ id: b.id, name: b.name })),
    aeList: data.AE_LIST,
  };
}
