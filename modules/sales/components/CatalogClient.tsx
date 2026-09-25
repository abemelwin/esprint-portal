"use client";

import { useState, useEffect } from "react";
import type { CatalogMachine } from "../types";

type CategoryKey = "picture" | "sitereq" | "catalog" | "roi" | "videos" | "others";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "picture",  label: "Product Picture"  },
  { key: "sitereq",  label: "Site Requirements" },
  { key: "catalog",  label: "Product Catalog"   },
  { key: "roi",      label: "ROI Computation"   },
  { key: "videos",   label: "Product Videos"    },
  { key: "others",   label: "Others"            },
];

function hasCategory(machine: CatalogMachine, category: CategoryKey): boolean {
  if (!machine.product_info_links) return false;
  return machine.product_info_links.some(
    (l) => (l.document_type || "").toLowerCase().replace(/[\s_-]/g, "") ===
            category.replace(/[\s_-]/g, "")
  );
}

function getLinksForCategory(machine: CatalogMachine, category: CategoryKey) {
  if (!machine.product_info_links) return [];
  return machine.product_info_links.filter(
    (l) => (l.document_type || "").toLowerCase().replace(/[\s_-]/g, "") ===
            category.replace(/[\s_-]/g, "")
  );
}

type Mode = "list" | "detail";

