import { redirect } from "next/navigation";
import { loadReportData } from "@/modules/checks/lib/report-data";
import { getCheckContext } from "../lib/access";
import { permsFromContext, canSeeCheck } from "@/modules/checks/lib/permissions";
import { AEDashboardClient, type AESummary } from "./AEDashboardClient";
import type { EnrichedCheck } from "@/modules/checks/lib/enrich";

export const dynamic = "force-dynamic";

/** Statuses considered "pending" (not yet resolved). Mirrors the original. */
const PENDING_STATUSES = ["HELD", "RETURNED", "PARTIAL", "OPEN", "DEPOSITED"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AEDashboardPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  // Team Leaders (AE Access managing >1 AE) and admins can view this page.
  // A plain AE or single-AE account gets bounced to their Client Report.
  const isTL = ctx.role === "AE Access" && ctx.aes.length > 1;
  if (!isTL && !ctx.isAdmin && ctx.role !== "Super Admin") {
    redirect("/checks/reports/clients");
  }

  const perms = permsFromContext(ctx);
  const { checks, branches } = await loadReportData();
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  // The AE codes this Team Leader is responsible for.
  // If the user has no explicit AE scope (e.g. Admin), fall back to every AE
  // that appears in the checks they can see.
  const visible = checks.filter((c) => canSeeCheck(perms, c));
  const assignedAEs =
    perms.aes.length > 0
      ? perms.aes
      : Array.from(
          new Set(
            visible.map((c) => c.ae).filter((a): a is string => !!a)
          )
        ).sort();

  const today = todayISO();

  const summaries: AESummary[] = assignedAEs.map((aeCode) => {
    const aeChecks = visible.filter((c) => c.ae === aeCode);

    const branchIds = Array.from(new Set(aeChecks.map((c) => c.branch)));
    const branchLabels = branchIds.map((b) => branchName.get(b) ?? b);
    const subsidiaries = Array.from(
      new Set(aeChecks.map((c) => c.subsidiary ?? "—"))
    );

    let pendingCount = 0;
    let pendingAmount = 0;
    let overdueCount = 0;

    for (const c of aeChecks) {
      if (PENDING_STATUSES.includes(c.status)) {
        pendingCount++;
        pendingAmount += c.balance ?? 0;
      }
      if (
        c.status === "HELD" &&
        c.nextDeposit &&
        c.nextDeposit < today
      ) {
        overdueCount++;
      }
    }

    return {
      aeCode,
      subsidiaries,
      branches: branchLabels,
      totalChecks: aeChecks.length,
      pendingCount,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      overdueCount,
    };
  });

  return <AEDashboardClient summaries={summaries} />;
}
