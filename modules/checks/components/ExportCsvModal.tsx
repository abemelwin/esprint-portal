'use client';
/**
 * ExportCsvModal — column-picker CSV export.
 * Direct port from esprint-check-monitoring/components/ExportCsvModal.tsx.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { displayUser } from '../lib/format';

interface ColumnOption { key: string; label: string; }

const ALL_COLUMNS: ColumnOption[] = [
  { key: 'subsidiary',   label: 'Subsidiary' },
  { key: 'branch',       label: 'Branch' },
  { key: 'clientCode',   label: 'Client Code' },
  { key: 'clientName',   label: 'Client Name' },
  { key: 'ae',           label: 'AE' },
  { key: 'bank',         label: 'Bank' },
  { key: 'checkNo',      label: 'Check Number' },
  { key: 'checkDate',    label: 'Check Date' },
  { key: 'originalAmt',  label: 'Original Amount' },
  { key: 'totalPaid',    label: 'Total Paid' },
  { key: 'balance',      label: 'Current Balance' },
  { key: 'status',       label: 'Status' },
  { key: 'reason',       label: 'Reason' },
  { key: 'latestUpdate', label: 'Update' },
  { key: 'paymentFor',   label: 'Payment For' },
  { key: 'paymentDesc',  label: 'Payment Description' },
  { key: 'notes',        label: 'Notes' },
  { key: 'holdReqs',     label: '# Hold Requests' },
  { key: 'returns',      label: '# Returns' },
  { key: 'nextDeposit',  label: 'Next Deposit' },
  { key: 'aging',        label: 'Aging (days)' },
  { key: 'encodedBy',    label: 'Encoded By' },
];

interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows:     any[];
  filename: string;
}

export default function ExportCsvModal({ isOpen, onClose, rows, filename }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(ALL_COLUMNS.map(c => c.key))
  );

  if (!isOpen || typeof document === 'undefined') return null;

  function toggle(key: string) {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  }

  function handleDownload() {
    if (selected.size === 0) { alert('Please select at least one column.'); return; }
    const activeCols = ALL_COLUMNS.filter(c => selected.has(c.key));
    const header = activeCols.map(c => c.label);
    const csvRows = rows.map(c => {
      const totalPaid = c.totalPaid ?? (c.originalAmount != null && c.balance != null ? c.originalAmount - c.balance : 0);
      const all: Record<string, unknown> = {
        subsidiary:   c.subsidiary ?? '',
        branch:       c.branchName ?? c.branch ?? '',
        clientCode:   c.client ?? c.clientCode ?? '',
        clientName:   c.clientName ?? '',
        ae:           c.ae ?? '',
        bank:         c.bank ?? '',
        checkNo:      c.checkNo ?? '',
        checkDate:    c.checkDate ?? '',
        originalAmt:  c.originalAmount ?? 0,
        totalPaid,
        balance:      c.balance ?? 0,
        status:       c.status ?? '',
        reason:       c.reason ?? '',
        latestUpdate: c.latestUpdate ?? '',
        paymentFor:   c.paymentFor ?? '',
        paymentDesc:  (c.paymentDescription ?? '').replace(/[\r\n]+/g, ' '),
        notes:        (c.notes ?? '').replace(/[\r\n]+/g, ' '),
        holdReqs:     c.holdCount ?? c.holdReqs ?? '',
        returns:      c.returnCount ?? c.returns ?? '',
        nextDeposit:  c.nextDeposit ?? c.nextDep ?? '',
        aging:        c.aging ?? '',
        encodedBy:    displayUser(c.createdBy ?? c.encodedBy ?? ''),
      };
      return activeCols.map(col => all[col.key]);
    });
    const csv = [
      header.join(','),
      ...csvRows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.setAttribute('download', filename); a.click();
    URL.revokeObjectURL(url);
    onClose();
  }

  return createPortal(
    <div style={{ position:'fixed',inset:0,zIndex:99999,overflowY:'auto',display:'flex',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.5)',padding:16 }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[640px] relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Export CSV — Select Columns</h2>
        <p className="text-xs text-gray-500 mb-4">Choose which columns to include ({rows.length} row{rows.length !== 1 ? 's' : ''}).</p>
        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mb-3">
          <button type="button" onClick={() => setSelected(new Set(ALL_COLUMNS.map(c => c.key)))} className="hover:underline">Select all</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => setSelected(new Set())} className="hover:underline">Deselect all</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-4 border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto mb-5">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer select-none hover:bg-slate-50 p-1 rounded">
              <input type="checkbox" checked={selected.has(col.key)} onChange={() => toggle(col.key)}
                className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer accent-blue-600" />
              <span>{col.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
          <button onClick={handleDownload} className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1e3a8a] hover:bg-blue-800">↓ Download CSV</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
