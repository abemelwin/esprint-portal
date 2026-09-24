"use client";

import { useState } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import ConfirmModal from "./ConfirmModal";

interface BranchModalProps {
  onClose: () => void;
}

export default function BranchModal({ onClose }: BranchModalProps) {
  const { branches, loadBranches, supabase } = useScheduler();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    await supabase.from("branches").insert({ name: name.trim(), note: note.trim() });
    await loadBranches();
    setName(""); setNote("");
    setBusy(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    await supabase.from("branches").delete().eq("id", deleteTarget.id);
    await loadBranches();
    setDeleteTarget(null);
    setBusy(false);
  }

  return (
    <>
      <div className="sched-modal-bg">
        <div className="sched-modal">
          <div className="sched-modal-head">
            <h3>🏢 Manage Branches</h3>
            <div className="sched-spacer" />
            <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={onClose}>✕</button>
          </div>
          <div className="sched-modal-body">
            <label className="sched-fld">Branch name</label>
            <input type="text" className="sched-txt" placeholder="e.g. SM City Baguio"
              value={name} onChange={(e) => setName(e.target.value)} />
            <label className="sched-fld" style={{ marginTop: 10 }}>Province / Location (optional)</label>
            <input type="text" className="sched-txt" placeholder="e.g. Benguet"
              value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="sched-btn sched-btn-primary" style={{ marginTop: 12, width: "100%" }}
              onClick={handleAdd} disabled={busy || !name.trim()}>
              ＋ Add branch
            </button>
            <div style={{ marginTop: 16 }}>
              <label className="sched-fld">Active Branches ({branches.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {branches.map((b) => (
                  <div key={b.id} className="sched-person" style={{ justifyContent: "space-between", padding: "8px 12px" }}>
                    <div>
                      <div className="sched-pname">{b.name}</div>
                      <div className="sched-pmeta">{b.note || "No location specified"}</div>
                    </div>
                    <button type="button" className="sched-btn sched-btn-sm sched-btn-danger-sm"
                      onClick={() => setDeleteTarget(b)}>✕ Remove</button>
                  </div>
                ))}
                {branches.length === 0 && <div className="sched-empty-note">No branches yet.</div>}
              </div>
            </div>
          </div>
          <div className="sched-modal-foot">
            <button className="sched-btn sched-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="sched-btn sched-btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove Branch?"
        message={`Remove branch "${deleteTarget?.name}"? Staff and jobs assigned to it may be affected.`}
        confirmText="Remove Branch"
        confirmVariant="danger"
        isBusy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
