import { serverLoad } from "@/modules/checks/lib/data";
import { buildDashboardSummary } from "@/modules/checks/lib/summary";
import { StatCards } from "@/modules/checks/components/stat-cards";
import { DonutChart, BranchBarChart } from "@/modules/checks/components/charts";
import { fmtPHP, fmtDate, EVENT_LABELS } from "@/modules/checks/lib/format";

export const dynamic = "force-dynamic";

export default async function ChecksDashboardPage() {
  const data = await serverLoad();
  const summary = buildDashboardSummary(data);

  return (
    <div className="animate-fade-in space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* 6 stat cards */}
      <StatCards kpi={summary.kpi} />

      {/* Charts — donut + branch bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-gray-900">Check Status Distribution</h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">Interactive</span>
          </div>
          <DonutChart data={summary.statusChart} />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-gray-900">Branch Share &amp; Export</h3>
            <span className="text-xs text-blue-600 font-bold flex items-center gap-1">&darr; Export full ledger</span>
          </div>
          <BranchBarChart data={summary.branchRows} />
        </div>
      </div>

      {/* Branch table + Recent events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Branch summary */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-sm text-gray-900 mb-1">By branch (your access)</h3>
          <p className="text-xs text-gray-400 mb-3">Click any number to drill down.</p>
          <div className="overflow-x-auto">
            <table className="report w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-semibold uppercase tracking-wide text-[10px]">BRANCH</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">HELD</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">HELD &#8369;</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">RETURNED</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">RETURNED &#8369;</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">STALE</th>
                </tr>
              </thead>
              <tbody>
                {summary.branchRows.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="py-2 font-medium text-gray-800">{b.name}</td>
                    <td className="py-2 text-right text-blue-700 font-semibold">{b.held || "\u2014"}</td>
                    <td className="py-2 text-right text-blue-600 font-mono text-[11px]">{b.heldAmt > 0 ? fmtPHP(b.heldAmt) : "\u2014"}</td>
                    <td className="py-2 text-right text-red-600 font-semibold">{b.returned || "\u2014"}</td>
                    <td className="py-2 text-right text-red-500 font-mono text-[11px]">{b.retAmt > 0 ? fmtPHP(b.retAmt) : "\u2014"}</td>
                    <td className="py-2 text-right text-purple-600 font-semibold">{b.stale || "\u2014"}</td>
                  </tr>
                ))}
                {summary.branchRows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-gray-400 italic">No check data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent events */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent events</h3>
          {summary.recentEvents.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No events recorded yet. Start by encoding a check.</p>
          ) : (
            <div className="space-y-3">
              {summary.recentEvents.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 cursor-pointer hover:bg-blue-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {EVENT_LABELS[ev.type] ?? ev.type}{ev.clientName ? ` \u00b7 ${ev.clientName}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ev.branchName}{ev.checkNo ? ` \u00b7 ${ev.bank} ${ev.checkNo}` : ""} \u00b7 {fmtDate(ev.eventDate)}
                      </div>
                    </div>
                    {ev.amount != null && (
                      <div className="text-xs font-mono font-semibold text-slate-800 shrink-0">{fmtPHP(ev.amount)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
