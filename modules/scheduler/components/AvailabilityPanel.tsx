"use client";

import { useState, useMemo } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { ymd } from "../lib/dates";
import {
  ROLES, ROLE_ORDER, TYPES, STATUS, formatBranchSummary,
  namesMatch, DESIGNATED_MANAGERS, isAdminOrCoordinator,
  type StaffMember, type AppUser,
} from "../lib/constants";

// ── Status badge ──────────────────────────────────────────────────────────────
function StaffStatusBadge({ tasks, absence }: { tasks: any[]; absence: any[] }) {
  const hasAbsence  = (absence as any[]).length > 0;
  const absenceType = hasAbsence ? (absence as any[])[0].type : null;

  if ((tasks as any[]).length === 0 && !hasAbsence)
    return <span className="sched-badge sched-badge-free">Free</span>;

  if ((tasks as any[]).length === 0)
    return <span className={`sched-badge sched-badge-${absenceType}`}>{absenceType === "leave" ? "🌴 Leave" : "🚫 Absent"}</span>;

  if ((tasks as any[]).length === 1 && !hasAbsence) {
    const t = (tasks as any[])[0];
    const typeLabel = t.type === "others" && t.type_other?.trim() ? t.type_other.trim() : TYPES[t.type]?.label || t.type;
    if (t.status === "success")
      return <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><span className={`sched-type-tag sched-${TYPES[t.type]?.cls || ""}`}>{typeLabel}</span></div>;
    return (
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <span className={`sched-type-tag sched-${TYPES[t.type]?.cls || ""}`}>{typeLabel}</span>
        <span className={`sched-pill sched-${STATUS[t.status]?.cls || ""}`}>{STATUS[t.status]?.label || t.status}</span>
      </div>
    );
  }

  const ongoing  = (tasks as any[]).filter((t) => t.status === "ongoing").length;
  const pending  = (tasks as any[]).filter((t) => t.status === "pending").length;
  const fail     = (tasks as any[]).filter((t) => t.status === "fail").length;
  const cancel   = (tasks as any[]).filter((t) => t.status === "cancel").length;

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      {hasAbsence && <span className={`sched-badge sched-badge-${absenceType}`}>{absenceType === "leave" ? "🌴 Leave" : "🚫 Absent"}</span>}
      {(tasks as any[]).length > 0 && <span style={{ fontSize: 10, color: "var(--sched-muted)", fontWeight: 600 }}>{(tasks as any[]).length} tasks</span>}
      {ongoing > 0 && <span className="sched-pill sched-ongoing">{ongoing} ongoing</span>}
      {pending > 0 && <span className="sched-pill sched-pending">{pending} next</span>}
      {fail    > 0 && <span className="sched-pill sched-fail">{fail} failed</span>}
      {cancel  > 0 && <span className="sched-pill sched-cancel">{cancel} cancelled</span>}
    </div>
  );
}

