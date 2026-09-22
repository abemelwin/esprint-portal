import { fmtPHP, fmtDate, todayISO, STALE_DAYS } from "../lib/format";
import type { KpiTotals } from "../lib/summary";

/** The 6 KPI stat cards — matching the original dashboard exactly. */
export function StatCards({ kpi }: { kpi: KpiTotals }) {
  const stats = [
    { label: "HELD", value: kpi.held.count, sub: fmtPHP(kpi.held.amount), tag: "Open", tagCls: "bg-blue-50 text-blue-700", valueCls: "text-blue-700" },
    { label: "RETURNED (OPEN)", value: kpi.returned.count, sub: fmtPHP(kpi.returned.amount), tag: "Returned", tagCls: "bg-red-50 text-red-700", valueCls: "text-red-600" },
    { label: "PARTIALLY PAID", value: kpi.partial.count, sub: fmtPHP(kpi.partial.amount), tag: "Partial", tagCls: "bg-amber-50 text-amber-700", valueCls: "text-amber-600" },
    { label: "DUE TODAY", value: kpi.dueToday.count, sub: fmtDate(todayISO()), tag: "Today", tagCls: "bg-slate-100 text-slate-700", valueCls: "text-slate-900" },
    { label: "OVERDUE HOLDS", value: kpi.overdue.count, sub: "Past move date", tag: "Late", tagCls: "bg-amber-50 text-amber-800", valueCls: "text-amber-700" },
    { label: "STALE CHECKS", value: kpi.stale.count, sub: fmtPHP(kpi.stale.amount) + ` \u00b7 >${STALE_DAYS}d`, tag: "Stale", tagCls: "bg-purple-50 text-purple-700", valueCls: "text-purple-700" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="stat-card clickable">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold leading-tight">{s.label}</div>
            <div className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${s.tagCls}`}>{s.tag}</div>
          </div>
          <div className={`mt-3 text-3xl font-bold ${s.valueCls}`}>{s.value}</div>
          <div className="mt-1 text-xs text-slate-500">{s.sub}</div>
          <div className="mt-4 text-[10px] text-slate-400 flex items-center justify-between">
            <span>View breakdown</span><span>&rarr;</span>
          </div>
        </div>
      ))}
    </div>
  );
}