export function CatalogClient({ canManageFiles = false }: { canManageFiles?: boolean }) {
  const [machines,    setMachines]    = useState<CatalogMachine[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [brandFilter, setBrandFilter] = useState("");
  const [mode,        setMode]        = useState<Mode>("list");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  // add-link form state
  const [addingCat,   setAddingCat]   = useState<string | null>(null);
  const [newName,     setNewName]     = useState("");
  const [newUrl,      setNewUrl]      = useState("");
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/sales/catalog");
        const data = await res.json();
        if (data.machines) setMachines(data.machines);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const brands = Array.from(new Set(machines.map((m) => m.brand))).filter(Boolean).sort();
  const filtered = [...machines]
    .filter((m) => !brandFilter || m.brand === brandFilter)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));

  const selectedMachine = machines.find((m) => m.id === selectedId) ?? null;

  function openDetail(id: string) {
    setSelectedId(id);
    setMode("detail");
  }

  function backToList() {
    setMode("list");
    setSelectedId(null);
  }

  async function refreshMachines() {
    const res  = await fetch("/api/sales/catalog");
    const data = await res.json();
    if (data.machines) setMachines(data.machines);
  }

  async function handleAddLink(machineId: string, docType: string) {
    if (!newName.trim() || !newUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/product-info/${machineId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: newName.trim(), url: newUrl.trim(), document_type: docType }),
      });
      if (res.ok) {
        setNewName(""); setNewUrl(""); setAddingCat(null);
        await refreshMachines();
      }
    } finally { setSaving(false); }
  }

  async function handleDeleteLink(machineId: string, linkId: string) {
    if (!confirm("Remove this link?")) return;
    await fetch(`/api/sales/product-info/${machineId}/${linkId}`, { method: "DELETE" });
    await refreshMachines();
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <div style={{ padding: "24px 32px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#2c3e50", margin: 0 }}>
            Product Information
          </h1>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.9rem" }}
          >
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <p style={{ color: "#666", fontSize: "0.88rem", marginBottom: 20, lineHeight: 1.4 }}>
          Click a <strong>model name</strong> to view or manage its files.
          A ticked box means at least one file/link exists for that category.
        </p>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: "1rem" }}>Loading product information...</div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)", border: "1px solid #ddd", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", background: "#fff" }}>
              <thead>
                <tr>
                  {["Brand","Model","Picture","Site Req.","Catalog","ROI","Videos","Others"].map((h) => (
                    <th key={h} style={{ background: "#c0392b", color: "#fff", padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px", position: "sticky", top: 0, zIndex: 2 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "#888", padding: 24 }}>No machines found.</td></tr>
                ) : filtered.map((m, idx) => (
                  <tr key={m.id} style={{ background: idx % 2 === 1 ? "#fbeeec" : "#fff" }}>
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid #eee", color: "#333" }}>{m.brand}</td>
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid #eee" }}>
                      <span
                        onClick={() => openDetail(m.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && openDetail(m.id)}
                        style={{ color: "#c0392b", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                      >
                        {m.model}{m.sub_model ? ` (${m.sub_model})` : ""}
                      </span>
                    </td>
                    {(["picture","sitereq","catalog","roi","videos","others"] as CategoryKey[]).map((cat) => (
                      <td key={cat} style={{ padding: "9px 14px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={hasCategory(m, cat)}
                          disabled
                          readOnly
                          style={{ accentColor: "#c0392b", width: 16, height: 16, cursor: "default" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (!selectedMachine) return null;

  return (
    <div style={{ padding: "24px 32px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <button
        onClick={backToList}
        style={{ background: "none", border: "1px solid #ccc", padding: "6px 14px", borderRadius: 4, fontSize: "0.85rem", cursor: "pointer", marginBottom: 16, color: "#555" }}
      >
        ← Back to list
      </button>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2c3e50", marginBottom: 6 }}>
        {selectedMachine.brand} — {selectedMachine.model}
        {selectedMachine.sub_model && <span style={{ fontSize: "1rem", fontWeight: 400 }}> ({selectedMachine.sub_model})</span>}
      </h1>

      <p style={{ color: "#666", fontSize: "0.88rem", marginBottom: 16, lineHeight: 1.4 }}>
        Large videos are best added as a <strong>link</strong>.
        The <strong>Product Picture</strong> is used as the machine image on the quote.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginTop: 16 }}>
        {CATEGORIES.map((cat) => {
          const links = getLinksForCategory(selectedMachine, cat.key);
          const isAdding = addingCat === cat.key;
          return (
            <div key={cat.key} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "16px 20px", boxShadow: "0 2px 6px rgba(0,0,0,.04)", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#7f8c8d", letterSpacing: "0.8px", margin: "0 0 12px", paddingBottom: 8, borderBottom: "2px solid #f2f2f2", textTransform: "uppercase" }}>
                {cat.label}
              </h3>

              {links.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", flex: 1 }}>
                  {links.map((link, i) => (
                    <li key={link.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #eee", gap: 8 }}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#2980b9", fontSize: "0.88rem", textDecoration: "none", wordBreak: "break-all", flex: 1 }}>
                        {link.display_name}
                      </a>
                      {canManageFiles && link.id && (
                        <button onClick={() => handleDeleteLink(selectedMachine.id, link.id!)}
                          style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px", flexShrink: 0 }}
                          title="Remove link">✕</button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#aaa", fontSize: "0.85rem", fontStyle: "italic", margin: "0 0 16px", flex: 1 }}>No files yet.</p>
              )}

              {/* Add link form */}
              {canManageFiles && (
                isAdding ? (
                  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    <input placeholder="Display name" value={newName} onChange={e => setNewName(e.target.value)}
                      style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.83rem" }} autoFocus />
                    <input placeholder="URL (https://…)" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                      style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.83rem" }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleAddLink(selectedMachine.id, cat.key)} disabled={saving}
                        style={{ flex: 1, padding: "5px 0", background: "#c0392b", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.83rem", fontWeight: 700, cursor: "pointer" }}>
                        {saving ? "Saving…" : "Add"}
                      </button>
                      <button onClick={() => { setAddingCat(null); setNewName(""); setNewUrl(""); }}
                        style={{ padding: "5px 10px", background: "#f5f5f5", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.83rem", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingCat(cat.key); setNewName(""); setNewUrl(""); }}
                    style={{ marginTop: "auto", alignSelf: "flex-start", padding: "4px 10px", background: "#fff", border: "1px solid #c0392b", color: "#c0392b", borderRadius: 4, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                    + Add Link
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
