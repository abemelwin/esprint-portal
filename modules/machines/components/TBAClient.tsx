"use client";

import { useState, useEffect, useMemo } from "react";
import type { TBAListItem, Machine, LookupData } from "../types";
import { Modal, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Field, Grid2, Input, Textarea, Banner } from "../ui/Field";
import { LookupSelect } from "../ui/LookupSelect";

// ── helpers ────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const DASH = <span className="text-[var(--text-muted)]">—</span>;

type TBAForm = {
  brand: string;
  model: string;
  client_name: string;
  client_code: string;
  location: string;
  ae: string;
  reservation_date: string;
  notes: string;
};

const emptyForm = (): TBAForm => ({
  brand: "", model: "", client_name: "", client_code: "",
  location: "", ae: "", reservation_date: today(), notes: "",
});

function fromItem(t: TBAListItem): TBAForm {
  return {
    brand:            t.brand            ?? "",
    model:            t.model,
    client_name:      t.client_name      ?? "",
    client_code:      t.client_code      ?? "",
    location:         t.location         ?? "",
    ae:               t.ae               ?? "",
    reservation_date: t.reservation_date ?? today(),
    notes:            t.notes            ?? "",
  };
}

// ── props ──────────────────────────────────────────────────────
interface Props {
  canReserve?: boolean;
  canViewAllClients?: boolean;
  aeCode?: string | null;
  approvedAEs?: string[];
}

