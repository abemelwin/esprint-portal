"use client";

import { useState, useMemo } from "react";
import type { Staff, Branch, Job } from "../types";
import { ymd } from "../dates";
import { ROLES, ROLE_ORDER, TYPES, STATUS } from "../constants";

interface Props {
  currentMonth: Date;
  staff: Staff[];
  branches: Branch[];
  jobs: Job[];
}

// ── Staff status badge (mirrors StaffStatusBadge from original) ───
function StaffStatusBadge({ tasks, absence }: { tasks: Job[]; absence: Job[] }) {
  const hasAbsence = absence.length > 0;
  const absType    = hasAbsence ? absence[0].type : null;

  if (tasks.length === 0 && !hasAbsence) {
    return <span className="sch-badge free">Free</span>;
  }
  if (tasks.length === 0 && hasAbsence) {
    return (
      <span className={`sch-badge ${absType}`}>
        {absType === "leave" ? "🌴 Leave" : "🚫 Absent"}
      </span>
    );
  }
  if (tasks.length === 1 && !hasAbsence) {
    const t         = tasks[0];
    const typeLabel = t.type === "others" && (t as any).type_other?.trim()
      ? (t as any).type_other.trim()
      : TYPES[t.type]?.label ?? t.type;
    const st = STATUS[t.status];
    if (t.status === "success") {
      return (
        <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
          <span className={`sch-type-tag ${TYPES[t.type]?.cls ?? ""}`}>{typeLabel}</span>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <span className={`sch-type-tag ${TYPES[t.type]?.cls ?? ""}`}>{typeLabel}</span>
        <span className={`sch-pill ${st?.cls ?? ""}`}>{st?.label ?? t.status}</span>
      </div>
    );
  }
  // multiple tasks
  const ongoingCount = tasks.filter(t => t.status === "ongoing").length;
  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const failCount    = tasks.filter(t => t.status === "fail").length;
  const cancelCount  = tasks.filter(t => t.status === "cancel").length;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      {hasAbsence && (
        <span className={`sch-badge ${absType}`}>{absType === "leave" ? "🌴 Leave" : "🚫 Absent"}</span>
      )}
      {tasks.length > 0 && (
        <span style={{ fontSize: 10, color: "var(--sch-muted)", fontWeight: 600 }}>{tasks.length} tasks</span>
      )}
      {ongoingCount > 0 && <span className="sch-pill ongoing">{ongoingCount} ongoing</span>}
      {pendingCount > 0 && <span className="sch-pill pending">{pendingCount} next</span>}
      {failCount    > 0 && <span className="sch-pill fail">{failCount} failed</span>}
      {cancelCount  > 0 && <span className="sch-pill cancel">{cancelCount} cancelled</span>}
    </div>
  );
}

