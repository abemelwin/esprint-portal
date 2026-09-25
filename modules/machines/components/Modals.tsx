"use client";

/**
 * Modals.tsx — MachineFormModal, ReserveModal, DeliverModal, HistoryModal
 *
 * Ported from esprint-machine-monitoring originals:
 *   MachineForm.tsx / ReserveModal.tsx / DeliverModal.tsx / HistoryModal.tsx
 *
 * Uses the shared UI primitives in ../ui/ so the look exactly matches the
 * original app's design tokens (CSS vars, Field, LookupSelect, Modal…).
 */

import { useState, useEffect } from "react";
import type { Machine, LookupData, MachineStatus } from "../types";
import { Modal, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Field, Grid2, Input, Select, Textarea, Banner } from "../ui/Field";
import { LookupSelect } from "../ui/LookupSelect";
import { ALL_STATUSES } from "../ui/Pill";

export { ALL_STATUSES };

// ── helpers ────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

// ════════════════════════════════════════════════════════════════
// 1. MachineFormModal  (Add + Edit)
// ════════════════════════════════════════════════════════════════
interface MachineFormData {
  serial_no:        string;
  po_no:            string;
  brand:            string;
  model:            string;
  branch:           string;
  status:           string;
  client_name:      string;
  client_code:      string;
  location:         string;
  ae:               string;
  reservation_date: string;
  delivery_date:    string;
  dispatch_date:    string;
  notes:            string;
}

const emptyMachine = (): MachineFormData => ({
  serial_no: "", po_no: "", brand: "", model: "", branch: "",
  status: "In Stock", client_name: "", client_code: "", location: "",
  ae: "", reservation_date: "", delivery_date: "", dispatch_date: "", notes: "",
});

function fromMachine(m: Machine): MachineFormData {
  return {
    serial_no:        m.serial_no        ?? "",
    po_no:            m.po_no            ?? "",
    brand:            m.brand            ?? "",
    model:            m.model            ?? "",
    branch:           m.branch           ?? "",
    status:           m.status,
    client_name:      m.client_name      ?? "",
    client_code:      m.client_code      ?? "",
    location:         m.location         ?? "",
    ae:               m.ae               ?? "",
    reservation_date: m.reservation_date ?? "",
    delivery_date:    m.delivery_date    ?? "",
    dispatch_date:    m.dispatch_date    ?? "",
    notes:            m.notes            ?? "",
  };
}

interface MachineFormModalProps {
  isOpen:      boolean;
  initialData: Machine | null;
  lookups:     LookupData;
  onClose:     () => void;
  onSuccess:   () => void;
}

