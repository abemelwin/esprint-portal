"use client";

import type { Job, Staff, Branch, SchedulerFilters } from "../types";
import { ymd, fmtD, monthName } from "../dates";
import type { DrillKind } from "./KpiDrillModal";

interface Props {
  view: string;
  currentMonth: Date;
  reportMonth: Date;
  jobs: Job[];
  staff: Staff[];
  branches: Branch[];
  filters: SchedulerFilters | null;
  isAdmin: boolean;
  onDrill?: (kind: DrillKind) => void;
}

export function KpiRow({
  view, currentMonth, reportMonth, jobs, staff, branches, filters, isAdmin, onDrill,
}: Props) {
  const m     = view === "reports" ? reportMonth : currentMonth;
  const today = ymd(new Date());

  const isAbsence = (j: Job) => j.type === "leave" || j.type === "absent";

  function matches(j: Job) {
    if (!filters) return true;
    if (filters.branch && j.branch_id !== filters.branch) return false;
    if (filters.emp    && j.staff_id  !== filters.emp)    return false;
    if (filters.type   && j.type      !== filters.type)   return false;
    if (filters.status && j.status    !== filters.status) return false;
    return true;
  }

  const monthJobs = jobs.filter(j => {
    if (isAbsence(j))      return false;
    if (!matches(j))       return false;
    const d = new Date(j.date + "T00:00:00");
    return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
  });

  const todayJobs = jobs.filter(j => {
    if (isAbsence(j))    return false;
    if (!matches(j))     return false;
    return j.date === today;
  });

  const fieldRoles = ["senior", "junior", "trainee"];
  const roster     = staff.filter(s => fieldRoles.includes(s.role));
  const busyToday  = new Set(jobs.filter(j => j.date === today).map(j => j.staff_id));
  const availToday = roster.filter(s => !busyToday.has(s.id)).length;

  const success = monthJobs.filter(j => j.status === "success").length;
  const open    = monthJobs.filter(j => j.status !== "success").length;
  const failed  = monthJobs.filter(j => j.status === "fail").length;
  const ongoing = monthJobs.filter(j => j.status === "ongoing").length;
  const pending = monthJobs.filter(j => j.status === "pending").length;
  const rate    = monthJobs.length ? Math.round((success / monthJobs.length) * 100) : 0;

  return (
    <div className="sch-kpis">
      <KpiCard
        label="Ongoing Today"
        value={todayJobs.length}
        foot={`▸ ${fmtD(new Date())}`}
        onClick={() => onDrill?.("job-today")}
      />
      <KpiCard
        label="Successful (mo.)"
        value={success}
        foot={`▸ ${rate}% success rate`}
        cls="good"
        prefix={<span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--sch-success)", marginRight: 6, verticalAlign: "middle" }} />}
        onClick={() => onDrill?.("success")}
      />
      <KpiCard
        label="Not Yet Successful (mo.)"
        value={open}
        foot={`▸ ${failed} failed · ${ongoing} ongoing · ${pending} pending`}
        cls={open ? "warn" : ""}
        prefix={<span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--sch-fail)", marginRight: 6, verticalAlign: "middle" }} />}
        onClick={() => onDrill?.("open")}
      />
      {isAdmin && (
        <>
          <KpiCard
            label="Available Today"
            value={availToday}
            foot={`▸ ${fmtD(new Date())} · field staff`}
            onClick={() => onDrill?.("avail-today")}
          />
          <KpiCard
            label="Total Field Staff"
            value={roster.length}
            foot="▸ per-branch headcount"
            onClick={() => onDrill?.("staff")}
          />
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, foot, cls, prefix, onClick }: {
  label: string;
  value: number;
  foot: string;
  cls?: string;
  prefix?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`sch-kpi ${cls ?? ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{prefix}{value}</div>
      <div className="kpi-foot">{foot}</div>
    </div>
  );
}
