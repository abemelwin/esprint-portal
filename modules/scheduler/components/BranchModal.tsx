"use client";

import { useState } from "react";
import type { Branch } from "../types";

interface Props {
  branches: Branch[];
  onAddBranch: (name: string, note: string) => void;
  onRemoveBranch: (id: string) => void;
  onClose: () => void;
}

export function BranchModal({ branches, onAddBranch, onRemoveBranch, onClose }: Props) {
  const [name,        setName]        = useState("");
  const [note,        setNote]        = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  function handleAdd() {
    if (!name.trim()) return;
    onAddBranch(name.trim(), note.trim());
    setName(""); setNote("");
  }

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-5"
        style={{ background: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)" }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: "var(--sch-s1, #fff)", border: "1px solid var(--sch-border, #e2e8f0)",
          borderRadius: 18, width: "min(520px,96vw)", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px -12px rgba(15,23,42,.28)",
        }}>
          {/* Header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--sch-border, #e2e8f0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sch-ink1, #0f172a)" }}>🏢 Manage Branches</h3>
            <button type="button" className="sch-btn ghost sm" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
            {/* Add form */}
            <div>
              <label className="sch-fld">Branch Name <span className="sch-req">*</span></label>
              <input
                className="sch-sel w-full"
                style={{ marginTop: 4, marginBottom: 10 }}
                placeholder="e.g. CDO"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <label className="sch-fld">Province / Location (optional)</label>
              <input
                className="sch-sel w-full"
                style={{ marginTop: 4, marginBottom: 12 }}
                placeholder="e.g. Misamis Oriental"
                value={note}
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <button
                type="button"
                className="sch-btn primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleAdd}
                disabled={!name.trim()}
              >＋ Add Branch</button>
            </div>

            {/* Branch list */}
            <div style={{ marginTop: 18 }}>
              <label className="sch-fld">Active Branches ({branches.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                {branches.length === 0 && (
                  <div className="sch-empty">No branches yet.</div>
                )}
                {branches.map(b => (
                  <div key={b.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 8,
                    background: "var(--sch-s2, #f1f5f9)", border: "1px solid var(--sch-border, #e2e8f0)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 650, fontSize: 13, color: "var(--sch-ink1, #0f172a)" }}>{b.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--sch-muted, #64748b)" }}>{b.note || "No location specified"}</div>
                    </div>
                    <button
                      type="button"
                      className="sch-btn sm"
                      style={{ color: "#ef4444", borderColor: "rgba(239,68,68,.3)", fontSize: 11 }}
                      onClick={() => setDeleteTarget(b)}
                    >✕ Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 22px", borderTop: "1px solid var(--sch-border, #e2e8f0)", background: "var(--sch-s2, #f1f5f9)", borderRadius: "0 0 18px 18px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="sch-btn ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="sch-btn primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>

      {/* Confirm delete */}
      {deleteTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[70] p-5"
          style={{ background: "rgba(15,23,42,.72)", backdropFilter: "blur(10px)" }}
        >
          <div style={{ background: "var(--sch-s1, #fff)", borderRadius: 16, width: "min(440px,94vw)", overflow: "hidden", boxShadow: "0 24px 60px -12px rgba(0,0,0,.45)" }}>
            <div style={{ padding: "24px 22px 18px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(239,68,68,.12)", border: "1.5px solid rgba(239,68,68,.3)", display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 22, color: "#ef4444" }}>🏢</div>
              <p style={{ margin: "0 0 6px", fontSize: 16.5, fontWeight: 750, color: "var(--sch-ink1, #0f172a)" }}>Remove Branch?</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--sch-muted, #64748b)" }}>
                Remove &quot;{deleteTarget.name}&quot;? Staff and jobs assigned to this branch may be affected.
              </p>
            </div>
            <div style={{ padding: "14px 20px", background: "var(--sch-s2, #f1f5f9)", borderTop: "1px solid var(--sch-border, #e2e8f0)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="sch-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                type="button"
                className="sch-btn"
                style={{ background: "linear-gradient(180deg,#ef4444,#dc2626)", color: "#fff", borderColor: "#dc2626" }}
                onClick={() => { onRemoveBranch(deleteTarget.id); setDeleteTarget(null); }}
              >Remove Branch</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
