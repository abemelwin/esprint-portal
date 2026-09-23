'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/checks/components/Toast';
import ConfirmDialog from '@/modules/checks/components/ConfirmDialog';
import { fmtPHP, fmtDate, fmtDateTime } from '@/modules/checks/lib/format';
import type { Check, CheckEvent, Client, Branch } from '@/modules/checks/lib/database.types';

export interface DeletedRow {
  id: string;
  check_id: string;
  check_snapshot: Check;
  events_snapshot: CheckEvent[];
  deleted_by: string;
  deleted_by_name: string;
  deleted_at: string;
}

interface DeletedChecksClientProps {
  initialRows: DeletedRow[];
  clients: Client[];
  branches: Branch[];
}

export function DeletedChecksClient({ initialRows, clients, branches }: DeletedChecksClientProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [rows, setRows] = useState<DeletedRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCheckNo, setFilterCheckNo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [recoverConfirmRow, setRecoverConfirmRow] = useState<DeletedRow | null>(null);

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) map.set(c.code, c.name);
    return map;
  }, [clients]);

  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deleted-checks');
      if (res.status === 401) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (!json.ok) showToast('Failed to load delete history', 'error');
      else setRows(json.data ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [showToast]);

  const filteredRows = filterCheckNo.trim()
    ? rows.filter((r) => {
        const c = r.check_snapshot;
        const q = filterCheckNo.trim().toLowerCase();
        const clientName = clientNameMap.get(c?.client ?? '') ?? '';
        return (
          (c?.checkNo ?? '').toLowerCase().includes(q) ||
          (c?.bank ?? '').toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q)
        );
      })
    : rows;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map((r) => r.id)));
    }
  }

  function recoverCheck(row: DeletedRow) {
    setRecoverConfirmRow(row);
  }

  async function doRecover(row: DeletedRow) {
    setRecoverConfirmRow(null);
    setRecovering(row.id);
    try {
      const res = await fetch('/api/checks/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedRowId: row.id }),
      });
      const json = await res.json();
      const c = row.check_snapshot;
      if (json.ok) {
        showToast(`Check ${c?.checkNo ?? ''} recovered`, 'success');
        load();
      } else {
        showToast(json.error ?? 'Recovery failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message ?? 'Recovery failed', 'error');
    } finally {
      setRecovering(null);
    }
  }

  async function executeBulkDelete(ids: string[]) {
    setConfirmDelete(null);
    if (!ids.length) return;
    setWorking(true);
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(`/api/deleted-checks/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) failed++;
    }
    setWorking(false);
    setSelected(new Set());
    if (failed === 0) {
      showToast(
        `${ids.length} record${ids.length > 1 ? 's' : ''} permanently deleted`,
        'success'
      );
    } else {
      showToast(`${failed} deletion(s) failed`, 'error');
    }
    load();
  }

  const allSelected = filteredRows.length > 0 && selected.size === filteredRows.length;

  return (
    <div className="animate-fade-in space-y-5 w-full">
      <div>
        <button
          onClick={() => router.push('/checks/admin')}
          className="text-sm text-blue-700 hover:text-blue-900 font-medium mb-1 inline-flex items-center gap-1 cursor-pointer"
        >
          ← Back to Admin
        </button>
        <h1 className="text-xl font-bold text-gray-900">Deleted Checks History</h1>
        <p className="text-sm text-gray-500">
          Audit log of all deleted checks. Recover to restore, or select multiple to permanently delete.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={filterCheckNo}
          onChange={(e) => setFilterCheckNo(e.target.value)}
          placeholder="Filter by Check #, client…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 w-64"
        />
        {filterCheckNo && (
          <button
            onClick={() => setFilterCheckNo('')}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            ✕ Clear
          </button>
        )}

        {selected.size > 0 && (
          <>
            <button
              onClick={() => setConfirmDelete(Array.from(selected))}
              disabled={working}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              🗑 Delete Selected ({selected.size})
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Cancel
            </button>
          </>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-gray-400 italic">
          Loading deleted checks…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-gray-400 italic">
          {rows.length === 0 ? 'No deleted checks yet.' : 'No results match your filter.'}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
          <div style={{ minWidth: '1100px' }}>
            <table className="report text-xs w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </th>
                  {[
                    'DELETED AT',
                    'DELETED BY',
                    'CLIENT NAME',
                    'BRANCH',
                    'BANK / CHECK #',
                    'CHECK DATE',
                    'AMOUNT',
                    'EVENTS',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const c = row.check_snapshot;
                  const evs = row.events_snapshot ?? [];
                  const isOpen = expanded === row.id;
                  const isRecovering = recovering === row.id;
                  const isChecked = selected.has(row.id);
                  const clientName = (clientNameMap.get(c?.client ?? '') || c?.client) ?? '—';
                  const branchName = (branchNameMap.get(c?.branch ?? '') || c?.branch) ?? '—';

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`border-b border-gray-50 transition-colors ${
                          isChecked ? 'bg-red-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(row.id)}
                            className="rounded border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                          {row.deleted_at ? fmtDateTime(row.deleted_at) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-red-700 whitespace-nowrap">
                          {row.deleted_by_name}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">
                          {clientName}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {branchName}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-gray-800 whitespace-nowrap">
                          {c?.bank} {c?.checkNo}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {fmtDate(c?.checkDate)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-800 whitespace-nowrap">
                          {c?.originalAmount != null ? fmtPHP(c.originalAmount) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">
                          {evs.length > 0 ? (
                            <button
                              onClick={() => setExpanded(isOpen ? null : row.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold whitespace-nowrap cursor-pointer"
                            >
                              {isOpen ? '▲ Hide' : `▼ ${evs.length} event${evs.length !== 1 ? 's' : ''}`}
                            </button>
                          ) : (
                            '0 events'
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <button
                            onClick={() => recoverCheck(row)}
                            disabled={isRecovering || working}
                            className="text-xs font-bold text-green-700 hover:text-green-900 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                          >
                            {isRecovering ? '…' : '♻ Recover'}
                          </button>
                        </td>
                      </tr>

                      {isOpen && evs.length > 0 && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={10} className="px-6 py-3">
                            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Event Timeline
                            </div>
                            <div className="space-y-1.5">
                              {evs.map((ev, i) => (
                                <div key={i} className="flex items-start gap-3 text-xs text-gray-700">
                                  <span className="text-gray-400 whitespace-nowrap shrink-0">
                                    {ev.eventDate ? fmtDate(ev.eventDate) : '—'}
                                  </span>
                                  <span className="font-semibold text-gray-800 whitespace-nowrap shrink-0">
                                    {ev.type}
                                  </span>
                                  {ev.amount != null && (
                                    <span className="font-mono text-gray-700 shrink-0">
                                      {fmtPHP(ev.amount)}
                                    </span>
                                  )}
                                  {ev.reason && (
                                    <span className="text-gray-500">{ev.reason}</span>
                                  )}
                                  {ev.notes && (
                                    <span className="italic text-gray-400">{ev.notes}</span>
                                  )}
                                  <span className="text-gray-400 ml-auto shrink-0">
                                    by {ev.recordedBy ?? '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Permanently Delete Records"
        message={`Permanently delete ${confirmDelete?.length ?? 0} record${(confirmDelete?.length ?? 0) !== 1 ? 's' : ''}? This CANNOT be undone.`}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        danger
        onConfirm={() => executeBulkDelete(confirmDelete ?? [])}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={recoverConfirmRow !== null}
        title="Recover Check"
        message={(() => {
          if (!recoverConfirmRow) return '';
          const c = recoverConfirmRow.check_snapshot;
          const clientName = (clientNameMap.get(c?.client ?? '') || c?.client) ?? '';
          return `Recover check ${c?.bank ?? ''} ${c?.checkNo ?? ''} for ${clientName}? This will restore it and all its events back to the active ledger.`;
        })()}
        confirmText="Recover"
        cancelText="Cancel"
        danger={false}
        onConfirm={() => recoverConfirmRow && doRecover(recoverConfirmRow)}
        onCancel={() => setRecoverConfirmRow(null)}
      />
    </div>
  );
}
