"use client";

import { useState, useMemo, useRef } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { ymd, monthName, mondayOf, addDays, sameYMD } from "../lib/dates";
import { TYPES, STATUS, DOW, namesMatch, isAdminOrCoordinator, type Job } from "../lib/constants";
import { cleanNetsuiteUrl, buildNetsuiteUrl } from "../lib/netsuite";
import AvailabilityPanel from "./AvailabilityPanel";
import DayDetailModal from "./DayDetailModal";

interface Filters { branch: string; emp: string; type: string; status: string }
interface CalendarViewProps {
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onOpenJob: (payload: { date: string; job?: Job }) => void;
}

export default function CalendarView({ currentMonth, setCurrentMonth, filters, setFilters, onOpenJob }: CalendarViewProps) {
  const { jobs, branches, staff, appUsers, inScope, currentUser, isAdmin, canEditBranch, setJobs, loadJobs, supabase } = useScheduler();
  const [draggedJob,    setDraggedJob]    = useState<Job | null>(null);
  const [dragOverDate,  setDragOverDate]  = useState<string | null>(null);
  const [dayDetail,     setDayDetail]     = useState<{ dateKey: string; jobs: Job[] } | null>(null);
  const dragJustEndedRef = useRef(false);

  const isFieldStaff  = ["senior_fse","junior_fse","field_service_engineer","trainee"].includes(currentUser?.role ?? "");
  const canOpenJobModal = isAdmin || canEditBranch();
  function canDragJob(j: Job) { return !isFieldStaff && canOpenJobModal && (isAdmin || canEditBranch(j.branch_id)); }

  function prevMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday()   { setCurrentMonth(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }); }

  // Build grid
  const firstMon  = mondayOf(currentMonth);
  const lastOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const lastMon   = mondayOf(lastOfMonth);
  const gridEnd   = addDays(lastMon, 6);
  const cells: Date[] = [];
  let cur = new Date(firstMon);
  while (cur <= gridEnd) { cells.push(new Date(cur)); cur = addDays(cur, 1); }
  const today = new Date();

  const staffById  = (id: string) => staff.find((s) => s.id === id);
  const branchById = (id: string) => branches.find((b) => b.id === id);

  const myStaffIds = useMemo(() => {
    if (!currentUser) return [];
    const uName = currentUser.name?.trim().toLowerCase() || "";
    if (!uName) return [];
    const uTokens = uName.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((t) => t.length > 1);
    return staff.filter((s) => {
      const sName = s.name.trim().toLowerCase();
      if (sName === uName || sName.includes(uName) || uName.includes(sName)) return true;
      const sTokens = sName.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((t) => t.length > 1);
      return uTokens.filter((t) => sTokens.includes(t)).length >= 2;
    }).map((s) => s.id);
  }, [currentUser, staff]);

  function isJobAssignedToMe(j: Job) {
    if (!currentUser) return false;
    if (myStaffIds.includes(j.staff_id)) return true;
    const s = staffById(j.staff_id);
    if (!s) return false;
    const uName = currentUser.name?.trim().toLowerCase() || "";
    const sName = s.name.trim().toLowerCase();
    return sName === uName || sName.includes(uName) || uName.includes(sName);
  }

  function filteredJobs(dateKey: string) {
    return jobs.filter((j) => {
      if (!inScope(j) || j.date !== dateKey) return false;
      if (isFieldStaff) return isJobAssignedToMe(j);
      if (filters.branch && j.branch_id !== filters.branch) return false;
      if (filters.emp    && j.staff_id  !== filters.emp)    return false;
      if (filters.type   && j.type      !== filters.type)   return false;
      if (filters.status && j.status    !== filters.status) return false;
      return true;
    });
  }

  const visibleStaffList = useMemo(() => (staff || []).filter((s) => {
    if (isAdminOrCoordinator(s, appUsers)) return false;
    if (filters.branch && s.home_branch_id !== filters.branch) return false;
    return true;
  }), [staff, appUsers, filters.branch]);

  return (
    <div>
      {/* Toolbar */}
      <div className="sched-toolbar">
        <div className="sched-toolbar-nav">
          <div className="sched-month-nav">
            <button className="sched-btn sched-btn-sm" onClick={prevMonth}>◀</button>
            <div className="sched-month-label">{monthName(currentMonth)}</div>
            <button className="sched-btn sched-btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="sched-btn sched-btn-sm sched-today-btn" onClick={goToday}>Today</button>
          {canOpenJobModal && (
            <button type="button" className="sched-btn sched-btn-primary sched-btn-sm"
              onClick={() => onOpenJob({ date: ymd(new Date()) })}>
              + New Ticket
            </button>
          )}
        </div>

        {!isFieldStaff && (
          <>
            <div className="sched-sep" />
            <div className="sched-filters">
              <div className="sched-fl">
                <label>Branch</label>
                <select className="sched-sel" value={filters.branch}
                  onChange={(e) => {
                    const nb = e.target.value;
                    setFilters((f) => {
                      const empValid = !nb || (staff.find((s) => s.id === f.emp)?.home_branch_id === nb);
                      return { ...f, branch: nb, emp: empValid ? f.emp : "" };
                    });
                  }}>
                  <option value="">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="sched-fl">
                <label>Employee</label>
                <select className="sched-sel" value={filters.emp}
                  onChange={(e) => setFilters((f) => ({ ...f, emp: e.target.value }))}>
                  <option value="">All Staff</option>
                  {visibleStaffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sched-fl">
                <label>Type</label>
                <select className="sched-sel" value={filters.type}
                  onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                  <option value="">All Types</option>
                  <option value="installation">Installation</option>
                  <option value="onsite">Onsite</option>
                  <option value="hotline">Hotline</option>
                  <option value="others">Others</option>
                </select>
              </div>
              <div className="sched-fl">
                <label>Status</label>
                <select className="sched-sel" value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="success">Successful</option>
                  <option value="fail">Not successful</option>
                </select>
              </div>
              {(filters.branch || filters.emp || filters.type || filters.status) && (
                <button className="sched-btn sched-btn-sm sched-btn-ghost"
                  onClick={() => setFilters({ branch: "", emp: "", type: "", status: "" })}>
                  ✕ Reset
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="sched-layout">
        {/* Calendar panel */}
        <div className="sched-panel">
          <div className="sched-panel-head">
            <h2>Monthly Schedule</h2>
            <div className="sched-spacer" />
            <div className="sched-legend">
              {[["var(--sched-t-install)","Installation"],["var(--sched-t-onsite)","Onsite"],["var(--sched-t-hotline)","Hotline"],["var(--sched-t-others)","Others"]].map(([c,l]) => (
                <span key={l} className="sched-li"><span className="sched-swatch" style={{ background: c }} />{l}</span>
              ))}
              {[["var(--sched-st-success)","Done"],["var(--sched-st-ongoing)","Ongoing"],["var(--sched-st-pending)","Pending"],["var(--sched-st-fail)","Failed"]].map(([c,l]) => (
                <span key={l} className="sched-li"><span className="sched-dot-sm" style={{ background: c }} />{l}</span>
              ))}
            </div>
          </div>
          <div className="sched-cal-wrap">
            <div className="sched-cal">
              {DOW.map((d) => <div key={d} className="sched-dow">{d}</div>)}
              {cells.map((cell) => {
                const isOther    = cell.getMonth() !== currentMonth.getMonth();
                const isTodayCell = sameYMD(cell, today);
                const dateKey    = ymd(cell);
                const dayJobs    = filteredJobs(dateKey);
                const isDragOver = dragOverDate === dateKey && draggedJob && draggedJob.date !== dateKey;
                return (
                  <div key={dateKey}
                    className={`sched-cell${isOther ? " sched-other" : ""}${isTodayCell ? " sched-today-cell" : ""}${isDragOver ? " sched-drag-over" : ""}`}
                    style={{ cursor: (isFieldStaff || !canOpenJobModal) ? "default" : "pointer" }}
                    onClick={(isFieldStaff || !canOpenJobModal) ? undefined : () => {
                      if (dragJustEndedRef.current) return;
                      onOpenJob({ date: dateKey });
                    }}
                    onDragOver={(e) => { if (!draggedJob || !canDragJob(draggedJob)) return; e.preventDefault(); setDragOverDate(dateKey); }}
                    onDragEnter={(e) => { if (!draggedJob) return; e.preventDefault(); setDragOverDate(dateKey); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDate(null); }}
                    onDrop={async (e) => {
                      e.preventDefault(); setDragOverDate(null);
                      const jobToMove = draggedJob; setDraggedJob(null);
                      if (!jobToMove || !canDragJob(jobToMove) || jobToMove.date === dateKey) return;
                      setJobs((prev) => prev.map((item) => item.id === jobToMove.id ? { ...item, date: dateKey } : item));
                      await supabase.from("jobs").update({ date: dateKey }).eq("id", jobToMove.id);
                      await loadJobs();
                    }}>
                    <div className="sched-cell-top">
                      <span className="sched-dnum">{cell.getDate()}</span>
                      {!isFieldStaff && canOpenJobModal && (
                        <button type="button" className="sched-cell-add"
                          onClick={(e) => { e.stopPropagation(); onOpenJob({ date: dateKey }); }}>+</button>
                      )}
                    </div>
                    <div className="sched-jobs">
                      {dayJobs.slice(0, 3).map((j) => {
                        const s   = staffById(j.staff_id);
                        const cls = TYPES[j.type]?.cls || "";
                        const isAbsence = j.type === "leave" || j.type === "absent";
                        const jtLabel   = isAbsence ? TYPES[j.type]?.label : j.jt_no;
                        if (isFieldStaff) {
                          return (
                            <div key={j.id} className={`sched-jchip sched-${cls}`} style={{ cursor: "default" }}
                              onClick={(e) => e.stopPropagation()}>
                              <span className={`sched-st sched-${STATUS[j.status]?.dot || ""}`} />
                              <span className="sched-jn">{j.jt_no || "--"}</span>
                            </div>
                          );
                        }
                        const draggable   = canDragJob(j);
                        const isDragging  = draggedJob?.id === j.id;
                        return (
                          <div key={j.id} draggable={draggable}
                            onDragStart={draggable ? (e) => { e.dataTransfer.effectAllowed = "move"; setDraggedJob(j); } : undefined}
                            onDragEnd={draggable ? () => {
                              setDraggedJob(null); setDragOverDate(null);
                              dragJustEndedRef.current = true;
                              setTimeout(() => { dragJustEndedRef.current = false; }, 120);
                            } : undefined}
                            className={`sched-jchip sched-${cls}${isDragging ? " sched-dragging" : ""}${draggable ? " sched-draggable" : ""}`}
                            style={{ cursor: draggable ? "grab" : canOpenJobModal ? "pointer" : "default" }}
                            onClick={canOpenJobModal ? (e) => {
                              e.stopPropagation();
                              if (dragJustEndedRef.current) return;
                              onOpenJob({ date: dateKey, job: j });
                            } : (e) => e.stopPropagation()}>
                            <span className={`sched-st sched-${STATUS[j.status]?.dot || ""}`} />
                            {j.jt_no && !isAbsence ? (
                              <a className="sched-jn sched-jn-link" href={buildNetsuiteUrl(j.jt_no)}
                                target="_blank" rel="noopener noreferrer"
                                draggable={false} onClick={(e) => e.stopPropagation()}>
                                {jtLabel}
                              </a>
                            ) : (
                              <span className="sched-jn">{jtLabel}</span>
                            )}
                            <span className="sched-who">{s?.name?.split(",")[0] || "--"}</span>
                          </div>
                        );
                      })}
                      {dayJobs.length > 3 && (
                        <button type="button" className="sched-more-btn"
                          onClick={(e) => { e.stopPropagation(); setDayDetail({ dateKey, jobs: dayJobs }); }}>
                          +{dayJobs.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Availability panel */}
        <AvailabilityPanel currentMonth={currentMonth} />
      </div>

      {dayDetail && (
        <DayDetailModal dateKey={dayDetail.dateKey} jobs={dayDetail.jobs}
          onClose={() => setDayDetail(null)} onOpenJob={onOpenJob} canOpenJobModal={canOpenJobModal} />
      )}
    </div>
  );
}
