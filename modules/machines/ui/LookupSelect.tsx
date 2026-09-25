"use client";

import { useState, useRef, useEffect } from "react";
import type { LookupData } from "../types";

export type LookupKind = "branches" | "aes" | "brands" | "models";

const LABELS: Record<LookupKind, string> = {
  branches: "branch code (e.g. MLA, CDO)",
  aes:      "AE / staff initials",
  brands:   "brand (e.g. EPSON)",
  models:   "model (e.g. I3200)",
};

interface Props {
  kind: LookupKind;
  value: string;
  onChange: (v: string) => void;
  lookups: LookupData;
  onAdd?: (kind: LookupKind, value: string) => Promise<void>;
  onDelete?: (kind: LookupKind, id: number) => Promise<void>;
  placeholder?: string;
}

export function LookupSelect({
  kind,
  value,
  onChange,
  lookups,
  onAdd,
  onDelete,
  placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Build the list — branches/aes have {id,code}, brands/models have {id,name}
  const rawList = (lookups[kind] ?? []) as { id: number; code?: string; name?: string }[];
  const list = rawList.map((x) => ({ id: x.id, label: x.code ?? x.name ?? "" }));
  const labels = list.map((x) => x.label);
  const options =
    value && !labels.includes(value)
      ? [{ id: -1, label: value }, ...list]
      : list;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = async () => {
    const newVal = window.prompt(`Add a new ${LABELS[kind]}:`)?.trim();
    if (!newVal || !onAdd) return;
    await onAdd(kind, newVal);
    onChange(newVal);
    setOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, item: { id: number; label: string }) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (!window.confirm(`Delete "${item.label}" from the list? This won't affect existing machines.`)) return;
    await onDelete(kind, item.id);
    if (value === item.label) onChange("");
  };

  const inputCls =
    "w-full bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2.5 rounded-[9px] text-[13.5px] text-left cursor-pointer flex items-center justify-between focus:outline-none focus:border-[var(--accent)]";

  return (
    <div ref={ref} className="relative">
      <button type="button" className={inputCls} onClick={() => setOpen((o) => !o)}>
        <span className={value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
          {value || placeholder || ""}
        </span>
        <span className="text-[var(--text-muted)] text-[11px] ml-2">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--surface-1)] border border-[var(--border)] rounded-[9px] shadow-[0_4px_20px_rgba(0,0,0,.25)] overflow-hidden">
          <div
            className="px-3 py-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] cursor-pointer"
            onClick={() => { onChange(""); setOpen(false); }}
          >
            {placeholder || "—"}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {options.map((o) => (
              <div
                key={o.id}
                className={`flex items-center justify-between px-3 py-2 text-[13px] cursor-pointer hover:bg-[var(--surface-2)] ${o.label === value ? "font-semibold text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
                onClick={() => { onChange(o.label); setOpen(false); }}
              >
                <span>{o.label}</span>
                {o.id > 0 && onDelete && (
                  <button
                    type="button"
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] text-[12px] px-1.5 py-0.5 rounded ml-2 hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] transition-colors"
                    onClick={(e) => handleDelete(e, o)}
                    title={`Delete "${o.label}"`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {onAdd && (
            <div
              className="px-3 py-2 text-[13px] text-[var(--accent)] hover:bg-[var(--surface-2)] cursor-pointer border-t border-[var(--border)] font-[550]"
              onClick={handleAdd}
            >
              ＋ Add new…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
