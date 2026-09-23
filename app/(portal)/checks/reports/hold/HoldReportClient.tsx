'use client';
import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/modules/checks/components/StatusBadge';
import ExportCsvModal from '@/modules/checks/components/ExportCsvModal';
import { computeCheckStatus, groupSortedEvents } from '@/modules/checks/lib/computeStatus';
import { fmtPHP, fmtDate, todayISO } from '@/modules/checks/lib/format';
import { canSeeCheck } from '@/modules/checks/lib/permissions';
import { useColumnResize } from '@/modules/checks/hooks/useColumnResize';
import { useStickyScrollbar } from '@/modules/checks/hooks/useStickyScrollbar';
import type { AppData } from '@/modules/checks/lib/database.types';
import type { CheckPerms } from '@/modules/checks/lib/permissions';

type ServerData = AppData;
type UserPerms = CheckPerms;

type HoldSortKey = 'clientName' | 'branchName' | 'checkDate' | 'originalAmount' | 'balance' | 'nextDep' | 'aging' | 'status';

function HoldSortTh({ col, label, right, sortKey, sortDir, onSort, startResize, colIndex }: {
  col: HoldSortKey; label: string; right?: boolean;
  sortKey: HoldSortKey; sortDir: 'asc' | 'desc';
  onSort: (key: HoldSortKey) => void;
  startResize: (e: React.MouseEvent, colIndex: number) => void;
  colIndex: number;
}) {
  const active = sortKey === col;
  return (
    <th
      className={`relative px-3 py-2.5 font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 transition-colors ${right ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(col)}
    >
      {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      <span
        onMouseDown={e => { e.stopPropagation(); startResize(e, colIndex); }}
        onClick={e => e.stopPropagation()}
        style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }}
      />
    </th>
  );
}

interface Props {
  initialData: ServerData;
  perms: UserPerms;
}

export function HoldReportClient({ initialData: data, perms }: Props) {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { startResize } = useColumnResize(tableRef, 'col-widths-hold');
  useStickyScrollbar(scrollRef);

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSub,    setFilterSub]    = useState('');
  const [filterAE,     setFilterAE]     = useState('');
  const [filterPayFor, setFilterPayFor] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [search,       setSearch]       = useState('');
  const [sortKey,      setSortKey]      = useState<HoldSortKey>('clientName');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: HoldSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const rows = useMemo(() => {
    if (!data) return [];

    const eventsMap = groupSortedEvents(data.EVENTS);
    const clientMap = new Map(data.CLIENTS.map(c => [c.code, c]));
    const branchMap = new Map(data.BRANCHES.map(b => [b.id, b.name]));
    const today     = todayISO();

    return data.CHECKS
      .filter(c => canSeeCheck(perms, c))
      .map(c => {
        const evs = eventsMap.get(c.id) ?? [];
        const { status, holdCount, returnCount } = computeCheckStatus(c, evs);

        if (!['HELD','RETURNED'].includes(status)) return null;

        let nextDep: string | null = null;
        for (let j = evs.length - 1; j >= 0; j--) {
          if ((evs[j].type === 'HOLD_REQUEST' || evs[j].type === 'RECONSTRUCT') && evs[j].moveDate) { nextDep = evs[j].moveDate; break; }
          if (evs[j].type === 'RETURN' || evs[j].type === 'DEPOSIT_CLEARED') break;
        }

        let reason: string | null = null;
        for (let j = evs.length - 1; j >= 0; j--) {
          if (evs[j].type === 'RETURN' && evs[j].reason?.trim()) {
            reason = evs[j].reason!.trim();
            break;
          }
        }

        const totalPaid = Math.round(evs.filter(e => e.type === 'PARTIAL_PAYMENT' || e.type === 'REPLACEMENT')
          .reduce((s, e) => s + (e.amount ?? 0), 0) * 100) / 100;
        const balance = Math.max(0, Math.round((c.originalAmount - totalPaid) * 100) / 100);

        const lastEvDate = evs.length ? evs[evs.length - 1].eventDate : c.checkDate;
        const aging = lastEvDate
          ? Math.floor((new Date(today).getTime() - new Date(lastEvDate).getTime()) / 86400000)
          : null;

        const isOverdue  = status === 'HELD' && nextDep !== null && nextDep < today;
        const isDueToday = status === 'HELD' && nextDep === today;

        return {
          ...c,
          status, holdCount, returnCount, nextDep, reason, balance, aging,
          isOverdue, isDueToday,
          clientName: clientMap.get(c.client)?.name ?? '',
          branchName: branchMap.get(c.branch) ?? c.branch,
        };
      })
      .filter(Boolean) as any[];
  }, [data, perms]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filterBranch) r = r.filter((c: any) => c.branch === filterBranch);
    if (filterSub)    r = r.filter((c: any) => c.subsidiary === filterSub);
    if (filterAE)     r = r.filter((c: any) => (c.ae ?? '').toLowerCase().includes(filterAE.toLowerCase()));
    if (filterPayFor) r = r.filter((c: any) => c.paymentFor === filterPayFor);
    if (dateFrom)     r = r.filter((c: any) => (c.checkDate ?? '') >= dateFrom);
    if (dateTo)       r = r.filter((c: any) => (c.checkDate ?? '') <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((c: any) =>
        c.clientName.toLowerCase().includes(q) ||
        c.checkNo.toLowerCase().includes(q) ||
        (c.bank ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filterBranch, filterSub, filterAE, filterPayFor, dateFrom, dateTo, search]);

  const totalBalance = filtered.reduce((s: number, c: any) => s + c.balance, 0);
  const PAYMENT_FOR_OPTIONS = ['MACHINE', 'CONS', 'PARTS', 'OTHERS'];

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let va: any, vb: any;
      if (sortKey === 'originalAmount' || sortKey === 'balance' || sortKey === 'aging') {
        va = a[sortKey] ?? -1; vb = b[sortKey] ?? -1;
      } else if (sortKey === 'nextDep') {
        va = a.nextDep ?? ''; vb = b.nextDep ?? '';
      } else {
        va = String(a[sortKey] ?? ''); vb = String(b[sortKey] ?? '');
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10';

  return (
    <div className="animate-fade-in space-y-4 print:space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hold Checks Report</h1>
        </div>
      </div>

      {/* Filters — Row 1 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3 print:hidden">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Branch</label>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className={sel + ' w-full'}>
              <option value="">All my branches</option>
              {(perms.branches.includes('ALL') ? data.BRANCHES : data.BRANCHES.filter(b => perms.branches.includes(b.id)))
                .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={sel + ' w-full'} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={sel + ' w-full'} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Search</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="client, check #, bank…"
              className={sel + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Subsidiary</label>
            <select value={filterSub} onChange={e => setFilterSub(e.target.value)} className={sel + ' w-full'}>
              <option value="">All</option>
              {data.SUBSIDIARIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {/* Row 2 */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">AE (searchable)</label>
            <input
              list="hold-ae-datalist"
              value={filterAE}
              onChange={e => setFilterAE(e.target.value)}
              placeholder="Type AE…"
              className={sel}
              autoComplete="off"
            />
            <datalist id="hold-ae-datalist">
              {(data.AE_LIST ?? []).map(ae => <option key={ae} value={ae} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Payment For</label>
            <select value={filterPayFor} onChange={e => setFilterPayFor(e.target.value)} className={sel}>
              <option value="">All</option>
              {PAYMENT_FOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button onClick={() => setShowCsvModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {/* Count + total */}
      <div className="flex items-center justify-between text-sm text-gray-600 px-1">
        <span className="font-semibold text-gray-800">{filtered.length} held checks</span>
        <span className="font-semibold text-gray-800">Total balance: {fmtPHP(totalBalance)}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table ref={tableRef} className="report w-full min-w-max text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">SUBSIDIARY<span onMouseDown={e => startResize(e, 0)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <HoldSortTh col="branchName"     label="BRANCH"           sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={1} />
                <HoldSortTh col="clientName"     label="CLIENT"           sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={2} />
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">AE<span onMouseDown={e => startResize(e, 3)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">BANK / CHECK #<span onMouseDown={e => startResize(e, 4)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <HoldSortTh col="checkDate"      label="CHECK DATE"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={5} />
                <HoldSortTh col="originalAmount" label="ORIGINAL ₱"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={6} right />
                <HoldSortTh col="balance"        label="BALANCE ₱"        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={7} right />
                <HoldSortTh col="status"         label="STATUS"           sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={8} />
                <HoldSortTh col="nextDep"        label="MOVE-TO / DEPOSIT" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={9} />
                <HoldSortTh col="aging"          label="AGING"            sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} startResize={startResize} colIndex={10} right />
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">HOLD REQS<span onMouseDown={e => startResize(e, 11)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">REASON<span onMouseDown={e => startResize(e, 12)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">PAYMENT FOR<span onMouseDown={e => startResize(e, 13)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">PAYMENT DE…<span onMouseDown={e => startResize(e, 14)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c: any) => {
                const rowBg = c.isOverdue ? 'bg-amber-50' : c.isDueToday ? 'bg-green-50' : '';
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors ${rowBg}`}
                    onClick={() => router.push(`/checks/all?selected=${c.id}`)}
                  >
                    <td className="px-3 py-2.5">
                      {c.subsidiary
                        ? <span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-semibold text-[11px]">{c.subsidiary}</span>
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{c.branch}</td>
                    <td className="px-3 py-2.5">{c.clientName || c.client}</td>
                    <td className="px-3 py-2.5">{c.ae ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap">{c.bank ?? ''} {c.checkNo}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(c.checkDate)}</td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-right">{fmtPHP(c.originalAmount)}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold whitespace-nowrap text-right ${c.balance < c.originalAmount ? 'text-amber-700' : ''}`}>
                      {fmtPHP(c.balance)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className={`px-3 py-2.5 whitespace-nowrap font-medium ${c.isOverdue ? 'text-red-600' : c.isDueToday ? 'text-green-700' : ''}`}>
                      {c.nextDep ? fmtDate(c.nextDep) : '—'}
                      {c.isOverdue  && <span className="ml-1 text-[10px] font-bold text-amber-600">OVERDUE</span>}
                      {c.isDueToday && <span className="ml-1 text-[10px] font-bold text-green-600">TODAY</span>}
                    </td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${(c.aging ?? 0) > 90 ? 'text-red-600 font-semibold' : (c.aging ?? 0) > 30 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {c.aging != null ? `${c.aging}d` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">{c.holdCount || '—'}</td>
                    <td className="px-3 py-2.5">{c.reason ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {c.paymentFor
                        ? <span className={`rounded px-1.5 py-0.5 font-semibold text-[11px] ${
                            (c.paymentFor ?? '').toLowerCase() === 'others'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                              : 'bg-violet-100 text-violet-700'
                          }`}>{c.paymentFor}</span>
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={c.paymentDescription}>
                      {c.paymentDescription || '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-4 py-6 text-center text-gray-400 italic">No held checks match your filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ExportCsvModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        rows={filtered}
        filename={`ESPrint_Hold_Report_${todayISO()}.csv`}
      />
    </div>
  );
}