export function TBAClient({
  canReserve = false,
  canViewAllClients = false,
  aeCode = null,
  approvedAEs = [],
}: Props) {
  const [tbaList,  setTbaList]  = useState<TBAListItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [lookups,  setLookups]  = useState<LookupData>({
    branches: [], aes: [], brands: [], models: [], reorder_points: [],
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [q,      setQ]      = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fModel, setFModel] = useState("");
  const [fAE,    setFAE]    = useState("");

  // Modal state
  const [editTarget, setEditTarget] = useState<TBAListItem | null>(null);
  const [addOpen,    setAddOpen]    = useState(false);
  const [form,       setForm]       = useState<TBAForm>(emptyForm());
  const [fErr,       setFErr]       = useState("");
  const [saving,     setSaving]     = useState(false);

  // ── AE / client masking ────────────────────────────────────────
  const aeSet = useMemo(() => {
    const s = new Set<string>();
    if (aeCode) s.add(aeCode.trim());
    approvedAEs.forEach((a) => { const t = a.trim(); if (t) s.add(t); });
    return s;
  }, [aeCode, approvedAEs]);

  const hideCols = !canViewAllClients && aeSet.size === 0;

  function canSeeClient(machineAE: string | null) {
    if (canViewAllClients) return true;
    return aeSet.has((machineAE ?? "").trim());
  }

  // ── data loading ───────────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    try {
      const [tRes, mRes, lRes] = await Promise.all([
        fetch("/api/machines/tba"),
        fetch("/api/machines"),
        fetch("/api/machines/lookups"),
      ]);
      const tData = await tRes.json();
      const mData = await mRes.json();
      const lData = await lRes.json();
      if (tData.tba)      setTbaList(tData.tba);
      if (mData.machines) setMachines(mData.machines);
      if (lData.branches) setLookups(lData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // ── modal helpers ──────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFErr("");
    setAddOpen(true);
  };

  const openEdit = (t: TBAListItem) => {
    setEditTarget(t);
    setForm(fromItem(t));
    setFErr("");
    setAddOpen(true);
  };

  const set = (k: keyof TBAForm) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── save ───────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.model.trim())       { setFErr("Please enter a Model.");       return; }
    if (!form.client_name.trim()) { setFErr("Please enter a Client Name."); return; }
    setSaving(true);
    setFErr("");
    try {
      if (editTarget) {
        // PATCH: delete old + insert new (API doesn't expose PUT for TBA)
        await fetch(`/api/machines/tba?id=${editTarget.id}`, { method: "DELETE" });
        await fetch("/api/machines/tba", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        const res = await fetch("/api/machines/tba", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to add TBA request.");
        }
      }
      setAddOpen(false);
      loadData();
    } catch (err: unknown) {
      setFErr(err instanceof Error ? err.message : "Error saving TBA request.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: TBAListItem) {
    if (!confirm(`Delete TBA reservation for ${t.client_name || "client"} (${t.brand} ${t.model})?`)) return;
    const res = await fetch(`/api/machines/tba?id=${t.id}`, { method: "DELETE" });
    if (res.ok) loadData();
  }

  async function handleFulfil(t: TBAListItem) {
    const unit = machines.find(
      (m) =>
        m.status === "In Stock" &&
        (m.brand ?? "").trim().toLowerCase() === (t.brand ?? "").trim().toLowerCase() &&
        m.model.trim().toLowerCase() === t.model.trim().toLowerCase()
    );
    if (!unit) {
      alert(`No available In Stock unit of ${t.brand} ${t.model}. Add stock first.`);
      return;
    }
    if (!confirm(`Allot unit ${unit.serial_no ?? "(no serial)"} to ${t.client_name} and reserve it?`)) return;
    await fetch(`/api/machines/${unit.id}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name:      t.client_name,
        client_code:      t.client_code,
        ae:               t.ae,
        location:         t.location,
        reservation_date: t.reservation_date ?? today(),
        notes:            `Fulfilled from TBA list. ${t.notes ?? ""}`,
      }),
    });
    await fetch(`/api/machines/tba?id=${t.id}`, { method: "DELETE" });
    alert(`Reserved ${unit.serial_no ?? unit.model} for ${t.client_name}.`);
    loadData();
  }

  // ── filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = tbaList.slice();
    if (q.trim()) {
      const lq = q.toLowerCase();
      rows = rows.filter((t) =>
        [t.brand, t.model, t.client_name, t.client_code, t.ae, t.location]
          .some((v) => (v ?? "").toLowerCase().includes(lq))
      );
    }
    if (fBrand) rows = rows.filter((t) => t.brand === fBrand);
    if (fModel) rows = rows.filter((t) => t.model === fModel);
    if (fAE)    rows = rows.filter((t) => t.ae    === fAE);
    return rows.sort(
      (a, b) => (a.brand ?? "").localeCompare(b.brand ?? "") || a.model.localeCompare(b.model)
    );
  }, [tbaList, q, fBrand, fModel, fAE]);

  const uniq = (k: keyof TBAListItem) =>
    [...new Set(tbaList.map((t) => t[k]).filter(Boolean))].sort() as string[];

  // ── style helpers ──────────────────────────────────────────────
  const thCls =
    "sticky top-0 bg-[var(--surface-2)] text-left px-3 py-2.5 font-[650] text-[var(--text-secondary)] text-[11px] uppercase tracking-wide whitespace-nowrap border-b border-[var(--border)]";
  const tdCls =
    "px-3.5 py-2.5 border-b border-[var(--border)] align-middle text-[12.5px]";

  const filterSel = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: string[]
  ) => (
    <select
      className="bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2 rounded-[9px] text-[13px] focus:outline-none focus:border-[var(--accent)]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  // Columns (hide client cols if no AE access)
  const cols = [
    { key: "brand",            label: "Brand" },
    { key: "model",            label: "Model" },
    ...(!hideCols ? [{ key: "client_name", label: "Client Name" }] : []),
    { key: "client_code",      label: "Code" },
    ...(!hideCols ? [{ key: "location",    label: "Location"    }] : []),
    { key: "ae",               label: "AE" },
    { key: "reservation_date", label: "Reservation Date" },
    { key: "notes",            label: "Notes" },
  ] as { key: keyof TBAListItem; label: string }[];

  // ── TBA form (shared for Add + Edit) ──────────────────────────
  const tbaForm = (
    <div className="flex flex-col gap-4 mt-2">
      <Banner>
        A TBA reservation records a client&apos;s demand without holding a unit. Fulfil it later when stock is available.
      </Banner>
      <Grid2>
        <Field label="Brand">
          <LookupSelect kind="brands" value={form.brand} onChange={set("brand")} lookups={lookups} />
        </Field>
        <Field label="Model" required>
          <LookupSelect kind="models" value={form.model} onChange={set("model")} lookups={lookups} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="Client Name" required>
          <Input value={form.client_name} onChange={(e) => set("client_name")(e.target.value)} />
        </Field>
        <Field label="Code">
          <Input value={form.client_code} onChange={(e) => set("client_code")(e.target.value)} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="AE">
          <LookupSelect kind="aes" value={form.ae} onChange={set("ae")} lookups={lookups} />
        </Field>
        <Field label="Reservation Date">
          <Input type="date" value={form.reservation_date} onChange={(e) => set("reservation_date")(e.target.value)} />
        </Field>
      </Grid2>
      <Field label="Location">
        <Input value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="Client / site location" />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
      </Field>
      {fErr && <p className="text-[12.5px] text-[var(--danger)]">{fErr}</p>}
    </div>
  );

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1800px] mx-auto select-none">
      {/* Toolbar */}
      <div className="flex gap-2.5 flex-wrap items-center mb-3.5">
        <input
          type="search"
          placeholder="🔍 Search brand, model, client…"
          className="bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2 rounded-[9px] text-[13px] min-w-[220px] focus:outline-none focus:border-[var(--accent)]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {filterSel("All brands", fBrand, setFBrand, uniq("brand"))}
        {filterSel("All models", fModel, setFModel, uniq("model"))}
        {filterSel("All AEs",    fAE,    setFAE,    uniq("ae"))}
        <span className="flex-1" />
        {canReserve && (
          <Button variant="primary" onClick={openAdd}>＋ Add TBA</Button>
        )}
        <span className="text-[12.5px] text-[var(--text-muted)]">
          {filtered.length} of {tbaList.length} reservations
        </span>
      </div>

      <div className="text-[12.5px] text-[var(--text-secondary)] mb-3">
        TBA reservations are client demands <b>not allotted to any unit</b> — inventory stays available.
        Use <b>📦 Fulfil</b> when stock is on hand to reserve an available unit for the client.
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 640, overflowY: "auto" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={thCls}>{c.label}</th>
                ))}
                {canReserve && (
                  <th className={`${thCls} sticky right-0 z-10 text-right shadow-[-7px_0_9px_-7px_rgba(0,0,0,.18)]`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center py-14 text-[var(--text-muted)] text-[13px]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center py-14 text-[var(--text-muted)] text-[13px]">
                    <svg className="mx-auto mb-3 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    No TBA reservations.
                    {canReserve && (
                      <div className="mt-3">
                        <Button variant="primary" size="sm" onClick={openAdd}>＋ Add a TBA reservation</Button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {!loading && filtered.map((t) => (
                <tr key={t.id} className="st-tba">
                  {cols.map((c) => {
                    const v = (t as unknown as Record<string, unknown>)[c.key];
                    const masked =
                      (c.key === "client_name" || c.key === "location") &&
                      !canSeeClient(t.ae);
                    if (masked)
                      return (
                        <td key={c.key} className={tdCls}>
                          <span className="text-[var(--text-muted)]">•••</span>
                        </td>
                      );
                    if (c.key === "brand" || c.key === "model" || c.key === "client_name")
                      return (
                        <td key={c.key} className={`${tdCls} font-semibold`}>
                          {v ? String(v) : DASH}
                        </td>
                      );
                    if (c.key === "notes")
                      return (
                        <td
                          key={c.key}
                          className={`${tdCls} text-[var(--text-muted)] max-w-[200px] overflow-hidden text-ellipsis`}
                          title={v ? String(v) : undefined}
                        >
                          {v ? String(v) : ""}
                        </td>
                      );
                    return (
                      <td key={c.key} className={tdCls}>
                        {v ? String(v) : DASH}
                      </td>
                    );
                  })}
                  {canReserve && (
                    <td className={`${tdCls} sticky right-0 bg-inherit shadow-[-7px_0_9px_-7px_rgba(0,0,0,.14)]`}>
                      <div className="flex gap-1.5 justify-end">
                        <Button size="sm" onClick={() => handleFulfil(t)} title="Fulfil — allot an available unit">
                          📦 Fulfil
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Edit">✎</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(t)} title="Delete">🗑</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={editTarget ? "Edit TBA Reservation" : "Add TBA Reservation"}
        footer={
          <ModalFooter
            onCancel={() => setAddOpen(false)}
            onConfirm={() => {
              // Trigger submit via the form element
              const form = document.getElementById("tba-form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            confirmLabel="Save"
            loading={saving}
          />
        }
      >
        <form id="tba-form" onSubmit={handleSave}>{tbaForm}</form>
      </Modal>
    </div>
  );
}
