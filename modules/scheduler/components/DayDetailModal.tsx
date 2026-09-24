"use client";

import { useScheduler } from "../lib/SchedulerContext";
import { TYPES, STATUS, type Job } from "../lib/constants";
import { buildNetsuiteUrl } from "../lib/netsuite";
import { parseYMD } from "../lib/dates";

interface DayDetailModalProps {
  dateKey: string;
  jobs: Job[];
  onClose: () => void;
  onOpenJob: (payload: { date: string; job?: Job }) => void;
  canOpenJobModal: boolean;
}

export default function DayDetailModal({ dateKey, jobs, onClose, onOpenJob, canOpenJobModal }: DayDetailModalProps) {
  const { staff, branches } = useScheduler();

  const staffById  = (id: string) => staff.find((s) => s.id === id);
  const branchById = (id: string) => branches.find((b) => b.id === id);

  const date  = parseYMD(dateKey);
  const label = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="sched-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sched-modal" style={{ width: "min(560px, 96vw)" }}>
        <div className="sched-modal-head">
          <div>
            <h3 style={{ margin: 0 }}>📅 {label}</h3>
            <div style={{ fontSize: 12, color: "var(--sched-muted)", marginTop: 2 }}>
              {jobs.length} job ticket{jobs.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="sched-spacer" />
          <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="sched-modal-body" style={{ padding: "10px 14px" }}>
          {jobs.length === 0 && <div className="sched-empty-note">No job tickets on this day.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {jobs.map((j) => {
              const s   = staffById(j.staff_id);
              const b   = branchById(j.branch_id);
              const cls = TYPES[j.type]?.cls || "";
              const isAbsence = j.type === "leave" || j.type === "absent";
              return (
                <div
                  key={j.id}
                  className={`sched-day-row sched-jchip sched-${cls}`}
                  style={{ padding: "9px 11px", borderRadius: 9, cursor: canOpenJobModal ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 4 }}
                  onClick={canOpenJobModal ? () => { onOpenJob({ date: dateKey, job: j }); onClose(); } : undefined}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className={`sched-st sched-${STATUS[j.status]?.dot || ""}`} />
                    {j.jt_no && !isAbsence ? (
                      <a className="sched-jn sched-jn-link" href={buildNetsuiteUrl(j.jt_no)} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}>{j.jt_no || "--"}</a>
                    ) : (
                      <span className="sched-jn">{isAbsence ? TYPES[j.type]?.label : (j.jt_no || "—")}</span>
                    )}
                    {!isAbsence && <span className={`sched-type-tag sched-${cls}`}>{TYPES[j.type]?.label}</span>}
                    <span className={`sched-pill sched-${STATUS[j.status]?.cls || ""}`} style={{ marginLeft: "auto" }}>
                      {STATUS[j.status]?.label || j.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--sched-ink-2)" }}>
                    {s && <span>👤 {s.name}</span>}
                    {b && <span>📍 {b.name}</span>}
                    {j.customer && <span>🏢 {j.customer}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sched-modal-foot">
          {canOpenJobModal && (
            <button className="sched-btn sched-btn-primary sched-btn-sm"
              onClick={() => { onOpenJob({ date: dateKey }); onClose(); }}>
              ＋ Add Ticket
            </button>
          )}
          <button className="sched-btn sched-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
