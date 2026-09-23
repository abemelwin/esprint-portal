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

type ViewMode = 'scheduled' | 'cleared' | 'all';

const ONE_DAY   = 86400000;
const ONE_WEEK  = 7  * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

interface Props {
  initialData: ServerData;
  perms: UserPerms;
}

export function DepositsReportClient({ initialData: data, perms }: Props) {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { startResize } = useColumnResize(tableRef, 'col-widths-deposits');
  useStickyScrollbar(scrollRef);

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSub,    setFilterSub]    = useState('');
  const [search,       setSearch]       = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [viewMode,     setViewMode]     = useState<ViewMode>('scheduled');

  function setQuick(range: 'today' | 'week' | 'month') {
    const now = Date.now();
    const start = new Date(now).toISOString().slice(0, 10);
    let end: string;
    if (range === 'today') {
      end = start;
    } else if (range === 'week') {
      end = new Date(now + ONE_WEEK).toISOString().slice(0, 10);
    } else {
      end = new Date(now + ONE_MONTH).toISOString().slice(0, 10);
    }
    setDateFrom(start);
    setDateTo(end);
  }

  const rows = useMemo(() => {
    if (!data) return [];

    const eventsMap = groupSortedEvents(data.EVENTS);
    const clientMap = new Map(data.CLIENTS.map(c => [c.code, c]));
    const branchMap = new Map(data.BRANCHES.map(b => [b.id, b.name]));
    const today     = todayISO();

    return data.CHECKS.filter(c => canSeeCheck(perms, c)).map(c => {
      const evs    = eventsMap.get(c.id) ?? [];
      const { status } = computeCheckStatus(c, evs);

      let nextDeposit: string | null = null;
      for (let j = evs.length - 1; j >= 0; j--) {
        if ((evs[j].type === 'HOLD_REQUEST' || evs[j].type === 'RECONSTRUCT') && evs[j].moveDate) { nextDeposit = evs[j].moveDate; break; }
        if (evs[j].type === 'RETURN' || evs[j].type === 'DEPOSIT_CLEARED') break;
      }

      const isScheduled = status === 'HELD' && !!nextDeposit;
      const isDeposited = status === 'DEPOSITED' || status === 'CLEARED';
      if (!isScheduled && !isDeposited) return null;

      const depositEv = [...evs].reverse().find(e => e.type === 'DEPOSITED');
      const clearedEv = [...evs].reverse().find(e => e.type === 'DEPOSIT_CLEARED');

      const totalPaid = Math.round(evs
        .filter(e => e.type === 'PARTIAL_PAYMENT' || e.type === 'REPLACEMENT')
        .reduce((s, e) => s + (e.amount ?? 0), 0) * 100) / 100;
      const balance = Math.max(0, Math.round((c.originalAmount - totalPaid) * 100) / 100);

      const isOverdue  = isScheduled && nextDeposit! < today;
      const isDueToday = isScheduled && nextDeposit === today;

      return {
        ...c, status, balance,
        nextDeposit, isScheduled, isDeposited, isOverdue, isDueToday,
        depositDate:  depositEv?.eventDate ?? null,
        clearedDate:  clearedEv?.eventDate ?? null,
        clientName:   clientMap.get(c.client)?.name ?? '',
        branchName:   branchMap.get(c.branch) ?? c.branch,
      };
    }).filter(Boolean) as any[];
  }, [data, perms]);

  const filtered = useMemo(() => {
    let r = rows;
    if (viewMode === 'scheduled') r = r.filter((c: any) => c.isScheduled);
    if (viewMode === 'cleared')   r = r.filter((c: any) => c.isDeposited);
    if (filterBranch) r = r.filter((c: any) => c.branch === filterBranch);
    if (filterSub)    r = r.filter((c: any) => c.subsidiary === filterSub);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((c: any) =>
        c.checkNo.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.bank ?? '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) r = r.filter((c: any) => {
      const d = c.isScheduled ? c.nextDeposit : (c.depositDate ?? c.checkDate ?? '');
      return d >= dateFrom;
    });
    if (dateTo) r = r.filter((c: any) => {
      const d = c.isScheduled ? c.nextDeposit : (c.depositDate ?? c.checkDate ?? '');
      return d <= dateTo;
    });
    return r;
  }, [rows, viewMode, filterBranch, filterSub, search, dateFrom, dateTo]);

  const totalAmt = filtered.reduce((s: number, c: any) => s + (c.originalAmount ?? 0), 0);
  const totalBal = filtered.reduce((s: number, c: any) => s + (c.balance ?? 0), 0);

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10';

  return (
    <div className="animate-fade-in space-y-4 print:space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Deposits Report</h1>
          <p className="text-sm text-gray-500">
            Checks scheduled to deposit (from latest hold request) and checks already cleared.
            Use quick filters or pick a custom range.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCsvModal(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50">
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Branch</label>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className={sel + ' w-full'}>
              <option value="">All my branches</option>
              {(perms.branches.length === 0 || perms.branches.includes('ALL') ? data.BRANCHES : data.BRANCHES.filter(b => perms.branches.includes(b.id)))
                .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Subsidiary</label>
            <select value={filterSub} onChange={e => setFilterSub(e.target.value)} className={sel + ' w-full'}>
              <option value="">All</option>
              {data.SUBSIDIARIES.map(s => <option key={s} value={s}>{s}</option>)}
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
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="client, check #, bank…" className={sel + ' w-full'} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">View</label>
            <select value={viewMode} onChange={e => setViewMode(e.target.value as ViewMode)} className={sel + ' w-full'}>
              <option value="scheduled">Scheduled (next deposit)</option>
              <option value="cleared">Deposited / Cleared</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setFilterBranch(''); setFilterSub(''); setSearch(''); setDateFrom(''); setDateTo(''); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
            Clear filters
          </button>
          {/* Quick filters */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Quick:</span>
            <button onClick={() => setQuick('today')} className="text-blue-600 hover:underline font-semibold px-1">Today</button>
            <span>·</span>
            <button onClick={() => setQuick('week')} className="text-blue-600 hover:underline font-semibold px-1">This week</button>
            <span>·</span>
            <button onClick={() => setQuick('month')} className="text-blue-600 hover:underline font-semibold px-1">This month</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 px-1">
        <span>
          {filtered.length} entries · mode: <strong>{viewMode}</strong>
        </span>
        <span className="font-semibold text-gray-800">Total: {fmtPHP(totalAmt)}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table ref={tableRef} className="report w-full min-w-max text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['SUBSIDIARY','BRANCH','CLIENT','AE','BANK / CHECK #','CHECK DATE',
                  'ORIGINAL ₱','BALANCE ₱','STATUS','NEXT DEPOSIT / DEPOSIT DATE','CLEARED DATE'].map((h, i) => (
                  <th key={h} className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    {h}
                    <span onMouseDown={e => startResize(e, i)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', userSelect:'none', zIndex:1 }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-blue-50
                    ${c.isOverdue ? 'bg-amber-50/40' : c.isDueToday ? 'bg-green-50/40' : ''}`}
                  onClick={() => router.push(`/checks/all?selected=${c.id}`)}
                >
                  <td className="px-3 py-2 text-gray-500">
                    {c.subsidiary
                      ? <span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-semibold">{c.subsidiary}</span>
                      : '—'}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap select-text">{c.branchName || c.branch}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap select-text">{c.clientName || c.client}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap select-text">{c.ae ?? '—'}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-gray-800 whitespace-nowrap select-text">{c.bank} {c.checkNo}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap select-text">{fmtDate(c.checkDate)}</td>
                  <td className="px-3 py-2 font-mono text-gray-700 text-right whitespace-nowrap select-text">{fmtPHP(c.originalAmount)}</td>
                  <td className={`px-3 py-2 font-mono font-semibold text-right whitespace-nowrap select-text ${c.balance < c.originalAmount ? 'text-amber-700' : 'text-gray-800'}`}>
                    {fmtPHP(c.balance)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={c.status} /></td>
                  <td className={`px-3 py-2 whitespace-nowrap font-medium ${c.isOverdue ? 'text-red-600' : c.isDueToday ? 'text-green-700' : 'text-gray-600'}`}>
                    {c.isScheduled
                      ? <>{fmtDate(c.nextDeposit)}{c.isOverdue && <span className="ml-1 text-[10px] font-bold text-red-500">OVERDUE</span>}{c.isDueToday && <span className="ml-1 text-[10px] font-bold text-green-600">TODAY</span>}</>
                      : fmtDate(c.depositDate)
                    }
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(c.clearedDate)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 italic">No entries in this range.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={6} className="px-3 py-2.5 text-xs font-semibold text-gray-600">Total ({filtered.length})</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-gray-900 text-right whitespace-nowrap">{fmtPHP(totalAmt)}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-amber-700 text-right whitespace-nowrap">{fmtPHP(totalBal)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <ExportCsvModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        rows={filtered}
        filename={`ESPrint_DepositsReport_${todayISO()}.csv`}
      />
    </div>
  );
}
