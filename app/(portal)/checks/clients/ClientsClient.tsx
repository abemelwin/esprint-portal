'use client';
import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/checks/components/Toast';
import SelectField from '@/modules/checks/components/SelectField';
import ConfirmDialog from '@/modules/checks/components/ConfirmDialog';
import { computeCheckStatus, groupSortedEvents } from '@/modules/checks/lib/computeStatus';
import { todayISO } from '@/modules/checks/lib/format';
import { useColumnResize } from '@/modules/checks/hooks/useColumnResize';
import { useStickyScrollbar } from '@/modules/checks/hooks/useStickyScrollbar';
import type { Client, Branch, Check, CheckEvent } from '@/modules/checks/lib/database.types';

interface ClientsClientProps {
  initialClients: Client[];
  branches: Branch[];
  subsidiaries: string[];
  aeList: string[];
  checks: Check[];
  events: CheckEvent[];
}

export function ClientsClient({
  initialClients,
  branches,
  subsidiaries,
  aeList,
  checks,
  events,
}: ClientsClientProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { startResize } = useColumnResize(tableRef, 'col-widths-clients-table');
  useStickyScrollbar(scrollRef);

  const [clients, setClients] = useState<Client[]>(initialClients);
  const [currentChecks, setCurrentChecks] = useState<Check[]>(checks);
  const [currentAEList, setCurrentAEList] = useState<string[]>(aeList);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmCode, setConfirmCode] = useState<string | null>(null);

  const EMPTY_FORM = { code: '', name: '', branch: '', subsidiary: '', ae: '' };
  const [form, setForm] = useState(EMPTY_FORM);

  // Build subsidiary→branch map
  const subBranchMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const b of branches) {
      if (b.subsidiary) (map[b.subsidiary] ??= []).push(b.id);
    }
    return map;
  }, [branches]);

  // Filter branches by selected subsidiary
  const visibleBranches = useMemo(() => {
    if (!form.subsidiary) return branches;
    const allowed = subBranchMap[form.subsidiary] ?? [];
    return branches.filter((b) => allowed.includes(b.id));
  }, [branches, form.subsidiary, subBranchMap]);

  function openAdd() {
    setForm({ code: '', name: '', branch: '', subsidiary: '', ae: '' });
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(cl: Client) {
    const branch = branches.find((b) => b.id === cl.branch);
    setForm({
      code: cl.code,
      name: cl.name,
      branch: cl.branch,
      subsidiary: branch?.subsidiary ?? '',
      ae: cl.ae ?? '',
    });
    setEditing(cl);
    setShowModal(true);
  }

  // ── Per-client open check counts ──────────────────────────────────────────────
  const clientStats = useMemo(() => {
    const eventsMap = groupSortedEvents(events);
    const CLOSED = new Set(['CLEARED', 'SETTLED (PAID)', 'REPLACED', 'CANCELLED']);
    const stats = new Map<string, { open: number; total: number }>();

    for (const c of currentChecks) {
      const evs = eventsMap.get(c.id) ?? [];
      const { status } = computeCheckStatus(c, evs);
      const s = stats.get(c.client) ?? { open: 0, total: 0 };
      s.total++;
      if (!CLOSED.has(status)) s.open++;
      stats.set(c.client, s);
    }
    return stats;
  }, [currentChecks, events]);

  const filtered = useMemo(() => {
    let r = clients;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Client name is required', 'error');
      return;
    }
    if (!form.branch) {
      showToast('Branch is required', 'error');
      return;
    }

    // Duplicate client name detection (case-insensitive)
    const trimmedName = form.name.trim().toLowerCase();
    const duplicate = clients.find(
      (c) => c.name.trim().toLowerCase() === trimmedName && c.code !== (editing?.code ?? '')
    );
    if (duplicate) {
      showToast(`Client "${duplicate.name}" already exists (${duplicate.code})`, 'error');
      return;
    }

    const aeCode = form.ae.trim().toUpperCase();

    let clientCode = '';
    if (editing) {
      clientCode = editing.code;
    } else {
      // Auto-generate client code: find max C-XXXX and add 1
      const nums = clients
        .map((c) => parseInt((c.code || '').replace('C-', '')))
        .filter((n) => !isNaN(n));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      clientCode = `C-${String(nextNum).padStart(4, '0')}`;
    }

    const payload = {
      code: clientCode,
      name: form.name.trim(),
      branch_id: form.branch,
      ae: aeCode || null,
    };
    setSaving(true);

    try {
      if (editing) {
        const oldAe = editing.ae ?? '';
        const res = await fetch(`/api/clients/${encodeURIComponent(editing.code)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? 'Save failed');

        setClients((prev) =>
          prev.map((c) =>
            c.code === editing.code
              ? { ...c, name: form.name.trim(), branch: form.branch, ae: aeCode || null }
              : c
          )
        );

        if (aeCode && !currentAEList.includes(aeCode)) {
          setCurrentAEList((prev) => [...prev, aeCode]);
        }

        if (aeCode !== oldAe) {
          setCurrentChecks((prev) =>
            prev.map((c) => (c.client === editing.code ? { ...c, ae: aeCode || null } : c))
          );
        }
      } else {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientCode)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? 'Save failed');

        setClients((prev) => [
          ...prev,
          { code: clientCode, name: form.name.trim(), branch: form.branch, ae: aeCode || null },
        ]);

        if (aeCode && !currentAEList.includes(aeCode)) {
          setCurrentAEList((prev) => [...prev, aeCode]);
        }
      }

      showToast('Client saved', 'success');
      setShowModal(false);
    } catch (err: any) {
      showToast(err.message ?? 'Error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    const checkCount = currentChecks.filter((c) => c.client === code).length;
    if (checkCount > 0) {
      setConfirmCode(`WARN:${code}`);
      return;
    }
    setConfirmCode(code);
  }

  async function doDelete(code: string) {
    setDeleting(code);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Delete failed');
      showToast('Client deleted', 'success');
      setClients((prev) => prev.filter((c) => c.code !== code));
    } catch (err: any) {
      showToast(err.message ?? 'Error', 'error');
    } finally {
      setDeleting(null);
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all placeholder:text-gray-400';
  const labelCls =
    'block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

  const confirmRealCode = confirmCode?.startsWith('WARN:')
    ? confirmCode.slice(5)
    : confirmCode;
  const confirmClient = confirmRealCode
    ? clients.find((c) => c.code === confirmRealCode)
    : null;
  const confirmIsWarn = confirmCode?.startsWith('WARN:') ?? false;
  const warnCheckCount = confirmIsWarn
    ? currentChecks.filter((c) => c.client === confirmRealCode).length
    : 0;

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  return (
    <>
      <div className="animate-fade-in space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500">
              Manage client records. Add new clients or edit existing ones.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or code…"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 w-56"
            />
            <button
              onClick={openAdd}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-700 transition-colors cursor-pointer"
            >
              + Add Client
            </button>
          </div>
        </div>

        {/* Total clients count & Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 px-1">
          <div className="flex items-center flex-wrap gap-3">
            <span className="font-semibold text-gray-800">
              Total: {filtered.length} client{filtered.length !== 1 ? 's' : ''}
              {search && filtered.length !== clients.length && (
                <span className="text-gray-400 font-normal"> / {clients.length}</span>
              )}
              {filtered.length > 0 && (
                <span className="text-gray-500 font-normal">
                  {' '}
                  · showing {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, filtered.length)}
                </span>
              )}
            </span>

            {/* Top Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40 shadow-xs transition-colors cursor-pointer"
                  title="Previous page"
                >
                  ← Prev
                </button>
                <span className="text-xs font-semibold text-gray-700 px-1 whitespace-nowrap">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40 shadow-xs transition-colors cursor-pointer"
                  title="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white text-gray-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <button
              onClick={() => {
                const headers = ['Code', 'Client Name', 'Subsidiary', 'Branch', 'AE'];
                const lines = [
                  headers.join(','),
                  ...filtered.map((c) => {
                    const clientBranch = branches.find((b) => b.id === c.branch);
                    return [
                      c.code,
                      c.name,
                      clientBranch?.subsidiary ?? '',
                      branchMap.get(c.branch) ?? c.branch,
                      c.ae ?? '',
                    ]
                      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                      .join(',');
                  }),
                ];
                const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `ESPrint_Clients_${todayISO()}.csv`;
                a.click();
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div ref={scrollRef} className="overflow-x-auto">
            <table ref={tableRef} className="report w-full min-w-max text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="relative px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide">
                    CLIENT NAME
                    <span
                      onMouseDown={(e) => startResize(e, 0)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        zIndex: 1,
                      }}
                    />
                  </th>
                  <th className="relative px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide">
                    SUBSIDIARY
                    <span
                      onMouseDown={(e) => startResize(e, 1)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        zIndex: 1,
                      }}
                    />
                  </th>
                  <th className="relative px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide">
                    BRANCH
                    <span
                      onMouseDown={(e) => startResize(e, 2)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        zIndex: 1,
                      }}
                    />
                  </th>
                  <th className="relative px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide">
                    AE
                    <span
                      onMouseDown={(e) => startResize(e, 3)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        zIndex: 1,
                      }}
                    />
                  </th>
                  <th className="relative px-4 py-3 text-center font-semibold text-[10px] uppercase tracking-wide">
                    OPEN CHECKS
                    <span
                      onMouseDown={(e) => startResize(e, 4)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        zIndex: 1,
                      }}
                    />
                  </th>
                  <th className="relative px-4 py-3 text-left font-semibold text-[10px] uppercase tracking-wide">
                    <span
                      onMouseDown={(e) => startResize(e, 5)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        zIndex: 1,
                      }}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => {
                  const stats = clientStats.get(c.code);
                  const openCount = stats?.open ?? 0;
                  const totalCount = stats?.total ?? 0;
                  const clientBranch = branches.find((b) => b.id === c.branch);
                  return (
                    <tr
                      key={c.code}
                      className="border-t border-gray-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{clientBranch?.subsidiary ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {clientBranch?.name ?? c.branch}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.ae ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {totalCount === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <button
                            onClick={() => router.push(`/checks/all?client=${encodeURIComponent(c.code)}`)}
                            className="inline-flex items-center gap-1 group cursor-pointer"
                            title={`${openCount} open / ${totalCount} total checks`}
                          >
                            <span
                              className={`font-bold text-sm ${openCount > 0 ? 'text-red-600' : 'text-gray-400'}`}
                            >
                              {openCount}
                            </span>
                            <span className="text-gray-300 text-xs">/ {totalCount}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(c.code)}
                            disabled={deleting === c.code}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            {deleting === c.code ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">
                      No clients found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} clients
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 bg-white font-medium text-gray-700 shadow-xs transition-colors cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="font-semibold text-gray-700 px-1">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 bg-white font-medium text-gray-700 shadow-xs transition-colors cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add / Edit Modal */}
        {showModal &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '80px 16px 32px',
                background: 'rgba(0, 0, 0, 0.4)',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  width: '100%',
                  maxWidth: 560,
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                    {editing ? 'Edit Client' : 'Add Client'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 18,
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
                <form
                  onSubmit={handleSave}
                  noValidate
                  style={{
                    padding: '20px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 16,
                  }}
                >
                  <div style={{ gridColumn: 'span 2 / span 2' }}>
                    <label className={labelCls}>Client name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls}
                      placeholder="Full client name"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Subsidiary *</label>
                    <SelectField
                      value={form.subsidiary}
                      onChange={(e) => {
                        const sub = e.target.value;
                        setForm((f) => ({ ...f, subsidiary: sub, branch: '' }));
                      }}
                      cls={inputCls + ' appearance-none pr-9 cursor-pointer'}
                    >
                      <option value="">— Select subsidiary —</option>
                      {subsidiaries.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className={labelCls}>Branch *</label>
                    <SelectField
                      value={form.branch}
                      onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                      cls={inputCls + ' appearance-none pr-9 cursor-pointer'}
                    >
                      <option value="">— Select branch —</option>
                      {visibleBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div style={{ gridColumn: 'span 2 / span 2' }}>
                    <label className={labelCls}>Account Executive (AE)</label>
                    <select
                      value={form.ae}
                      onChange={(e) => setForm((f) => ({ ...f, ae: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">— Select AE —</option>
                      {[...currentAEList].sort().map((ae) => (
                        <option key={ae} value={ae}>
                          {ae}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    style={{
                      gridColumn: 'span 2 / span 2',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 10,
                      paddingTop: 12,
                      borderTop: '1px solid #f1f5f9',
                      marginTop: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        cursor: 'pointer',
                        color: '#374151',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        padding: '9px 20px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        background: '#1e3a8a',
                        color: '#fff',
                        border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>

      <ConfirmDialog
        open={!!confirmCode}
        title="Delete Client"
        message={
          confirmIsWarn
            ? `This client has ${warnCheckCount} check${warnCheckCount > 1 ? 's' : ''} in the system.\n\nDeleting the client will NOT remove those checks, but their client name will display as the raw code instead.\n\nDelete anyway?`
            : confirmClient
            ? `Delete "${confirmClient.name}" (${confirmRealCode})? This cannot be undone.`
            : `Delete client ${confirmRealCode}? This cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={() => {
          const code = confirmRealCode!;
          setConfirmCode(null);
          doDelete(code);
        }}
        onCancel={() => setConfirmCode(null)}
      />
    </>
  );
}
