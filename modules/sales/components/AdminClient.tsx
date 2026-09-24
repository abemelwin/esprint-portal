"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CatalogMachine } from "../types";

interface ConsumableRow { name: string; uom: string; price: string }
interface AddonRow      { name: string; uom: string; price: string }

const EMPTY_FORM = {
  key:                    "",
  quoteTitle:             "",
  brand:                  "",
  category:               "",
  srp:                    "" as string | number,
  lbp:                    "" as string | number,
  cashPrice:              "" as string | number,
  defaultMonths:          "" as string | number,
  hasTradeIn:             false,
  hasPrinthead:           false,
  hasLaserTube:           false,
  excludeSoftwareConcerns: true,
  machineWarranty:        "" as string | number,
  printheadWarranty:      "",
  serviceFee:             "" as string | number,
  availability:           "",
  featuresText:           "",
  inclusionsText:         "",
  exclusivesText:         "",
};

type FormState = typeof EMPTY_FORM;

export function AdminClient() {
  const [machines,     setMachines]     = useState<CatalogMachine[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [selectedId,   setSelectedId]   = useState("");
  const [brandFilter,  setBrandFilter]  = useState("");
  const [machineSearch,setMachineSearch]= useState("");
  const [form,         setForm]         = useState<FormState>({ ...EMPTY_FORM });
  const [consumables,  setConsumables]  = useState<ConsumableRow[]>([]);
  const [addons,       setAddons]       = useState<AddonRow[]>([]);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  // drag state
  const dragSrc = useRef<{ list: "consumables" | "addons"; idx: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ list: string; idx: number } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/sales/catalog");
      const data = await res.json();
      if (data.machines) setMachines(data.machines);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setConsumables([]);
    setAddons([]);
    setSelectedId("");
  }

  function populateForm(m: CatalogMachine) {
    setForm({
      key:                    m.id ? m.id.substring(0, 8).toUpperCase() : "",
      quoteTitle:             m.model,
      brand:                  m.brand,
      category:               m.unit_condition,
      srp:                    m.srp ?? "",
      lbp:                    m.lbp ?? "",
      cashPrice:              m.cash_price ?? "",
      defaultMonths:          m.machine_warranty_months ?? "",
      hasTradeIn:             false,
      hasPrinthead:           !!m.printhead_warranty && m.printhead_warranty !== "0",
      hasLaserTube:           false,
      excludeSoftwareConcerns: true,
      machineWarranty:        m.machine_warranty_months ?? "",
      printheadWarranty:      m.printhead_warranty ?? "",
      serviceFee:             m.service_fee ?? "",
      availability:           m.availability ?? "",
      featuresText:           (m.features || []).join("\n"),
      inclusionsText:         (m.inclusions || []).join("\n"),
      exclusivesText:         (m.exclusions || []).join("\n"),
    });
    setConsumables((m.consumables || []).map((c) => ({
      name:  c.item_name,
      uom:   c.package_description ?? "",
      price: c.default_price != null ? String(c.default_price) : "",
    })));
    setAddons((m.addons || []).map((a) => ({ name: a, uom: "", price: "" })));
  }

  function selectMachine(id: string) {
    setSelectedId(id);
    if (!id) { resetForm(); return; }
    const m = machines.find((x) => x.id === id);
    if (m) populateForm(m);
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // ── Drag reorder ──────────────────────────────────────────────────────────
  function onDragStart(list: "consumables" | "addons", idx: number) {
    dragSrc.current = { list, idx };
  }
  function onDragEnter(list: "consumables" | "addons", idx: number) {
    if (!dragSrc.current || dragSrc.current.list !== list) return;
    setDragOver({ list, idx });
  }
  function onDragEnd(list: "consumables" | "addons") {
    const src = dragSrc.current;
    if (!src || !dragOver || src.list !== dragOver.list || src.idx === dragOver.idx) {
      dragSrc.current = null; setDragOver(null); return;
    }
    const setter = list === "consumables" ? setConsumables : setAddons;
    setter((arr) => {
      const next = [...arr];
      const [moved] = next.splice(src.idx, 1);
      if (moved) next.splice(dragOver.idx, 0, moved);
      return next;
    });
    dragSrc.current = null; setDragOver(null);
  }

  // ── Revert ────────────────────────────────────────────────────────────────
  async function handleRevert() {
    if (!confirm("Revert catalog to built-in defaults? This will refresh data from the server.")) return;
    await loadData();
    resetForm();
    showToast("Reverted to built-in catalog.");
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selectedId) return;
    const m = machines.find((x) => x.id === selectedId);
    if (!confirm(`Delete "${m?.model}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/catalog/${selectedId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Machine deleted.");
        resetForm();
        await loadData();
      } else {
        showToast("Delete failed.", false);
      }
    } catch { showToast("Network error.", false); }
    finally { setSaving(false); }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (saving) return;
    const brand = String(form.brand || "").trim();
    const model = String(form.quoteTitle || "").trim() || brand;
    if (!brand || !model) { showToast("Brand and Quote Title are required.", false); return; }
    setSaving(true);

    const parseLines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

    const payload: Partial<CatalogMachine> = {
      brand,
      model,
      unit_condition:          (form.category || "Brand New") as any,
      letterhead:              "ES Print Media Inc." as any,
      srp:                     Number(form.srp) || 0,
      lbp:                     Number(form.lbp) || 0,
      cash_price:              Number(form.cashPrice) || 0,
      machine_warranty_months: Number(form.machineWarranty) || 0,
      printhead_warranty:      form.printheadWarranty || "0",
      service_fee:             Number(form.serviceFee) || 0,
      availability:            form.availability || "",
      features:                parseLines(form.featuresText),
      inclusions:              parseLines(form.inclusionsText),
      exclusions:              parseLines(form.exclusivesText),
      addons:                  addons.filter((a) => a.name.trim()).map((a) => a.name.trim()),
      consumables:             consumables.filter((c) => c.name.trim()).map((c, i) => ({
        item_name:           c.name.trim(),
        package_description: c.uom.trim() || null,
        default_price:       parseFloat(c.price) || 0,
      })),
    };

    try {
      const isEdit = !!selectedId;
      const res = await fetch(
        isEdit ? `/api/sales/catalog/${selectedId}` : "/api/sales/catalog",
        { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (res.ok) {
        showToast(isEdit ? "Saved successfully!" : "Machine created successfully!");
        await loadData();
        if (!isEdit) resetForm();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast("Save failed: " + (d.error || "Unknown error"), false);
      }
    } catch { showToast("Network error.", false); }
    finally { setSaving(false); }
  }

  // ── Filtered dropdown ──────────────────────────────────────────────────────
  const brands = Array.from(new Set(machines.map((m) => m.brand))).filter(Boolean).sort();
  const filteredOpts = machines.filter((m) => {
    if (brandFilter && m.brand !== brandFilter) return false;
    if (machineSearch.trim()) {
      const q = machineSearch.toLowerCase();
      return m.brand.toLowerCase().includes(q) || m.model.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Shared input styles ────────────────────────────────────────────────────
  const inp: React.CSSProperties = { padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 12, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 };

  function Row({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3, ...(full ? { gridColumn: "1 / -1" } : {}) }}>
        <label style={lbl}>{label}</label>
        {children}
      </div>
    );
  }

  function TableSection({
    title, rows, setRows, list,
  }: {
    title: string;
    rows: ConsumableRow[] | AddonRow[];
    setRows: React.Dispatch<React.SetStateAction<any[]>>;
    list: "consumables" | "addons";
  }) {
    return (
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={lbl}>{title}</label>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 4 }}>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th style={{ textAlign: "left", fontSize: 10, color: "#888", fontWeight: 600, padding: "1px 4px" }}>Name</th>
                <th style={{ textAlign: "left", fontSize: 10, color: "#888", fontWeight: 600, padding: "1px 4px", width: "22%" }}>Unit of Measure</th>
                <th style={{ textAlign: "left", fontSize: 10, color: "#888", fontWeight: 600, padding: "1px 4px", width: "22%" }}>Unit Price</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, idx) => (
                <tr
                  key={idx}
                  draggable
                  onDragStart={() => onDragStart(list, idx)}
                  onDragEnter={(e) => { e.preventDefault(); onDragEnter(list, idx); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => onDragEnd(list)}
                  style={{ background: dragOver?.list === list && dragOver?.idx === idx ? "#fef9c3" : "transparent", cursor: "grab" }}
                >
                  <td style={{ padding: "2px 4px", textAlign: "center", color: "#bbb", fontSize: 14, userSelect: "none" }}>⠿</td>
                  <td style={{ padding: "2px 4px" }}><input style={inp} value={row.name} onChange={(e) => setRows((r) => r.map((x: any, i: number) => i === idx ? { ...x, name: e.target.value } : x))} /></td>
                  <td style={{ padding: "2px 4px" }}><input style={inp} value={row.uom}  onChange={(e) => setRows((r) => r.map((x: any, i: number) => i === idx ? { ...x, uom: e.target.value }  : x))} /></td>
                  <td style={{ padding: "2px 4px" }}><input style={inp} value={row.price} inputMode="decimal" onChange={(e) => setRows((r) => r.map((x: any, i: number) => i === idx ? { ...x, price: e.target.value } : x))} /></td>
                  <td style={{ padding: "2px 4px" }}>
                    <button type="button" onClick={() => setRows((r) => r.filter((_: any, i: number) => i !== idx))}
                      style={{ border: "1px solid #ddd", background: "#fafafa", color: "#c0392b", borderRadius: 4, cursor: "pointer", fontWeight: 700, width: 26, height: 26 }}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setRows((r) => [...r, { name: "", uom: "", price: "" }])}
          style={{ padding: "5px 10px", background: "#fff", color: "#c0392b", border: "1px solid #c0392b", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          + Add {list === "consumables" ? "Consumable" : "Add-On"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 10, padding: "14px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.18)", minWidth: 260, background: toast.ok ? "#27ae60" : "#c0392b", color: "#fff", pointerEvents: "none" }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{toast.ok ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8, maxWidth: 920 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "#c0392b" }}>Machine Catalog Editor</h2>

        <select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setMachineSearch(""); }}
          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12, background: "#fff", minWidth: 120 }}>
          <option value="">All Brands</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <input placeholder="Search machine..." value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, fontFamily: "inherit", minWidth: 140, maxWidth: 200 }} />

        <select value={selectedId} onChange={(e) => selectMachine(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12, background: "#fff", flex: 1, maxWidth: 280 }}>
          <option value="">Select a machine... ({filteredOpts.length})</option>
          {filteredOpts.map((m) => (
            <option key={m.id} value={m.id}>{brandFilter ? m.model : `${m.brand} — ${m.model}`}</option>
          ))}
        </select>

        <button onClick={() => resetForm()}
          style={{ padding: "6px 11px", border: "1px solid #c0392b", background: "#fff", color: "#c0392b", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          + New
        </button>

        <button onClick={handleDelete} disabled={!selectedId || saving}
          style={{ padding: "6px 11px", border: "1px solid #aaa", background: "#fff", color: "#777", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: selectedId ? "pointer" : "not-allowed", opacity: selectedId ? 1 : 0.5 }}>
          Delete
        </button>

        <span style={{ flex: 1 }} />

        <button onClick={handleRevert}
          style={{ padding: "6px 11px", border: "1px solid #aaa", background: "#fff", color: "#777", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Revert to built-in
        </button>
      </div>

      {/* Note */}
      <p style={{ fontSize: 11, color: "#888", maxWidth: 920, marginBottom: 12, lineHeight: 1.5 }}>
        Add or revise machines here. Changes save in <strong>this browser</strong> and are used everywhere in the app (quotes, price list, product info). Prices in ₱. For list fields, put <strong>one item per line</strong>.<br />
        Consumables format per line: <code style={{ background: "#f0f0f0", padding: "1px 4px", borderRadius: 3, fontSize: 11 }}>Name | Package | Price</code>.
      </p>

      {/* Form */}
      <div style={{ maxWidth: 920, background: "#fff", borderRadius: 8, boxShadow: "0 1px 8px rgba(0,0,0,.12)", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>

        <Row label="Key (unique ID)">
          <input style={{ ...inp, background: selectedId ? "#f5f5f5" : undefined, color: selectedId ? "#999" : undefined }} value={selectedId ? form.key : ""} readOnly={!!selectedId} placeholder="Auto-generated on save" onChange={() => {}} />
        </Row>
        <Row label="Quote Title">
          <input style={inp} value={form.quoteTitle} onChange={(e) => setF("quoteTitle", e.target.value)} />
        </Row>
        <Row label="Brand">
          <input style={inp} value={form.brand} onChange={(e) => setF("brand", e.target.value)} />
        </Row>
        <Row label="Category">
          <input style={inp} value={form.category} onChange={(e) => setF("category", e.target.value)} />
        </Row>

        {/* Checkboxes row */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 16px" }}>
            {[
              { field: "hasTradeIn"  as const, fldLabel: "Has Trade-In",   chkLabel: "Trade-In"   },
              { field: "hasPrinthead" as const, fldLabel: "Has Printhead",  chkLabel: "Print Head" },
              { field: "hasLaserTube" as const, fldLabel: "Has Laser Tube", chkLabel: "Laser Tube" },
            ].map(({ field, fldLabel, chkLabel }) => (
              <div key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={lbl}>{fldLabel}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", minHeight: 29 }}>
                  <input type="checkbox" style={{ width: 16, height: 16, accentColor: "#c0392b" }}
                    checked={form[field] as boolean}
                    onChange={(e) => setF(field, e.target.checked)} />
                  <span style={{ fontSize: 12, color: "#333" }}>{chkLabel}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Software clause */}
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={lbl}>Software Related Concerns Clause</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", minHeight: 29 }}>
            <input type="checkbox" style={{ width: 16, height: 16, accentColor: "#c0392b" }}
              checked={form.excludeSoftwareConcerns}
              onChange={(e) => setF("excludeSoftwareConcerns", e.target.checked)} />
            <span style={{ fontWeight: 500, cursor: "pointer", fontSize: 12, color: "#333" }}>
              Include "excluding software related concerns" clause in warranty
            </span>
          </label>
        </div>

        <Row label="Default Months">
          <input type="number" style={inp} value={form.defaultMonths} onChange={(e) => setF("defaultMonths", e.target.value)} />
        </Row>
        <Row label="Machine Warranty (months)">
          <input style={inp} value={form.machineWarranty} onChange={(e) => setF("machineWarranty", e.target.value)} />
        </Row>
        <Row label="Printhead/Laser Tube Warranty">
          <input style={inp} placeholder="e.g. 6, or free text" value={form.printheadWarranty} onChange={(e) => setF("printheadWarranty", e.target.value)} />
        </Row>
        <Row label="Service Fee (after warranty)">
          <input style={inp} value={form.serviceFee} onChange={(e) => setF("serviceFee", e.target.value)} />
        </Row>
        <Row label="Availability" full>
          <input style={inp} value={form.availability} onChange={(e) => setF("availability", e.target.value)} />
        </Row>
        <Row label="Features (one per line)" full>
          <textarea style={{ ...inp, fontFamily: "inherit", resize: "vertical" }} rows={4} value={form.featuresText} onChange={(e) => setF("featuresText", e.target.value)} />
        </Row>
        <Row label="Standard Package / Inclusions (one per line)" full>
          <textarea style={{ ...inp, fontFamily: "inherit", resize: "vertical" }} rows={4} value={form.inclusionsText} onChange={(e) => setF("inclusionsText", e.target.value)} />
        </Row>
        <Row label="Exclusives (one per line)" full>
          <textarea style={{ ...inp, fontFamily: "inherit", resize: "vertical" }} rows={3} value={form.exclusivesText} onChange={(e) => setF("exclusivesText", e.target.value)} />
        </Row>

        <TableSection title="Consumables" rows={consumables} setRows={setConsumables} list="consumables" />
        <TableSection title="Optional Add-Ons" rows={addons} setRows={setAddons} list="addons" />
      </div>

      {/* Actions */}
      <div style={{ maxWidth: 920, margin: "12px 0 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button disabled={saving} onClick={handleSave}
          style={{ padding: "11px 20px", background: "#c0392b", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
          {saving
            ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "admin-spin 0.6s linear infinite" }} /> Saving...</>
            : <><span>💾</span> Save Changes</>
          }
        </button>
      </div>

      <style>{`@keyframes admin-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