// ── Main AvailabilityPanel ────────────────────────────────────────
export function AvailabilityPanel({ currentMonth, staff, branches, jobs }: Props) {
  // Default mode is 'day' — matches original
  const [mode,         setMode]         = useState<"month" | "day">("day");
  const [availDay,     setAvailDay]     = useState(ymd(new Date()));
  const [search,       setSearch]       = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  // Day options for the current month
  const dayOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    const y = currentMonth.getFullYear(), mo = currentMonth.getMonth();
    const last = new Date(y, mo + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(y, mo, d);
      opts.push({
        key:   ymd(dt),
        label: dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return opts;
  }, [currentMonth]);

  function jobsFor(staffId: string): Job[] {
    if (mode === "day") {
      return jobs.filter(j =>
        j.staff_id === staffId && j.date === availDay &&
        j.type !== "leave" && j.type !== "absent"
      );
    }
    const y = currentMonth.getFullYear(), mo = currentMonth.getMonth();
    return jobs.filter(j => {
      if (j.staff_id !== staffId || j.type === "leave" || j.type === "absent") return false;
      const d = new Date(j.date + "T00:00:00");
      return d.getFullYear() === y && d.getMonth() === mo;
    });
  }

  function absenceFor(staffId: string): Job[] {
    if (mode === "day") {
      return jobs.filter(j =>
        j.staff_id === staffId && j.date === availDay &&
        (j.type === "leave" || j.type === "absent")
      );
    }
    const y = currentMonth.getFullYear(), mo = currentMonth.getMonth();
    return jobs.filter(j => {
      if (j.staff_id !== staffId || (j.type !== "leave" && j.type !== "absent")) return false;
      const d = new Date(j.date + "T00:00:00");
      return d.getFullYear() === y && d.getMonth() === mo;
    });
  }

  // Filter + group roster
  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return staff.filter(s => {
      if (term && !s.name.toLowerCase().includes(term)) return false;
      if (branchFilter && s.home_branch_id !== branchFilter) return false;
      return true;
    });
  }, [staff, term, branchFilter]);

  const grouped = useMemo(() =>
    ROLE_ORDER.reduce<Record<string, Staff[]>>((acc, r) => {
      acc[r] = filtered.filter(s => {
        if (r === "manager")     return s.role === "manager";
        if (r === "bsm")         return s.role === "bsm";
        if (r === "coordinator") return s.role === "coordinator";
        if (r === "senior")      return s.role === "senior";
        if (r === "junior")      return s.role === "junior";
        return s.role === r;
      });
      return acc;
    }, {})
  , [filtered]);

  const getBranchLabel = (s: Staff) => {
    const b = branches.find(br => br.id === s.home_branch_id);
    return b ? `🏢 ${b.name}` : "—";
  };

  return (
    <div className="sch-panel avail">
      <div className="sch-panel-head">
        <h2>Staff Schedule</h2>
      </div>

      <div style={{ padding: "11px 13px 0" }}>
        {/* Month / Day toggle */}
        <div className="sch-seg">
          <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>This month</button>
          <button className={mode === "day"   ? "active" : ""} onClick={() => setMode("day")}>Specific day</button>
        </div>

        {/* Day picker */}
        {mode === "day" && (
          <select
            className="sch-sel"
            style={{ marginTop: 8, width: "100%" }}
            value={availDay}
            onChange={e => setAvailDay(e.target.value)}
          >
            {dayOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        )}

        {/* Search + branch filter */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <div className="sch-ovl-search-wrap" style={{ flex: 1, margin: 0 }}>
            <span style={{ fontSize: 12, color: "var(--sch-muted)" }}>🔍</span>
            <input
              placeholder="Search staff…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span
                style={{ fontSize: 10, color: "var(--sch-muted)", cursor: "pointer", padding: "2px 4px" }}
                onClick={() => setSearch("")}
              >✕</span>
            )}
          </div>
          <select
            className="sch-sel"
            style={{ width: "auto", minWidth: 90, fontSize: 12, padding: "4px 6px" }}
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            title="Filter by branch"
          >
            <option value="">All</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="sch-avail-body" style={{ marginTop: 8 }}>
        {ROLE_ORDER.map(r => {
          const grp = grouped[r] ?? [];
          if (!grp.length) return null;
          return (
            <div key={r} className="sch-role-group">
              <h3>
                <span className="sch-swatch" style={{ background: ROLES[r]?.color }} />
                {ROLES[r]?.label}
                <span className="cnt">{grp.length}</span>
              </h3>
              {grp.map(s => {
                const tasks   = jobsFor(s.id);
                const absence = absenceFor(s.id);
                const isFree  = tasks.length === 0 && absence.length === 0;
                return (
                  <div key={s.id} className={`sch-person${isFree ? " free" : " busy"}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                        <span className="sch-pname" title={s.name}>{s.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <StaffStatusBadge tasks={tasks} absence={absence} />
                          {(s as any).hotline && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, fontWeight: 700, color: "#fff", background: "#ea580c", flexShrink: 0 }} title="Hotline Staff">☎</span>
                          )}
                        </div>
                      </div>
                      <div className="sch-pmeta">{getBranchLabel(s)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="sch-empty">
            {term ? `No staff matching "${search}".` : "No staff found."}
          </div>
        )}
      </div>
    </div>
  );
}
