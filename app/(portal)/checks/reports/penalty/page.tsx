import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { PenaltyClient } from "./PenaltyClient";

export const dynamic = "force-dynamic";

export default async function PenaltyReportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");
  return <PenaltyClient />;
}
