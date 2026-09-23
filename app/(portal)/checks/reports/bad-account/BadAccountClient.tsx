'use client';
/**
 * BadAccountClient — Bad Account List (standalone editable CRUD list).
 * Ported from esprint-check-monitoring/app/reports/bad-account/page.tsx.
 * Calls /api/bad-account-list (+ /[id]).
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const STATUSES = ['BAD ACCOUNT', 'DEMAND LETTER', 'WITH OVERDUE BALANCE', 'WITH RECON', 'WITH LEGAL CASE', 'BLACKLIST'] as const;
type StatusType = typeof STATUSES[number];

interface BadAccountRow {
  id: string;
  ae: string | null;
  branch_id: string | null;
  client_name: string;
  status: StatusType;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  'BAD ACCOUNT':         'bg-rose-100 text-rose-800 border border-rose-200',
  'DEMAND LETTER':       'bg-orange-100 text-orange-800 border border-orange-200',
  'WITH OVERDUE BALANCE':'bg-amber-100 text-amber-800 border border-amber-200',
  'WITH RECON':          'bg-indigo-100 text-indigo-800 border border-indigo-200',
  'WITH LEGAL CASE':     'bg-purple-100 text-purple-800 border border-purple-200',
  'BLACKLIST':           'bg-gray-800 text-white border border-gray-700',
};

const EMPTY_FORM = { ae: '', branchId: '', clientName: '', status: 'BAD ACCOUNT' as StatusType, notes: '' };

interface Props {
  branches: { id: string; name: string }[];
  aeList:   string[];
  canEdit:  boolean;
  userEmail: string;
}

export function BadAccountClient({ branches, aeList, canEdit, userEmail }: Props) {
  const [rows,    setRows]    = useState<BadAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const statusDropRef = useRef<HTMLDivElement>(null);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterAE,     setFilterAE]     = useState('');
  const [search,       setSearch]       = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  useEffect(() => {
    function h(e: MouseEvent) { if (statusDropRef.current && !statusDropRef.current.contains(e.target as Node)) setStatusDropOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/bad-account-list');
      const json = await res.json();
      if (json.ok) setRows(json.rows); else setError(json.error ?? 'Failed to load');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filterStatuses.size > 0) r = r.filter(c => filterStatuses.has(c.status));
    if (filterBranch) r = r.filter(c => c.branch_id === filterBranch);
    if (filterAE)     r = r.filter(c => (c.ae ?? '').toLowerCase().includes(filterAE.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(c => c.client_name.toLowerCase().includes(q) || (c.ae ?? '').toLowerCase().includes(q) || (c.notes ?? '').toLowerCase().includes(q));
    }
    return r;
  }, [rows, filterStatuses, filterBranch, filterAE, search]);

  function openAdd() { setError(''); setEditingId(null); setForm({ ...EMPTY_FORM }); setShowModal(true); }
  function openEdit(row: BadAccountRow) {
    setError(''); setEditingId(row.id);
    setForm({ ae: row.ae ?? '', branchId: row.branch_id ?? '', clientName: row.client_name, status: row.status, notes: row.notes ?? '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.clientName.trim()) return;
    setSaving(true);
    try {
      const body = {
        ae: form.ae.trim() || null, branchId: form.branchId || null,
        clientName: form.clientName.trim(), status: form.status, notes: form.notes.trim() || null,
      };
      const url    = editingId ? `/api/bad-account-list/${editingId}` : '/api/bad-account-list';
      const method = editingId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json   = await res.json();
      if (json.ok) { setShowModal(false); fetchRows(); }
      else setError(json.error ?? `Save failed (HTTP ${res.status})`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/bad-account-list/${deleteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) { setDeleteId(null); fetchRows(); } else setError(json.error ?? 'Delete failed');
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all([...selectedIds].map(id => fetch(`/api/bad-account-list/${id}`, { method: 'DELETE' }).then(r => r.json())));
      const failed = results.filter(r => !r.ok).length;
      if (failed > 0) setError(`${failed} of ${selectedIds.size} deletes failed`);
      setSelectedIds(new Set()); setShowBulkDelete(false); fetchRows();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(prev => (prev.size === filtered.length && filtered.length > 0) ? new Set() : new Set(filtered.map(r => r.id)));
  }

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600';
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="animate-fade-in space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bad Account List</h1>
          <p className="text-sm text-gray-500 mt-0.5">Clients flagged for bad account, demand letter, overdue balance, or recon</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-700 text-white hover:bg-rose-800">+ Add Entry</button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="relative" ref={statusDropRef}>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Status</label>
            <button type="button" onClick={() => setStatusDropOpen(o => !o)} className={sel + ' w-full text-left flex items-center justify-between'}>
              <span className={filterStatuses.size === 0 ? 'text-gray-400' : 'text-gray-800'}>
                {filterStatuses.size === 0 ? 'All Status' : filterStatuses.size === 1 ? [...filterStatuses][0] : `${filterStatuses.size} selected`}
              </span>
              <span className="text-gray-400 text-xs">▾</span>
            </button>
            {statusDropOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={filterStatuses.size === 0} onChange={() => setFilterStatuses(new Set())} className="accent-rose-600" />
                  <span className="font-medium text-gray-700">(Select All)</span>
                </label>
                {STATUSES.map(s => (
                  <label key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={filterStatuses.has(s)}
                      onChange={() => setFilterStatuses(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; })}
                      className="accent-rose-600" />
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700'}`}>{s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Branch</label>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className={sel + ' w-full'}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">AE</label>
            <input list="ba-ae-datalist" value={filterAE} onChange={e => setFilterAE(e.target.value)} placeholder="Type AE…" className={sel + ' w-full'} autoComplete="off" />
            <datalist id="ba-ae-datalist">{aeList.map(ae => <option key={ae} value={ae} />)}</datalist>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="client name, AE, notes…" className={sel + ' w-full'} />
          </div>
        </div>
        {(filterStatuses.size > 0 || filterBranch || filterAE || search) && (
          <button onClick={() => { setFilterStatuses(new Set()); setFilterBranch(''); setFilterAE(''); setSearch(''); }}
            className="text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 px-3 py-1.5 rounded-lg">Clear filters</button>
        )}
      </div>

      <div className="flex items-center text-sm text-gray-600 px-1">
        <span className="font-semibold text-gray-800">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {canEdit && selectedIds.size > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-rose-800">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-white">Clear selection</button>
            <button onClick={() => setShowBulkDelete(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700">Delete {selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'}</button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>⚠ {error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300">
                {canEdit && (
                  <th className="px-3 py-3 text-center border-r border-gray-200 w-10">
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="cursor-pointer accent-rose-600" />
                  </th>
                )}
                <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-200">AE</th>
                <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-200">Branch</th>
                <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-200">Client Name</th>
                <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-200">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-200">Notes</th>
                {canEdit && <th className="px-4 py-3 text-center font-semibold text-[10px] uppercase tracking-wide text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={canEdit ? 7 : 5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canEdit ? 7 : 5} className="px-4 py-10 text-center text-gray-400 italic">No entries found</td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} className={`hover:bg-gray-50/60 ${selectedIds.has(row.id) ? 'bg-rose-50/50' : ''}`}>
                  {canEdit && (
                    <td className="px-3 py-3 text-center border-r border-gray-100">
                      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="cursor-pointer accent-rose-600" />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-gray-700 border-r border-gray-100">{row.ae || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 border-r border-gray-100">{row.branch_id ? (branchMap.get(row.branch_id) ?? row.branch_id) : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 border-r border-gray-100">{row.client_name}</td>
                  <td className="px-4 py-3 border-r border-gray-100">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate border-r border-gray-100" title={row.notes ?? ''}>{row.notes || '—'}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(row)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">Edit</button>
                        <button onClick={() => setDeleteId(row.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{editingId ? 'Edit Entry' : 'Add Entry'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">⚠ {error}</div>}
              <div>
                <label className={lbl}>AE</label>
                <input list="modal-ae-datalist" value={form.ae} onChange={e => setForm(f => ({ ...f, ae: e.target.value }))} placeholder="Select or type AE…" className={inp} autoComplete="off" />
                <datalist id="modal-ae-datalist">{aeList.map(ae => <option key={ae} value={ae} />)}</datalist>
              </div>
              <div>
                <label className={lbl}>Branch</label>
                <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                  <option value="">— Select Branch —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Client Name <span className="text-red-500">*</span></label>
                <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="e.g. JUAN DELA CRUZ PRINTING" className={inp} />
              </div>
              <div>
                <label className={lbl}>Status <span className="text-red-500">*</span></label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusType }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Demand letter sent 9/24/2025" rows={3} className={inp + ' resize-none'} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.clientName.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm */}
      {deleteId && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-900 mb-2">Delete Entry</h2>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this entry? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk delete confirm */}
      {showBulkDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBulkDelete(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-900 mb-2">Delete {selectedIds.size} {selectedIds.size === 1 ? 'Entry' : 'Entries'}</h2>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete {selectedIds.size} selected {selectedIds.size === 1 ? 'entry' : 'entries'}? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBulkDelete(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleBulkDelete} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Deleting…' : `Delete ${selectedIds.size}`}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