export function MachineFormModal({
  isOpen,
  initialData,
  lookups,
  onClose,
  onSuccess,
}: MachineFormModalProps) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<MachineFormData>(
    initialData ? fromMachine(initialData) : emptyMachine()
  );
  const [qty,     setQty]     = useState(1);
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  // Re-init when target changes
  useEffect(() => {
    setForm(initialData ? fromMachine(initialData) : emptyMachine());
    setQty(1);
    setErr("");
  }, [initialData, isOpen]);

  const set = (k: keyof MachineFormData) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const onChange =
    (k: keyof MachineFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      set(k)(e.target.value);

  async function handleSubmit() {
    if (!form.status)        { setErr("Status is required."); return; }
    if (!form.po_no.trim())  { setErr("PO No. is required."); return; }
    if (!form.brand)         { setErr("Brand is required."); return; }
    if (!form.model.trim())  { setErr("Model is required."); return; }
    if (!form.branch)        { setErr("Branch is required."); return; }
    setErr("");
    setLoading(true);
    try {
      if (isEdit && initialData) {
        const res = await fetch(`/api/machines/${initialData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...initialData, ...form }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update");
      } else {
        const count = Math.max(1, Math.min(qty, 500));
        for (let i = 0; i < count; i++) {
          const res = await fetch("/api/machines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, status: form.status as MachineStatus }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add");
        }
      }
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Machine" : "Add Machine"}
      maxWidth="max-w-2xl"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmLabel={loading ? "Saving…" : isEdit ? "Save Changes" : "Add Machine"}
          loading={loading}
        />
      }
    >
      <div className="flex flex-col gap-4 mt-2">
        {!isEdit && (
          <Banner>
            Add one unit or a batch. Pick a <b>Status</b> and set <b>Quantity</b> to add several at once.
          </Banner>
        )}

        <Grid2>
          <Field label="Status" required>
            <Select value={form.status} onChange={onChange("status")}>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="PO No." required>
            <Input value={form.po_no} onChange={onChange("po_no")} placeholder="Purchase order no." />
          </Field>
        </Grid2>

        {!isEdit && (
          <Grid2>
            <Field label="Quantity" required hint="Add several identical units at once — each becomes its own row.">
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </Field>
            <div />
          </Grid2>
        )}

        <Grid2>
          <Field label="Brand" required>
            <LookupSelect kind="brands" value={form.brand} onChange={set("brand")} lookups={lookups} />
          </Field>
          <Field label="Model" required>
            <LookupSelect kind="models" value={form.model} onChange={set("model")} lookups={lookups} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Serial No.">
            <Input value={form.serial_no} onChange={onChange("serial_no")} placeholder="e.g. GR20241280" />
          </Field>
          <Field label="Branch" required>
            <LookupSelect kind="branches" value={form.branch} onChange={set("branch")} lookups={lookups} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Client Name">
            <Input value={form.client_name} onChange={onChange("client_name")} />
          </Field>
          <Field label="Code">
            <Input value={form.client_code} onChange={onChange("client_code")} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Location">
            <Input value={form.location} onChange={onChange("location")} placeholder="Client / site location" />
          </Field>
          <Field label="AE">
            <LookupSelect kind="aes" value={form.ae} onChange={set("ae")} lookups={lookups} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Reservation Date">
            <Input type="date" value={form.reservation_date} onChange={onChange("reservation_date")} />
          </Field>
          <Field label="Delivery Date">
            <Input type="date" value={form.delivery_date} onChange={onChange("delivery_date")} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Shipment Receipt / Transfer Date">
            <Input type="date" value={form.dispatch_date} onChange={onChange("dispatch_date")} />
          </Field>
          <div />
        </Grid2>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={onChange("notes")}
            placeholder="Anything worth remembering about this unit"
          />
        </Field>

        {err && <p className="text-[12.5px] text-[var(--danger)]">{err}</p>}
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// 2. ReserveModal
// ════════════════════════════════════════════════════════════════
interface ReserveModalProps {
  isOpen:    boolean;
  machine:   Machine | null;
  lookups:   LookupData;
  onClose:   () => void;
  onSuccess: () => void;
}

export function ReserveModal({
  isOpen, machine, lookups, onClose, onSuccess,
}: ReserveModalProps) {
  const [client,   setClient]   = useState(machine?.client_name      ?? "");
  const [code,     setCode]     = useState(machine?.client_code       ?? "");
  const [ae,       setAe]       = useState(machine?.ae                ?? "");
  const [date,     setDate]     = useState(machine?.reservation_date  ?? today());
  const [location, setLocation] = useState(machine?.location          ?? "");
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (machine) {
      setClient(machine.client_name      ?? "");
      setCode(machine.client_code        ?? "");
      setAe(machine.ae                   ?? "");
      setDate(machine.reservation_date   ?? today());
      setLocation(machine.location       ?? "");
      setErr("");
    }
  }, [machine, isOpen]);

  async function handleConfirm() {
    if (!client.trim()) { setErr("Please enter a client name."); return; }
    if (!machine)       return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/machines/${machine.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name:      client,
          client_code:      code,
          ae,
          reservation_date: date || today(),
          location,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to reserve");
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="🔖 Reserve Machine"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Reserve Machine"
          loading={loading}
        />
      }
    >
      <div className="flex flex-col gap-4 mt-2">
        <Banner>
          <b>{machine?.model}</b>{machine?.serial_no ? ` · ${machine.serial_no}` : ""} — assign to a client. It moves to <b>Reservations</b>.
        </Banner>
        <Grid2>
          <Field label="Client Name" required>
            <Input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Client / company name"
            />
          </Field>
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Short code" />
          </Field>
        </Grid2>
        <Grid2>
          <Field label="AE">
            <LookupSelect kind="aes" value={ae} onChange={setAe} lookups={lookups} />
          </Field>
          <Field label="Reservation Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </Grid2>
        <Field label="Location">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Client / site location"
          />
        </Field>
        {err && <p className="text-[12.5px] text-[var(--danger)]">{err}</p>}
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// 3. DeliverModal
// ════════════════════════════════════════════════════════════════
interface DeliverModalProps {
  isOpen:    boolean;
  machine:   Machine | null;
  lookups:   LookupData;
  onClose:   () => void;
  onSuccess: () => void;
}

export function DeliverModal({
  isOpen, machine, lookups, onClose, onSuccess,
}: DeliverModalProps) {
  const [brand,    setBrand]    = useState(machine?.brand    ?? "");
  const [model,    setModel]    = useState(machine?.model    ?? "");
  const [client,   setClient]   = useState(machine?.client_name  ?? "");
  const [code,     setCode]     = useState(machine?.client_code   ?? "");
  const [ae,       setAe]       = useState(machine?.ae       ?? "");
  const [branch,   setBranch]   = useState(machine?.branch   ?? "");
  const [location, setLocation] = useState(machine?.location ?? "");
  const [date,     setDate]     = useState("");
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (machine) {
      setBrand(machine.brand    ?? "");
      setModel(machine.model    ?? "");
      setClient(machine.client_name  ?? "");
      setCode(machine.client_code    ?? "");
      setAe(machine.ae          ?? "");
      setBranch(machine.branch  ?? "");
      setLocation(machine.location ?? "");
      setDate("");
      setErr("");
    }
  }, [machine, isOpen]);

  async function handleConfirm() {
    if (!client.trim()) { setErr("Please enter a client name."); return; }
    if (!date)          { setErr("Please enter a delivery date."); return; }
    if (!machine)       return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/machines/${machine.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...machine,
          status: "Delivered",
          brand, model,
          client_name: client, client_code: code,
          ae, branch, location,
          delivery_date: date,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to deliver");
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="✅ Deliver Machine"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Mark Delivered"
          loading={loading}
        />
      }
    >
      <div className="flex flex-col gap-4 mt-2">
        <Banner>
          <b>{machine?.model}</b>{machine?.serial_no ? ` · ${machine.serial_no}` : ""} — record delivery. It moves to <b>Deliveries</b>.
        </Banner>

        <Grid2>
          <Field label="Brand">
            <LookupSelect kind="brands" value={brand} onChange={setBrand} lookups={lookups} />
          </Field>
          <Field label="Model">
            <LookupSelect kind="models" value={model} onChange={setModel} lookups={lookups} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Client Name" required>
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="AE">
            <LookupSelect kind="aes" value={ae} onChange={setAe} lookups={lookups} />
          </Field>
          <Field label="Branch">
            <LookupSelect kind="branches" value={branch} onChange={setBranch} lookups={lookups} />
          </Field>
        </Grid2>

        <Grid2>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Client / site location" />
          </Field>
          <Field label="Delivery Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
          </Field>
        </Grid2>

        {err && <p className="text-[12.5px] text-[var(--danger)]">{err}</p>}
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// 4. HistoryModal
// ════════════════════════════════════════════════════════════════
interface HistoryItem {
  id: string;
  machine_id: string;
  event: string;
  actor: string | null;
  created_at: string;
}

interface HistoryModalProps {
  isOpen:  boolean;
  machine: Machine | null;
  onClose: () => void;
}

export function HistoryModal({ isOpen, machine, onClose }: HistoryModalProps) {
  const [history,  setHistory]  = useState<HistoryItem[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!isOpen || !machine) return;
    setLoading(true);
    fetch(`/api/machines/${machine.id}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, machine]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`History — ${machine?.model ?? ""} ${machine?.serial_no ?? ""}`.trim()}
      footer={
        <Button variant="default" onClick={onClose}>Close</Button>
      }
    >
      <div className="mt-2 border-t border-[var(--border)] pt-3 flex flex-col gap-1.5">
        {loading && (
          <p className="text-[12px] text-[var(--text-muted)]">Loading…</p>
        )}
        {!loading && history.length === 0 && (
          <p className="text-[12px] text-[var(--text-muted)]">No history yet.</p>
        )}
        {history.map((h) => (
          <div key={h.id} className="flex gap-2.5 text-[11.5px] py-1">
            <b className="text-[var(--text-secondary)] font-semibold whitespace-nowrap">
              {h.created_at.slice(0, 16).replace("T", " ")}
            </b>
            <span className="text-[var(--text-muted)]">{h.event}</span>
            {h.actor && (
              <span className="text-[var(--text-muted)] ml-auto">· {h.actor}</span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
