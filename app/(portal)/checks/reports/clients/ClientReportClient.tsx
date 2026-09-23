'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useColumnResize } from '@/modules/checks/hooks/useColumnResize';
import { useStickyScrollbar } from '@/modules/checks/hooks/useStickyScrollbar';
import StatusBadge from '@/modules/checks/components/StatusBadge';
import CheckNotesModal from '@/modules/checks/components/CheckNotesModal';
import { computeCheckStatus, groupSortedEvents } from '@/modules/checks/lib/computeStatus';
import { fmtPHP, fmtDate, todayISO } from '@/modules/checks/lib/format';
import { canSeeCheck } from '@/modules/checks/lib/permissions';
import type { AppData, CheckEvent } from '@/modules/checks/lib/database.types';
import type { CheckPerms } from '@/modules/checks/lib/permissions';

type ServerData = AppData;
type UserPerms = CheckPerms;

type SortKey = 'clientName' | 'branchName' | 'ae' | 'checkDate' | 'originalAmount' | 'balance' | 'status';

const OPEN_STATUSES = ['OPEN', 'HELD', 'RETURNED', 'PARTIAL', 'ALTERATION', 'LEGAL', 'RECONSTRUCT'];
const CLOSED_STATUSES = ['CLEARED', 'DEPOSITED', 'SETTLED (PAID)', 'REPLACED', 'CANCELLED'];
const ALL_STATUSES_CLIENT = [...OPEN_STATUSES, ...CLOSED_STATUSES];

