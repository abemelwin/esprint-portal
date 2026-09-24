"use client";

import { useScheduler } from "../lib/SchedulerContext";
import { ymd, fmtD } from "../lib/dates";
import { isAdminOrCoordinator } from "../lib/constants";

interface Filters {
  branch: string;
  emp: string;
  type: string;
  status: string;
}

interface KpiRowProps {
  view: string;
  currentMonth: Date;
  reportMonth: Date;
  onDrill: (kind: string) => void;
  filters: Filters | null;
}

export default function KpiRow({ view, currentMonth, reportMonth, onDrill, filters }: KpiRowProps) {
  const { jobs, staff, appUsers, branches, inScope, visibleStaff, isAdmin, isServiceManager } = useScheduler();

  const isAbsence = (j: { type: string }) => j.type === "leave" || j.type === "absent";

  function matchesFilter(j: { branch_id: string; staff_id: string; type: string; status: string }) {
    if (!filters) return true;
    if (filters.branch && j.branch_id !== filters.branch) return false;
    if (filters.emp    && j.staff_id  !== filters.emp)    return false;
    if (filters.type   && j.type      !== filters.type)   return false;
    if (filters.status && j.status    !== filters.status) return false;
    return true;
  }

  const m = view === "reports" ? reportMonth : currentMonth;
  const monthJobs = jobs.filter((j) => {
    if (!inScope(j)) return false;
    if (isAbsence(j)) return false;
    if (!matchesFilter(j)) return false;
    const d = new Date(j.date + "T00:00:00");
    return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
  });

  const roster = visibleStaff().filter((s) => {
    if (isAdminOrCoordinator(s, appUsers)) return false;
    if (filters?.branch && s.home_branch_id !== filters.branch) return false;
    if (filters?.emp && s.id !== filters.emp) return false;
    return true;
  });
  const total = roster.length;

  const todayKey = ymd(new Date());
  const todayLbl = fmtD(new Date());
  const todayJobs = jobs.filter((j) => {
    if (!inScope(j)) return false;
    if (isAbsence(j)) return false;
    if (!matchesFilter(j)) return false;
    return j.date === todayKey;
  });

  const todayBusy = jobs.filter((j) => {
    if (!inScope(j)) return false;
    if (j.date !== todayKey) return false;
    if (filters?.branch && j.branch_id !== filters.branch) return false;
    return true;
  });
  const todayAssigned = new Set(todayBusy.map((j) => j.staff_id));
  const availToday = roster.filter((s) => !todayAssigned.has(s.id)).length;

  const success = monthJobs.filter((j) => j.status === "success").length;
  const open    = monthJobs.filter((j) => j.status !== "success").length;
  const failed  = monthJobs.filter((j) => j.status === "fail").length;
  const ongoing = monthJobs.filter((j) => j.status === "ongoing").length;
  const pending = monthJobs.filter((j) => j.status === "pending").length;
  const rate    = monthJobs.length ? Math.round((success / monthJobs.length) * 100) : 0;

  const branchObj = filters?.branch ? branches.find((b) => b.id === filters.branch) : null;
  const empObj    = filters?.emp    ? staff.find((s) => s.id === filters.emp)        : null;
  const filterSub = branchObj ? branchObj.name : empObj ? empObj.name : "per branch";

  return (
    <div className="sched-kpis">
      <KpiCard kind="job-today" label="Ongoing Today" value={todayJobs.length}
        foot={<>▸ {todayLbl} · {filterSub}</>} onDrill={onDrill} />
      <KpiCard kind="success" label="Successful (mo.)" value={success}
        foot={<>▸ {rate}% success rate</>} cls="accent-good"
        prefix={<span className="sched-dot" style={{ background: "var(--sched-st-success)" }} />}
        onDrill={onDrill} />
      <KpiCard kind="open" label="Not Yet Successful (mo.)" value={open}
        foot={<>▸ {failed} failed · {ongoing} ongoing · {pending} pending</>}
        cls={open ? "accent-warn" : ""}
        prefix={<span className="sched-dot" style={{ background: "var(--sched-st-fail)" }} />}
        onDrill={onDrill} />
      {(isAdmin || isServiceManager) && (
        <>
          <KpiCard kind="avail-today" label="Available Today" value={availToday}
            foot={<>▸ {todayLbl} · {filterSub}</>} onDrill={onDrill} />
          <KpiCard kind="staff" label="Total Staff" value={total}
            foot={<>▸ {branchObj ? `${branchObj.name} headcount` : empObj ? empObj.name : "per-branch headcount"}</>}
            onDrill={onDrill} />
        </>
      )}
    </div>
  );
}

function KpiCard({
  kind, label, value, foot, cls, prefix, onDrill,
}: {
  kind: string; label: string; value: number;
  foot: React.ReactNode; cls?: string;
  prefix?: React.ReactNode; onDrill: (k: string) => void;
}) {
  return (
    <div className={`sched-kpi sched-kpi-clickable ${cls || ""}`} onClick={() => onDrill(kind)}>
      <div className="sched-kpi-label">{label}</div>
      <div className="sched-kpi-value">{prefix}{value}</div>
      <div className="sched-kpi-foot">{foot}</div>
    </div>
  );
}
