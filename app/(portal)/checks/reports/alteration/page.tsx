import { redirect } from "next/navigation";
import { getCheckContext } from "../../lib/access";
import { serverLoad } from "@/modules/checks/lib/data";
import { computeCheckStatus, compareEvents, groupSortedEvents } from "@/modules/checks/lib/computeStatus";
import { canSeeCheck } from "@/modules/checks/lib/permissions";
import { displayUser } from "@/modules/checks/lib/format";
import { AlterationReportClient } from "./AlterationReportClient";
import { permsFromContext } from "@/modules/checks/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AlterationReportPage() {
  const ctx = await getCheckContext();
  if (!ctx) redirect("/dashboard");

  const data = await serverLoad();
  const perms = permsFromContext(ctx);

  const branchMap  = new Map(data.BRANCHES.map(b => [b.id, b.name]));
  const clientMap  = new Map(data.CLIENTS.map(c => [c.code, c.name]));

  // Build events map
  const eventsMap = groupSortedEvents(data.EVENTS);

  const rows: {
    id:        string;
    evId:      string;
    branch:    string;
    client:    string;
    bank:      string;
    checkDate: string | null;
    original:  number;
    balance:   number;
    aging:     number | null;
    reason:    string;
    recordedBy:string;
    recordedAt:string;
  }[] = [];

  for (const c of data.CHECKS) {
    if (!canSeeCheck(perms, { branch: c.branch, ae: c.ae })) continue;
    const evs = eventsMap.get(c.id) ?? [];
    const alterationEvs = evs.filter(e => e.type === "ALTERATION");
    if (!alterationEvs.length) continue;

    const { totalPaid } = computeCheckStatus(c, evs);
    const balance = Math.max(0, Math.round((c.originalAmount - totalPaid) * 100) / 100);
    const today = new Date().toISOString().slice(0, 10);
    const aging = c.checkDate
      ? Math.floor((new Date(today).getTime() - new Date(c.checkDate).getTime()) / 86400000)
      : null;

    for (const altEv of alterationEvs) {
      rows.push({
        id:         c.id,
        evId:       altEv.id,
        branch:     branchMap.get(c.branch) ?? c.branch,
        client:     clientMap.get(c.client) ?? c.client,
        bank:       `${c.bank ?? ""} ${c.checkNo}`.trim(),
        checkDate:  c.checkDate,
        original:   c.originalAmount,
        balance,
        aging,
        reason:     altEv.reason ?? "",
        recordedBy: displayUser(altEv.recordedBy),
        recordedAt: altEv.recordedAt ?? "",
      });
    }
  }

  rows.sort((a, b) => (b.recordedAt).localeCompare(a.recordedAt));

  return (
    <AlterationReportClient
      initialRows={rows}
      userEmail={ctx.user.email}
      userName={ctx.user.fullName}
      perms={perms}
    />
  );
}