function StatusMultiSelect({ value, onChange }: {
  value: Set<string>;
  onChange: (v: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<'open' | 'closed' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(s: string) {
    const next = new Set(value);
    if (next.has(s)) next.delete(s); else next.add(s);
    onChange(next);
  }

  function selectGroup(group: 'open' | 'closed') {
    const statuses = group === 'open' ? OPEN_STATUSES : CLOSED_STATUSES;
    const next = new Set<string>();
    statuses.forEach(s => next.add(s));
    onChange(next);
    setExpandedGroup(group);
  }

  function selectAll() {
    onChange(new Set(ALL_STATUSES_CLIENT));
    setExpandedGroup(null);
  }

  function uncheckGroup(group: 'open' | 'closed') {
    const statuses = group === 'open' ? OPEN_STATUSES : CLOSED_STATUSES;
    const next = new Set(value);
    statuses.forEach(s => next.delete(s));
    onChange(next);
  }

  const openCount = OPEN_STATUSES.filter(s => value.has(s)).length;
  const closedCount = CLOSED_STATUSES.filter(s => value.has(s)).length;
  const isAllSelected = ALL_STATUSES_CLIENT.every(s => value.has(s));
  const isAllOpen = OPEN_STATUSES.every(s => value.has(s));
  const isAllClosed = CLOSED_STATUSES.every(s => value.has(s));

  let label = 'All statuses';
  if (value.size > 0) {
    if (isAllSelected) { label = 'All statuses'; }
    else {
      const parts: string[] = [];
      if (isAllOpen) parts.push('Open (all)');
      else if (openCount > 0) parts.push(`Open (${openCount})`);
      if (isAllClosed) parts.push('Closed (all)');
      else if (closedCount > 0) parts.push(`Closed (${closedCount})`);
      label = parts.join(', ') || 'All statuses';
    }
  }

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={sel + ' w-full flex items-center justify-between gap-2 text-left'}
      >
        <span className={value.size === 0 ? 'text-gray-500' : 'text-gray-800'}>{label}</span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm">
          <div className="px-3 py-1.5 flex justify-between border-b border-gray-100">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline font-semibold"
              onClick={selectAll}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => { onChange(new Set()); setExpandedGroup(null); }}
            >
              Clear all
            </button>
          </div>

          <div className="border-b border-gray-100">
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors"
              onClick={() => selectGroup('open')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={openCount > 0}
                  readOnly
                  className="accent-blue-700 pointer-events-none"
                  style={{ opacity: openCount > 0 && !isAllOpen ? 0.5 : 1 }}
                />
                <span className="text-sm font-semibold text-gray-800">Open</span>
                {openCount > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{openCount}</span>
                )}
              </div>
              <span className="text-gray-400 text-xs">{expandedGroup === 'open' ? '▴' : '▾'}</span>
            </div>
            {expandedGroup === 'open' && (
              <div className="pl-4 pr-3 pb-2 space-y-0.5">
                {OPEN_STATUSES.map(s => (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={value.has(s)}
                      onChange={() => toggle(s)}
                      className="accent-blue-700"
                    />
                    {s === 'OPEN' ? 'In-progress' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </label>
                ))}
                {openCount > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-red-500 hover:underline ml-2 mt-1"
                    onClick={(e) => { e.stopPropagation(); uncheckGroup('open'); }}
                  >
                    Uncheck all Open
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-green-50 transition-colors"
              onClick={() => selectGroup('closed')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={closedCount > 0}
                  readOnly
                  className="accent-green-700 pointer-events-none"
                  style={{ opacity: closedCount > 0 && !isAllClosed ? 0.5 : 1 }}
                />
                <span className="text-sm font-semibold text-gray-800">Closed</span>
                {closedCount > 0 && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">{closedCount}</span>
                )}
              </div>
              <span className="text-gray-400 text-xs">{expandedGroup === 'closed' ? '▴' : '▾'}</span>
            </div>
            {expandedGroup === 'closed' && (
              <div className="pl-4 pr-3 pb-2 space-y-0.5">
                {CLOSED_STATUSES.map(s => (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 hover:bg-green-50 cursor-pointer rounded text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={value.has(s)}
                      onChange={() => toggle(s)}
                      className="accent-green-700"
                    />
                    {s === 'CANCELLED' ? 'Write-off / Blacklist' : s === 'SETTLED (PAID)' ? 'Settled (Paid)' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </label>
                ))}
                {closedCount > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-red-500 hover:underline ml-2 mt-1"
                    onClick={(e) => { e.stopPropagation(); uncheckGroup('closed'); }}
                  >
                    Uncheck all Closed
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({ col, label, right, width, sortKey, sortDir, onSort, startResize, colIndex }: {
  col: SortKey; label: string; right?: boolean; width?: number;
  sortKey: SortKey; sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  startResize: (e: React.MouseEvent, colIndex: number) => void;
  colIndex: number;
}) {
  const active = sortKey === col;
  return (
    <th
      className={`relative px-3 py-2.5 text-xs font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
      style={width ? { width } : undefined}
      onClick={() => onSort(col)}
    >
      {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      <span onMouseDown={e => { e.stopPropagation(); startResize(e, colIndex); }} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} />
    </th>
  );
}

interface Props {
  initialData: ServerData;
  perms: UserPerms;
}

export function ClientReportClient({ initialData: data, perms }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { startResize } = useColumnResize(tableRef, 'col-widths-clients-report-v3');
  useStickyScrollbar(scrollRef);

  const isAERestricted = perms.role === 'AE' || perms.role === 'AE Access';
  const isTL = isAERestricted && perms.aes.length > 0;

  const [filterAE,     setFilterAE]     = useState(() => searchParams?.get('ae') ?? '');
  const [filterClient, setFilterClient] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set(OPEN_STATUSES));
  const [sortKey,      setSortKey]      = useState<SortKey>('clientName');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc');
  const [notesCheckId, setNotesCheckId] = useState<string | null>(null);
  const [notesCounts,  setNotesCounts]  = useState<Record<string, number>>({});

  useEffect(() => {
    if (data?.NOTES_COUNTS) setNotesCounts(data.NOTES_COUNTS);
  }, [data?.NOTES_COUNTS]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const rows = useMemo(() => {
    if (!data) return [];

    const hasEvents = (data.EVENTS?.length ?? 0) > 0;
    const eventsMap = hasEvents ? groupSortedEvents(data.EVENTS) : new Map<string, CheckEvent[]>();
    const branchMap  = new Map(data.BRANCHES.map(b => [b.id, b.name]));
    const clientMap  = new Map(data.CLIENTS.map(c => [c.code, c]));
    const meta       = data.CHECKS_META;

    return data.CHECKS
      .filter(c => canSeeCheck(perms, c))
      .map(c => {
        let status: string;
        let balance: number;
        let totalPaid: number;
        let latestUpdate: string | null = null;
        let nextDeposit: string | null = null;

        if (meta?.[c.id]) {
          const m = meta[c.id];
          status      = m.status;
          balance     = m.balance;
          totalPaid   = m.totalPaid;
          nextDeposit = m.nextDeposit;
          if (hasEvents) {
            const evs = eventsMap.get(c.id) ?? [];
            for (let j = evs.length - 1; j >= 0; j--) {
              if (evs[j].type === 'RETURN' && evs[j].notes?.trim()) {
                latestUpdate = evs[j].notes!.trim(); break;
              }
            }
          }
        } else if (hasEvents) {
          const evs = eventsMap.get(c.id) ?? [];
          const computed = computeCheckStatus(c, evs);
          status    = computed.status;
          totalPaid = Math.round(evs
            .filter(e => e.type === 'PARTIAL_PAYMENT' || e.type === 'REPLACEMENT')
            .reduce((s, e) => s + (e.amount ?? 0), 0) * 100) / 100;
          balance   = Math.max(0, Math.round((c.originalAmount - totalPaid) * 100) / 100);
          for (let j = evs.length - 1; j >= 0; j--) {
            if (evs[j].type === 'RETURN' && evs[j].notes?.trim()) { latestUpdate = evs[j].notes!.trim(); break; }
          }
          for (let j = evs.length - 1; j >= 0; j--) {
            if ((evs[j].type === 'HOLD_REQUEST' || evs[j].type === 'RECONSTRUCT') && evs[j].moveDate) { nextDeposit = evs[j].moveDate; break; }
            if (evs[j].type === 'RETURN' || evs[j].type === 'DEPOSIT_CLEARED') break;
          }
        } else {
          status    = (c.finalStatus as string) || 'OPEN';
          balance   = c.originalAmount;
          totalPaid = 0;
        }

        const cl = clientMap.get(c.client);
        return {
          id:             c.id,
          clientName:     cl?.name ?? c.client,
          clientCode:     c.client,
          branchId:       c.branch,
          branchName:     branchMap.get(c.branch) ?? c.branch,
          ae:             c.ae ?? '—',
          bank:           c.bank ?? '',
          checkNo:        c.checkNo,
          checkDate:      c.checkDate,
          originalAmount: c.originalAmount,
          balance,
          status,
          latestUpdate,
          nextDeposit,
          notes:              c.notes ?? '',
          paymentFor:         c.paymentFor ?? '',
          paymentDescription: c.paymentDescription ?? '',
        };
      });
  }, [data, perms]);

  const aeOptions = useMemo(() => {
    if (isAERestricted) {
      return [...new Set(perms.aes)].sort();
    }
    const fromChecks = Array.from(new Set(rows.map(r => r.ae).filter(ae => ae && ae !== '—')));
    const fromList   = data?.AE_LIST ?? [];
    return Array.from(new Set([...fromList, ...fromChecks])).sort();
  }, [rows, data?.AE_LIST, perms, isAERestricted]);

  const filtered = useMemo(() => {
    let r = rows;

    if (filterAE) r = r.filter(c => c.ae === filterAE);

    if (filterClient.trim()) {
      const q = filterClient.trim().toLowerCase();
      r = r.filter(c =>
        c.clientName.toLowerCase().includes(q) ||
        c.clientCode.toLowerCase().includes(q)
      );
    }

    if (statusFilter.size > 0) r = r.filter(c => statusFilter.has(c.status));

    return [...r].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === 'originalAmount' || sortKey === 'balance') {
        va = (a as any)[sortKey]; vb = (b as any)[sortKey];
      } else {
        va = String((a as any)[sortKey] ?? '');
        vb = String((b as any)[sortKey] ?? '');
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, filterAE, filterClient, statusFilter, sortKey, sortDir]);

  function exportCSV() {
    const headers = ['Client Name','Branch','AE','Bank','Check #','Check Date','Check Amount','Balance','Next Deposit','Status','Update'];
    const lines = [
      headers.join(','),
      ...filtered.map(c => [
        c.clientName, c.branchName, c.ae,
        c.bank, c.checkNo,
        c.checkDate ?? '',
        c.originalAmount, c.balance,
        c.status,
        c.nextDeposit ?? '',
        c.latestUpdate ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ESPrint_ClientReport_${todayISO()}.csv`;
    a.click();
  }

  const totalAmt = filtered.reduce((s, c) => s + c.originalAmount, 0);
  const totalBal = filtered.reduce((s, c) => s + c.balance, 0);
  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10';

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Client Report</h1>
          <p className="text-sm text-gray-500">
            Filter by AE, client name, or status to generate a flat check list.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className={`grid grid-cols-1 gap-3 ${isAERestricted ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {(!isAERestricted || isTL) && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">AE</label>
            <select value={filterAE} onChange={e => setFilterAE(e.target.value)} className={sel + ' w-full'}>
              <option value="">{isTL ? 'All my team' : 'All AEs'}</option>
              {aeOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Client name</label>
            <input
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              placeholder="Type to search…"
              className={sel + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Status</label>
            <StatusMultiSelect value={statusFilter} onChange={setStatusFilter} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={exportCSV}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Checks',        value: String(filtered.length),  cls: 'text-gray-900' },
          { label: 'Total Amount',  value: fmtPHP(totalAmt),         cls: 'text-blue-700' },
          { label: 'Total Balance', value: fmtPHP(totalBal),         cls: 'text-amber-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{s.label}</div>
            <div className={`text-base font-bold mt-1 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Flat check table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table ref={tableRef} className="report w-full min-w-max text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <SortTh col="clientName"     label="CLIENT NAME"   width={180} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={0} />
                <SortTh col="branchName"     label="BRANCH"        width={100} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={1} />
                <SortTh col="ae"             label="AE"            width={80}  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={2} />
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap" style={{ width: 160 }}>CHECK #<span onMouseDown={e => startResize(e, 3)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <SortTh col="checkDate"      label="CHECK DATE"    width={90}  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={4} />
                <SortTh col="originalAmount" label="CHECK AMOUNT"  width={110} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={5} right />
                <SortTh col="balance"        label="BALANCE"       width={100} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={6} right />
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap" style={{ width: 110 }}>NEXT DEPOSIT<span onMouseDown={e => startResize(e, 7)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <SortTh col="status"         label="STATUS"        width={90}  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={8} />
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap" style={{ width: 160 }}>UPDATE<span onMouseDown={e => startResize(e, 9)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap" style={{ width: 80 }}>PAYMENT FOR<span onMouseDown={e => startResize(e, 10)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap" style={{ width: 140 }}>PAYMENT DE…<span onMouseDown={e => startResize(e, 11)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap" style={{ width: 140 }}>NOTES<span onMouseDown={e => startResize(e, 12)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-50 transition-colors ${isAERestricted ? '' : 'hover:bg-blue-50 cursor-pointer'}`}
                  onClick={() => {
                    if (isAERestricted) return;
                    router.push(`/checks/all?selected=${c.id}`);
                  }}
                >
                  <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{c.clientName}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.branchName}</td>
                  <td className="px-3 py-2 text-gray-500">{c.ae}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-gray-800 whitespace-nowrap">{c.bank} {c.checkNo}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(c.checkDate)}</td>
                  <td className="px-3 py-2 font-mono text-gray-700 text-right whitespace-nowrap">{fmtPHP(c.originalAmount)}</td>
                  <td className={`px-3 py-2 font-mono font-semibold text-right whitespace-nowrap ${c.balance < c.originalAmount ? 'text-amber-700' : 'text-gray-800'}`}>
                    {fmtPHP(c.balance)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {c.nextDeposit ? fmtDate(c.nextDeposit) : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={c.latestUpdate ?? undefined}>
                    {c.latestUpdate ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-purple-700 font-semibold whitespace-nowrap">{c.paymentFor || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={c.paymentDescription}>{c.paymentDescription || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate" title={c.notes} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setNotesCheckId(c.id)}
                      title="View / add notes"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        border: '1px solid #e2e8f0',
                        background: notesCounts[c.id] ? '#eff6ff' : '#f8fafc',
                        color: notesCounts[c.id] ? '#1e3a8a' : '#9ca3af',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      📋 {notesCounts[c.id] ? notesCounts[c.id] : 'Add'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-gray-400 italic">
                    No checks match your filters.
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={5} className="px-3 py-2.5 text-xs font-semibold text-gray-600">
                    Total ({filtered.length} checks)
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-gray-900 text-right whitespace-nowrap">
                    {fmtPHP(totalAmt)}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-amber-700 text-right whitespace-nowrap">
                    {fmtPHP(totalBal)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Notes Modal */}
      {notesCheckId && (() => {
        const c = filtered.find(r => r.id === notesCheckId);
        return (
          <CheckNotesModal
            checkId={notesCheckId}
            checkLabel={c ? `${c.bank} ${c.checkNo} — ${c.clientName}` : notesCheckId}
            onClose={() => setNotesCheckId(null)}
            onCountChange={(id, count) => setNotesCounts(prev => ({ ...prev, [id]: count }))}
          />
        );
      })()}
    </div>
  );
}
