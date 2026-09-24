"use client";

import { useState, useEffect } from "react";
import type { Machine, MachineHistoryItem, LookupData, MachineStatus } from "../types";

export const ALL_STATUSES: MachineStatus[] = [
  "In Stock",
  "Incoming",
  "Recertified",
  "Demo",
  "Reserved",
  "Delivered",
  "Pullout Parts",
];

export const STATUS_PILLS: Record<MachineStatus, { label: string; bg: string; text: string; border: string; icon: string }> = {
  "Incoming":      { label: "Incoming",      bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", icon: "🚚" },
  "In Stock":      { label: "In Stock",      bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", icon: "📦" },
  "Recertified":   { label: "Recertified",   bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", icon: "♻️" },
  "Demo":          { label: "Demo",          bg: "#fdf2f8", text: "#be185d", border: "#fbcfe8", icon: "🧪" },
  "Reserved":      { label: "Reserved",      bg: "#fffbeb", text: "#b45309", border: "#fde68a", icon: "🔖" },
  "Delivered":     { label: "Delivered",     bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", icon: "✅" },
  "Pullout Parts": { label: "Pullout Parts", bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", icon: "🔧" },
};

// ─── Add / Edit Machine Modal ───────────────────────────────────────
export function MachineFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  lookups,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Machine | null;
  lookups: LookupData;
}) {
  const isAdd = !initialData;
  const [form, setForm] = useState({
    serial_no: "",
    po_no: "",
    brand: "",
    model: "",
    branch: "",
    status: "In Stock" as MachineStatus,
    client_name: "",
    client_code: "",
    location: "",
    ae: "",
    reservation_date: "",
    delivery_date: "",
    dispatch_date: "",
    notes: "",
    history_note: "",
  });
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setForm({
        serial_no: initialData.serial_no || "",
        po_no: initialData.po_no || "",
        brand: initialData.brand || "",
        model: initialData.model || "",
        branch: initialData.branch || "",
        status: initialData.status || "In Stock",
        client_name: initialData.client_name || "",
        client_code: initialData.client_code || "",
        location: initialData.location || "",
        ae: initialData.ae || "",
        reservation_date: initialData.reservation_date || "",
        delivery_date: initialData.delivery_date || "",
        dispatch_date: initialData.dispatch_date || "",
        notes: initialData.notes || "",
        history_note: "",
      });
      setQty(1);
    } else {
      setForm({
        serial_no: "",
        po_no: "",
        brand: lookups.brands[0]?.name || "",
        model: lookups.models[0]?.name || "",
        branch: lookups.branches[0]?.code || "",
        status: "In Stock",
        client_name: "",
        client_code: "",
        location: "",
        ae: "",
        reservation_date: "",
        delivery_date: "",
        dispatch_date: "",
        notes: "",
        history_note: "",
      });
      setQty(1);
    }
  }, [initialData, lookups, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.po_no.trim()) {
      setError("PO No. is required.");
      return;
    }
    if (!form.brand) {
      setError("Brand is required.");
      return;
    }
    if (!form.model.trim()) {
      setError("Model is required.");
      return;
    }
    if (!form.branch) {
      setError("Branch is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isAdd) {
        // Support batch creation
        const totalQty = Math.max(1, Math.min(qty, 500));
        for (let i = 0; i < totalQty; i++) {
          const res = await fetch("/api/machines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              serial_no: totalQty > 1 && form.serial_no ? `${form.serial_no}-${i + 1}` : form.serial_no,
            }),
          });
          if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || "Failed to add machine unit.");
          }
        }
      } else {
        const res = await fetch(`/api/machines/${initialData?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to update machine unit.");
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving unit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isAdd ? "📦" : "✏️"}</span>
            <h3 className="text-sm font-bold tracking-tight">
              {isAdd ? "Add Machine Unit(s)" : "Edit Machine Unit"}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {isAdd && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-medium">
              Add one unit or a batch. Pick a <b>Status</b> and set <b>Quantity</b> to add several at once.
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MachineStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_PILLS[s].icon} {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                PO No. <span className="text-red-500">*</span>
              </label>
              <input
                value={form.po_no}
                onChange={(e) => setForm({ ...form, po_no: e.target.value })}
                placeholder="Purchase order no."
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {isAdd && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Add several identical units at once — each becomes its own row.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Brand <span className="text-red-500">*</span>
              </label>
              <select
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Select Brand --</option>
                {lookups.brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <select
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Select Model --</option>
                {lookups.models.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Serial No.</label>
              <input
                value={form.serial_no}
                onChange={(e) => setForm({ ...form, serial_no: e.target.value })}
                placeholder="e.g. GR20241280"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Select Branch --</option>
                {lookups.branches.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Client Name</label>
              <input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Client Code</label>
              <input
                value={form.client_code}
                onChange={(e) => setForm({ ...form, client_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Client / site location"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">AE</label>
              <select
                value={form.ae}
                onChange={(e) => setForm({ ...form, ae: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Select AE --</option>
                {lookups.aes.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reservation Date</label>
              <input
                type="date"
                value={form.reservation_date}
                onChange={(e) => setForm({ ...form, reservation_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Delivery Date</label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transfer Date</label>
              <input
                type="date"
                value={form.dispatch_date}
                onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Anything worth remembering about this unit"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {loading ? "Saving..." : isAdd ? "Add Machine" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reserve Modal ──────────────────────────────────────────────────
export function ReserveModal({
  isOpen,
  onClose,
  onSuccess,
  machine,
  lookups,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machine: Machine | null;
  lookups: LookupData;
}) {
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [ae, setAe] = useState("");
  const [location, setLocation] = useState("");
  const [reservationDate, setReservationDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !machine) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      setError("Client Name is required.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/machines/${machine?.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          client_code: clientCode,
          ae,
          location,
          reservation_date: reservationDate,
          notes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to reserve unit.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error reserving unit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Reserve Machine Unit</h3>
            <p className="text-[11px] text-amber-100">
              {machine.brand} {machine.model} (SN: {machine.serial_no || "No Serial"})
            </p>
          </div>
          <button onClick={onClose} className="text-amber-200 hover:text-white p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Printing"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Client Code</label>
              <input
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                placeholder="e.g. ACM-01"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Assigned AE</label>
              <select
                value={ae}
                onChange={(e) => setAe(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="">-- Select AE --</option>
                {lookups.aes.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Manila"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reservation Date</label>
              <input
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md disabled:opacity-50"
            >
              {loading ? "Reserving..." : "Confirm Reservation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Deliver Modal ──────────────────────────────────────────────────
export function DeliverModal({
  isOpen,
  onClose,
  onSuccess,
  machine,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machine: Machine | null;
}) {
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dispatchDate, setDispatchDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !machine) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/machines/${machine?.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_date: deliveryDate,
          dispatch_date: dispatchDate,
          notes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to mark as delivered.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error delivering unit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Mark as Delivered</h3>
            <p className="text-[11px] text-emerald-100">
              {machine.brand} {machine.model} → {machine.client_name || "Client"}
            </p>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Shipment Receipt Date</label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Delivery Remarks / DR No.</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="DR reference, technician remarks..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md disabled:opacity-50"
            >
              {loading ? "Delivering..." : "Confirm Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History Modal ──────────────────────────────────────────────────
export function HistoryModal({
  isOpen,
  onClose,
  machine,
}: {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
}) {
  const [history, setHistory] = useState<MachineHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (machine && isOpen) {
      setLoading(true);
      fetch(`/api/machines/${machine.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.history) setHistory(data.history);
        })
        .finally(() => setLoading(false));
    }
  }, [machine, isOpen]);

  if (!isOpen || !machine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Unit Audit Log</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {machine.brand} {machine.model} · SN: {machine.serial_no || "No Serial"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading audit history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No log events recorded.</div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {history.map((h) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                  <p className="font-bold text-slate-800">{h.event}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    By <span className="font-semibold text-slate-700">{h.actor || "System"}</span> ·{" "}
                    {new Date(h.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