export default function AvailabilityPanel({ currentMonth }: { currentMonth: Date }) {
  const { jobs, inScope, visibleStaff, branches, staff, appUsers, currentUser, editableBranchIds, scopedBranchIds, loadStaff, loadAppUsers, loadJobs, isAdmin } = useScheduler();
  const [mode,         setMode]         = useState("month");
  const [availDay,     setAvailDay]     = useState(ymd(new Date()));
  const [search,       setSearch]       = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const isFieldStaff    = ["senior_fse","junior_fse","field_service_engineer","trainee","senior","junior"].includes(currentUser?.role ?? "");
  const isServiceManager = currentUser?.role === "service_manager" || currentUser?.role === "branch";

  const dayOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(y, m, d);
      opts.push({ key: ymd(dt), label: dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) });
    }
    return opts;
  }, [currentMonth]);

  const myBranchCodes = useMemo(() => {
    if (!currentUser) return [];
    const ids = [
      ...(currentUser.main_branch_id ? [currentUser.main_branch_id] : []),
      ...(currentUser.edit_branch_ids || []), ...(currentUser.branch_ids || []), ...(currentUser.view_branch_ids || []),
    ];
    const myStaffObj = staff?.find((s) => s.name?.trim().toLowerCase() === currentUser.name?.trim().toLowerCase());
    if (myStaffObj?.home_branch_id && !ids.includes(myStaffObj.home_branch_id)) ids.push(myStaffObj.home_branch_id);
    return Array.from(new Set(ids.map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean))) as string[];
  }, [currentUser, staff, branches]);

  function tasksFor(staffId: string) {
    if (mode === "day") return jobs.filter((j) => inScope(j) && j.staff_id === staffId && j.date === availDay && j.type !== "leave" && j.type !== "absent");
    const y = currentMonth.getFullYear(), mo = currentMonth.getMonth();
    return jobs.filter((j) => {
      if (!inScope(j) || j.staff_id !== staffId || j.type === "leave" || j.type === "absent") return false;
      const d = new Date(j.date + "T00:00:00");
      return d.getFullYear() === y && d.getMonth() === mo;
    });
  }

  function absenceFor(staffId: string) {
    if (mode === "day") return jobs.filter((j) => inScope(j) && j.staff_id === staffId && j.date === availDay && (j.type === "leave" || j.type === "absent"));
    const y = currentMonth.getFullYear(), mo = currentMonth.getMonth();
    return jobs.filter((j) => {
      if (!inScope(j) || j.staff_id !== staffId || (j.type !== "leave" && j.type !== "absent")) return false;
      const d = new Date(j.date + "T00:00:00");
      return d.getFullYear() === y && d.getMonth() === mo;
    });
  }

  function isPersonCoordinator(s: StaffMember): boolean {
    const r = (s.role || "").toLowerCase();
    if (r === "coordinator" || r === "service_coordinator") return true;
    const sNorm = (s.name || "").trim().toLowerCase();
    const des = DESIGNATED_MANAGERS.find((m) => {
      if (m.filterMatch) return m.filterMatch(sNorm);
      return sNorm.includes(m.nameKey) || (m.fullName && namesMatch(m.fullName, s.name));
    });
    if (des?.role === "coordinator") return true;
    const mu = appUsers?.find((u) => u.name && namesMatch(u.name, s.name));
    return !!(mu && (mu.role === "service_coordinator" || mu.role === "coordinator"));
  }

  function getStaffBranchInfo(s: StaffMember): { label: string; isAll: boolean; branchIds: string[] } {
    if (!s) return { label: "—", isAll: false, branchIds: [] };
    const sNorm = (s.name || "").trim().toLowerCase();
    if (s.role === "admin") return { label: "🌐 All Branches (Admin)", isAll: true, branchIds: branches.map((b) => b.id) };
    if (isPersonCoordinator(s)) return { label: "🌐 All Branches (Coordinator)", isAll: true, branchIds: branches.map((b) => b.id) };
    const mu = appUsers?.find((u) => { const un = u.name?.trim().toLowerCase() || ""; return un && (un === sNorm || sNorm.includes(un) || un.includes(sNorm)); });
    if (mu) {
      if (mu.role === "admin") return { label: "🌐 All Branches (Admin)", isAll: true, branchIds: branches.map((b) => b.id) };
      const uBranches = mu.branch_ids || [];
      const label     = formatBranchSummary(uBranches, branches);
      return { label: label !== "—" ? `🏢 ${label}` : "—", isAll: label === "All Branches", branchIds: uBranches };
    }
    const des = DESIGNATED_MANAGERS.find((m) => { if (m.filterMatch) return m.filterMatch(sNorm); return sNorm.includes(m.nameKey); });
    if (des) {
      const bIds = des.branchCodes.map((c) => branches.find((b) => b.name === c)?.id).filter(Boolean) as string[];
      return { label: des.label, isAll: false, branchIds: bIds };
    }
    const homeB = branches.find((b) => b.id === s.home_branch_id);
    if (!homeB) return { label: "—", isAll: false, branchIds: [] };
    return { label: `🏢 ${homeB.name}`, isAll: false, branchIds: [homeB.id] };
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredRoster = useMemo(() => {
    if (isFieldStaff) {
      return DESIGNATED_MANAGERS
        .filter((d) => d.role !== "coordinator" && (myBranchCodes.length === 0 || d.branchCodes.some((c) => myBranchCodes.includes(c))))
        .map((des) => {
          const found = staff?.find((s) => { const sn = s.name.trim().toLowerCase(); return des.filterMatch ? des.filterMatch(sn) : sn.includes(des.nameKey) || namesMatch(des.fullName, s.name); });
          return found ? { ...found, role: des.role, _displayLabel: des.label } : { id: "des-" + des.nameKey, name: des.fullName, role: des.role, home_branch_id: "", hotline: false, _displayLabel: des.label };
        });
    }
    if (isServiceManager) {
      const myIds = (editableBranchIds && editableBranchIds.length > 0) ? editableBranchIds : (scopedBranchIds || []);
      return (staff || []).filter((s) => {
        if (s.name?.toLowerCase().includes("eileen")) return false;
        if (!isAdmin && isPersonCoordinator(s)) return false;
        const r = (s.role || "").toLowerCase();
        const isTech = ["senior","senior_fse","junior","junior_fse","field_service_engineer","trainee"].includes(r);
        if (!isTech) return false;
        if (myIds.length > 0 && !myIds.includes(s.home_branch_id)) return false;
        return !searchTerm || s.name.toLowerCase().includes(searchTerm);
      });
    }

    let roster = [...visibleStaff()];
    DESIGNATED_MANAGERS.forEach((des) => {
      if (des.role === "coordinator" && !isAdmin) return;
      const idx = roster.findIndex((s) => { const sn = s.name.trim().toLowerCase(); return des.filterMatch ? des.filterMatch(sn) : sn.includes(des.nameKey) || namesMatch(des.fullName, s.name); });
      if (idx >= 0) roster[idx] = { ...roster[idx], role: des.role, _displayLabel: des.label } as any;
      else roster.push({ id: "des-" + des.nameKey, name: des.fullName, role: des.role, home_branch_id: "", hotline: false, _displayLabel: des.label } as any);
    });
    appUsers.forEach((u) => {
      if (!u.name || u.email?.toLowerCase().includes("eileen")) return;
      const isCoord = u.role === "service_coordinator" || u.role === "coordinator";
      if (isCoord && !isAdmin) return;
      const existing = roster.findIndex((s) => namesMatch(s.name, u.name));
      if (existing < 0 && (isCoord || u.role === "service_manager")) {
        roster.push({ id: u.id, name: u.name, role: isCoord ? "coordinator" : "manager", home_branch_id: u.main_branch_id || u.branch_ids?.[0] || "", hotline: false, _displayLabel: isCoord ? "🌐 All Branches (Coordinator)" : undefined } as any);
      }
    });
    if (!isAdmin) roster = roster.filter((s) => !isPersonCoordinator(s));
    return roster.filter((s) => {
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm)) return false;
      if (branchFilter) { const info = getStaffBranchInfo(s); return info.isAll || info.branchIds.includes(branchFilter); }
      return true;
    });
  }, [isFieldStaff, isServiceManager, myBranchCodes, staff, visibleStaff, searchTerm, branchFilter, branches, appUsers, isAdmin]);

  const activeRoles = isFieldStaff
    ? ["manager","bsm"]
    : isServiceManager
      ? ["senior","junior","trainee"]
      : isAdmin ? ROLE_ORDER : ROLE_ORDER.filter((r) => r !== "coordinator");

  const grouped = activeRoles.reduce<Record<string, typeof filteredRoster>>((acc, r) => {
    acc[r] = filteredRoster.filter((s: any) => {
      const isCoord = isPersonCoordinator(s as StaffMember) || s.role === "coordinator" || s.role === "service_coordinator";
      if (isCoord) return !isAdmin ? false : r === "coordinator";
      if (r === "coordinator") return false;
      if (r === "manager") return s.role === "manager" || s.role === "service_manager";
      if (r === "senior") return s.role === "senior" || s.role === "senior_fse";
      if (r === "junior") return s.role === "junior" || s.role === "junior_fse" || s.role === "field_service_engineer";
      return s.role === r;
    });
    return acc;
  }, {});

  return (
    <div className="sched-panel sched-avail">
      <div className="sched-panel-head">
        <h2>{isFieldStaff ? "Assigned Managers" : "Staff Schedule"}</h2>
      </div>
      <div style={{ padding: "11px 13px 0" }}>
        <div className="sched-seg-toggle">
          <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>This month</button>
          <button className={mode === "day"   ? "active" : ""} onClick={() => setMode("day")}>Specific day</button>
        </div>
        {mode === "day" && (
          <select className="sched-sel" style={{ marginTop: 8, width: "100%" }} value={availDay} onChange={(e) => setAvailDay(e.target.value)}>
            {dayOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        )}
        {!isFieldStaff && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <div className="sched-search-wrap" style={{ flex: 1 }}>
              <span>🔍</span>
              <input className="sched-search-input" placeholder="Search staff…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <span style={{ cursor: "pointer" }} onClick={() => setSearch("")}>✕</span>}
            </div>
            {!isServiceManager && (
              <select className="sched-sel" style={{ width: "auto", minWidth: 90, fontSize: 12 }}
                value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="sched-avail-body">
        {activeRoles.map((r) => {
          const grp = grouped[r] || [];
          if (!grp.length) return null;
          return (
            <div key={r} className="sched-role-group">
              <h3>
                <span className="sched-swatch" style={{ background: ROLES[r]?.color }} />
                {ROLES[r]?.label}
                <span className="sched-cnt">{grp.length}</span>
              </h3>
              {grp.map((s: any) => {
                const tasks   = tasksFor(s.id);
                const absence = absenceFor(s.id);
                const rawInfo = getStaffBranchInfo(s as StaffMember);
                const branchInfo = isPersonCoordinator(s as StaffMember)
                  ? { label: "🌐 All Branches (Coordinator)", isAll: true }
                  : s._displayLabel
                    ? { label: s._displayLabel, isAll: s._displayLabel.includes("🌐") }
                    : rawInfo;
                return (
                  <div key={s.id} className={`sched-person${tasks.length === 0 && absence.length === 0 ? " sched-free" : " sched-busy-row"}`}>
                    <div className="sched-person-main">
                      <div className="sched-person-top">
                        <div className="sched-pname" title={s.name}>{s.name}</div>
                        <div className="sched-person-status">
                          <StaffStatusBadge tasks={tasks as any} absence={absence as any} />
                          {s.hotline && <span className="sched-htag" title="Hotline Staff">☎</span>}
                        </div>
                      </div>
                      <div className="sched-pmeta"
                        style={{ color: branchInfo.isAll ? "var(--sched-senior)" : "var(--sched-muted)", fontWeight: branchInfo.isAll ? 600 : 400 }}>
                        {branchInfo.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {filteredRoster.length === 0 && (
          <div className="sched-empty-note">
            {isFieldStaff ? "No manager assigned for your branch." : searchTerm ? `No staff matching "${search}".` : "No staff found."}
          </div>
        )}
      </div>
    </div>
  );
}
