"use client";

import { useState, useEffect } from "react";
import type { Machine, MachineHistoryItem, LookupData, MachineStatus } from "../types";

const STATUS_OPTIONS: MachineStatus[] = [
  "In Stock",
  "Incoming",
  "Recertified",
  "Demo",
  "Reserved",
  "Delivered",
  "Pullout Parts",
];

// ─── Add / Edit Modal ───────────────────────────────────────────────
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
  const isEdit = !!initialData;
  const [formData, setFormData] = useState({
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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({
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
      });
    } else {
      setFormData({
        serial_no: "",
        po_no: "",
        brand: lookups.brands[0]?.name || "",
        model: "",
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
      });
    }
  }, [initialData, lookups, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.model) {
      setError("Please specify the Model");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const url = isEdit ? `/api/machines/${initialData?.id}` : "/api/machines";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save unit");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving unit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              {isEdit ? "✎" : "+"}
            </div>
            <div>
              <h3 className="text-base font-bold">{isEdit ? "Edit Machine Unit" : "Add New Machine Unit"}</h3>
              <p className="text-xs text-slate-400">Physical inventory tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand</label>
              <input
                list="brands-list"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g. Creons, Aeon, Canon"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="brands-list">
                {lookups.brands.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                list="models-list"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g. CREONS 6090 UV FLATBED"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="models-list">
                {lookups.models.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Serial Number</label>
              <input
                value={formData.serial_no}
                onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })}
                placeholder="e.g. SN-2024-001"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PO Number</label>
              <input
                value={formData.po_no}
                onChange={(e) => setFormData({ ...formData, po_no: e.target.value })}
                placeholder="e.g. PO-88912"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">-- Select Branch --</option>
                {lookups.branches.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as MachineStatus })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
              Client & Assignment Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client Name</label>
                <input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="e.g. Print Masters Corp."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client Code</label>
                <input
                  value={formData.client_code}
                  onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
                  placeholder="e.g. CLI-9901"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned AE</label>
                <select
                  value={formData.ae}
                  onChange={(e) => setFormData({ ...formData, ae: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- Select AE --</option>
                  {lookups.aes.map((a) => (
                    <option key={a.id} value={a.code}>
                      {a.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
                <input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Quezon City Warehouse"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reservation Date</label>
                <input
                  type="date"
                  value={formData.reservation_date}
                  onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Additional specifications, delivery remarks, condition notes..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : isEdit ? "Update Unit" : "Add Unit"}
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
    if (!clientName) {
      setError("Client Name is required");
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
        throw new Error(d.error || "Failed to reserve unit");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error reserving unit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Reserve Unit</h3>
            <p className="text-xs text-amber-100">
              {machine.brand} {machine.model} (SN: {machine.serial_no || "N/A"})
            </p>
          </div>
          <button onClick={onClose} className="text-amber-200 hover:text-white p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Gold Print Industries"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Client Code</label>
              <input
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                placeholder="e.g. GPI-01"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Executive</label>
              <select
                value={ae}
                onChange={(e) => setAe(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Manila"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reservation Date</label>
              <input
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reservation Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Terms, DP confirmation, expected delivery date..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-md disabled:opacity-50"
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
        throw new Error(d.error || "Failed to mark as delivered");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error delivering unit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Mark as Delivered</h3>
            <p className="text-xs text-emerald-100">
              {machine.brand} {machine.model} → {machine.client_name || "Assigned Client"}
            </p>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dispatch Date</label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Notes / DR Reference</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="DR Number, installer engineer, client received signature..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-md disabled:opacity-50"
            >
              {loading ? "Processing..." : "Confirm Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History / Detail Modal ─────────────────────────────────────────
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Unit Audit Trail</h3>
            <p className="text-xs text-slate-400">
              {machine.brand} {machine.model} · SN: {machine.serial_no || "N/A"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading audit history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No history events logged yet.</div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {history.map((h) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                  <p className="text-xs font-bold text-slate-800">{h.event}</p>
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
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
