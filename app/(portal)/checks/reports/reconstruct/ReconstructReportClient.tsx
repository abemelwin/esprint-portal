'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import StatusBadge from '@/modules/checks/components/StatusBadge';
import { fmtPHP, fmtDate, todayISO } from '@/modules/checks/lib/format';
import { computeCheckStatus, groupSortedEvents } from '@/modules/checks/lib/computeStatus';
import { exportReconstructExcel } from '@/modules/checks/lib/exportReconstruct';
import { generateSOA } from '@/modules/checks/lib/exportSOA';
import ClientAttachmentsPanel from '@/modules/checks/components/ClientAttachmentsPanel';
import { canCreate } from '@/modules/checks/lib/permissions';
import type { ServerData } from '@/modules/checks/lib/data';
import type { UserPerms } from '@/modules/checks/lib/permissions';

interface Props {
  initialData: ServerData;
  perms: UserPerms;
  userName: string;
}

export function ReconstructReportClient({ initialData: data, perms, userName }: Props) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [interestMap, setInterestMap]       = useState<Record<string, string>>({});
  const [interestSaving, setInterestSaving] = useState<Record<string, boolean>>({});
  const [editingInterest, setEditingInterest] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<Record<string, 'payment' | 'schedule'>>({});

  type ScheduleRowUI = { id: string; scheduleDate: string; monthlyAmortization: string; amount: string; paymentDetails: string; eventId: string | null; checkId: string | null; editing: boolean };
  const [scheduleMap, setScheduleMap]   = useState<Record<string, ScheduleRowUI[]>>({});
  const [scheduleSaving, setScheduleSaving] = useState<Record<string, boolean>>({});
  const [applyingRow, setApplyingRow]   = useState<string | null>(null);
  const [selectedScheduleRows, setSelectedScheduleRows] = useState<Record<string, Set<string>>>({});
  const [deletingSelected, setDeletingSelected] = useState<Record<string, boolean>>({});
  const loadedSchedules = useRef<Set<string>>(new Set());
  const loadedClients = useRef<Set<string>>(new Set());
  const CLIENTS_PER_PAGE = 5;

  const loadInterest = useCallback(async (clientCode: string) => {
    if (loadedClients.current.has(clientCode)) return;
    loadedClients.current.add(clientCode);
    try {
      const res  = await fetch(`/api/recon-interest?clientCode=${encodeURIComponent(clientCode)}`);
      const json = await res.json();
      if (json.ok && json.interestAmount > 0) {
        setInterestMap(prev => ({
          ...prev,
          [clientCode]: json.interestAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        }));
      }
    } catch { /* silent */ }
  }, []);

  const saveInterest = useCallback(async (clientCode: string, rawValue: string) => {
    const amount = parseFloat(rawValue.replace(/,/g, '')) || 0;
    setInterestSaving(prev => ({ ...prev, [clientCode]: true }));
    try {
      await fetch('/api/recon-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode,
          interestAmount: amount,
          updatedBy: userName || 'unknown',
        }),
      });
    } catch { /* silent */ } finally {
      setInterestSaving(prev => ({ ...prev, [clientCode]: false }));
    }
  }, [userName]);

  const loadSchedule = useCallback(async (clientCode: string) => {
    if (loadedSchedules.current.has(clientCode)) return;
    loadedSchedules.current.add(clientCode);
    try {
      const res  = await fetch(`/api/recon-schedule?clientCode=${encodeURIComponent(clientCode)}`);
      const json = await res.json();
      if (json.ok && json.rows && json.rows.length > 0) {
        const rows = json.rows.map((r: any) => ({
          id:                   r.id,
          scheduleDate:         r.scheduleDate ?? '',
          monthlyAmortization:  r.monthlyAmortization != null ? r.monthlyAmortization.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '',
          amount:               r.amount != null ? r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '',
          paymentDetails:       r.paymentDetails ?? '',
          eventId:              r.eventId ?? null,
          checkId:              r.checkId ?? null,
          editing:              false,
        }));
        setScheduleMap(prev => ({ ...prev, [clientCode]: rows }));
        setRightMode(prev => ({ ...prev, [clientCode]: 'schedule' }));
      } else if (json.ok && (!json.rows || json.rows.length === 0)) {
        setScheduleMap(prev => ({
          ...prev,
          [clientCode]: Array.from({ length: 6 }, (_, i) => ({
            id: `new-${i}`, scheduleDate: '', monthlyAmortization: '', amount: '', paymentDetails: '', eventId: null, checkId: null, editing: true,
          })),
        }));
      }
    } catch { /* silent */ }
  }, []);

  const saveSchedule = useCallback(async (clientCode: string, rows: ScheduleRowUI[]) => {
    setScheduleSaving(prev => ({ ...prev, [clientCode]: true }));
    try {
      await fetch('/api/recon-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode,
          rows: rows.map((r, i) => ({
            id:                   r.id.startsWith('new-') ? undefined : r.id,
            scheduleDate:         r.scheduleDate || null,
            monthlyAmortization:  parseFloat(r.monthlyAmortization.replace(/,/g, '')) || null,
            amount:               parseFloat(r.amount.replace(/,/g, '')) || null,
            paymentDetails:       r.paymentDetails || null,
            sortOrder:            i,
            eventId:              r.eventId ?? null,
            checkId:              r.checkId ?? null,
          })),
          updatedBy: userName || 'unknown',
        }),
      });
    } catch { /* silent */ } finally {
      setScheduleSaving(prev => ({ ...prev, [clientCode]: false }));
    }
  }, [userName]);

  const allRecon = useMemo(() => {
    if (!data) return [];
    const clientMap = new Map(data.CLIENTS.map(c => [c.code, c]));
    const branchMap = new Map(data.BRANCHES.map(b => [b.id, b.name]));
    const eventsMap = groupSortedEvents(data.EVENTS);

    return data.CHECKS
      .filter(c => {
        const meta = data.CHECKS_META?.[c.id];
        const status = meta?.status ?? c.finalStatus ?? 'OPEN';
        if (dateFrom && c.checkDate && c.checkDate < dateFrom) return false;
        if (dateTo   && c.checkDate && c.checkDate > dateTo)   return false;
        if (c.finalStatus === 'RECON REPLACED' || c.finalStatus === 'RECON REPLACEMENT') return true;
        if (status === 'RECON REPLACED' || status === 'RECON REPLACEMENT') return true;
        const evs = eventsMap.get(c.id) ?? [];
        return evs.some(e => e.type === 'RECONSTRUCT');
      })
      .map(c => {
        const cl = clientMap.get(c.client);
        const meta = data.CHECKS_META?.[c.id];
        let status = meta?.status ?? c.finalStatus ?? 'OPEN';
        let nextDeposit: string | null = meta?.nextDeposit ?? null;

        if (!meta && data.EVENTS.length > 0) {
          const evs = eventsMap.get(c.id) ?? [];
          const computed = computeCheckStatus(c, evs);
          status = computed.status;
          for (let j = evs.length - 1; j >= 0; j--) {
            if ((evs[j].type === 'HOLD_REQUEST' || evs[j].type === 'RECONSTRUCT') && evs[j].moveDate) {
              nextDeposit = evs[j].moveDate;
              break;
            }
            if (evs[j].type === 'RETURN' || evs[j].type === 'DEPOSIT_CLEARED') break;
          }
        }

        const evs = eventsMap.get(c.id) ?? [];
        let balance: number;
        if (status === 'CLEARED') {
          balance = 0;
        } else if (meta?.balance !== undefined && meta?.balance !== null) {
          balance = meta.balance;
        } else {
          const totalPaid = evs
            .filter(e => e.type === 'PARTIAL_PAYMENT' || e.type === 'SETTLED_PAID')
            .reduce((s, e) => s + (e.amount ?? 0), 0);
          balance = Math.max(0, Math.round((c.originalAmount - totalPaid) * 100) / 100);
        }

        return {
          ...c,
          status,
          nextDeposit,
          balance,
          clientName: cl?.name ?? c.client,
          branchName: branchMap.get(c.branch) ?? c.branch,
        };
      });
  }, [data, dateFrom, dateTo]);

  const clientGroups = useMemo(() => {
    const map = new Map<string, { code: string; name: string; branch: string; subsidiary: string | null; ae: string | null; replaced: typeof allRecon; replacement: typeof allRecon }>();
    for (const c of allRecon) {
      if (!map.has(c.client)) {
        map.set(c.client, {
          code: c.client,
          name: c.clientName,
          branch: c.branchName,
          subsidiary: c.subsidiary,
          ae: c.ae,
          replaced: [],
          replacement: [],
        });
      }
      const group = map.get(c.client)!;
      const isReplacementCheck = c.status === 'RECON REPLACEMENT' || c.finalStatus === 'RECON REPLACEMENT';
      if (!isReplacementCheck) group.replaced.push(c);
      else group.replacement.push(c);
    }
    for (const g of map.values()) {
      g.replaced.sort((a, b) => (a.checkDate ?? '').localeCompare(b.checkDate ?? ''));
      g.replacement.sort((a, b) => (a.checkDate ?? '').localeCompare(b.checkDate ?? ''));
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allRecon]);

  const activeClient = selectedClient
    ? clientGroups.find(g => g.code === selectedClient) ?? null
    : null;

  const th = 'px-3 py-2 text-xs font-bold text-gray-600 whitespace-nowrap border border-gray-200 bg-gray-50';
  const td = 'px-3 py-2 text-xs border border-gray-100 whitespace-nowrap';

  const visibleGroups = selectedClient === null
    ? clientGroups.slice((page - 1) * CLIENTS_PER_PAGE, page * CLIENTS_PER_PAGE)
    : [activeClient].filter(Boolean);
  const totalPages = selectedClient === null ? Math.max(1, Math.ceil(clientGroups.length / CLIENTS_PER_PAGE)) : 1;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reconstruct Report</h1>
          <p className="text-sm text-gray-500">Grouped by client — select a client to view their reconstruct details.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {clientGroups.length > 0 && (
            <button
              onClick={async () => {
                const groupsToSOA = selectedClient === null
                  ? clientGroups.slice((page - 1) * CLIENTS_PER_PAGE, page * CLIENTS_PER_PAGE)
                  : clientGroups.filter(g => g.code === selectedClient);
                const signerName = userName || 'Accounts Receivable';
                const allChecks = groupsToSOA.flatMap(g => [...g.replaced, ...g.replacement]);
                const isAllAPSI = allChecks.length > 0 && allChecks.every(c => c.subsidiary === 'APSI');
                await generateSOA({
                  checks: allChecks.map(c => ({
                    id: c.id,
                    client: c.client,
                    clientName: c.clientName,
                    bank: c.bank,
                    checkNo: c.checkNo,
                    checkDate: c.checkDate,
                    originalAmount: c.originalAmount,
                    balance: c.balance ?? c.originalAmount,
                    totalPaid: 0,
                    status: c.status,
                    reason: null,
                    branchName: c.branchName,
                    paymentDetails: c.paymentFor ?? '',
                  })),
                  preparedBy: signerName,
                  template: isAllAPSI ? 'APSI' : 'ES',
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
            >
              📄 Export SOA
            </button>
          )}
          <button
            onClick={() => {
              const groupsToExport = selectedClient === null
                ? clientGroups
                : clientGroups.filter(g => g.code === selectedClient);
              exportReconstructExcel(
                groupsToExport.map(g => ({
                  name:        g.name,
                  branch:      g.branch,
                  subsidiary:  g.subsidiary,
                  ae:          g.ae,
                  replaced:    g.replaced.map(c => ({ bank: c.bank, checkNo: c.checkNo, checkDate: c.checkDate, originalAmount: c.originalAmount })),
                  replacement: g.replacement.map(c => ({ bank: c.bank, checkNo: c.checkNo, checkDate: c.checkDate, originalAmount: c.originalAmount, nextDeposit: c.nextDeposit })),
                })),
                selectedClient
                  ? `Reconstruct_${clientGroups.find(g => g.code === selectedClient)?.name ?? 'Client'}_${todayISO()}.xlsx`
                  : `Reconstruct_Report_All_${todayISO()}.xlsx`,
              );
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 transition-colors"
          >
            📥 Export Excel {selectedClient === null ? `(All ${clientGroups.length} clients)` : '(This client)'}
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <span className="text-[11px] font-bold text-gray-500 uppercase">Check Date</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-600" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-600" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline">
            Clear
          </button>
        )}
      </div>

      {/* Client selector dropdown */}
      {clientGroups.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Client</label>
          <select
            value={selectedClient ?? '__all__'}
            onChange={e => { setSelectedClient(e.target.value === '__all__' ? null : e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 min-w-[280px]"
          >
            <option value="__all__">All Clients ({clientGroups.length})</option>
            {clientGroups.map(g => (
              <option key={g.code} value={g.code}>
                {g.name} ({g.replaced.length + g.replacement.length})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Side by side tables */}
      {visibleGroups.map(group => group && (
        <div key={group.code} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-4 mb-4">
          {/* Client info header */}
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Client</span>
              <span className="text-sm font-bold text-gray-900">{group.name}</span>
            </div>
            {group.subsidiary && (
              <span className="bg-indigo-100 text-indigo-700 rounded px-2 py-0.5 text-[11px] font-semibold">{group.subsidiary}</span>
            )}
            <span className="text-xs text-gray-500">{group.branch}</span>
            {group.ae && <span className="text-xs text-gray-500">AE: {group.ae}</span>}
            <span className="text-xs text-gray-400 ml-auto">
              {group.replaced.length} replaced · {group.replacement.length} replacement
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto">
            {/* LEFT: RECONSTRUCT BALANCE */}
            <div className="flex-1 min-w-[460px]">
              <div className="text-center text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 rounded-t-lg py-1.5">
                RECONSTRUCT BALANCE
              </div>
              <div className="overflow-y-auto max-h-[400px] border border-t-0 border-gray-200 rounded-b-lg">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0">
                    <tr>
                      <th className={th}>CHECK Number</th>
                      <th className={th}>DATE</th>
                      <th className={th + ' text-right'}>ORIGINAL AMOUNT</th>
                      <th className={th + ' text-right'}>BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.replaced.map(c => (
                      <tr key={c.id} className="hover:bg-violet-50/40">
                        <td className={td + ' font-mono font-semibold text-gray-800'}>{c.bank}-{c.checkNo}</td>
                        <td className={td + ' text-gray-600'}>{c.checkDate ? new Date(c.checkDate + 'T00:00:00').toLocaleDateString('en-US') : '—'}</td>
                        <td className={td + ' text-right font-mono text-gray-700'}>{c.originalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td className={td + ' text-right font-mono text-gray-700'}>{group.replacement.length > 0 ? '0.00' : (c.balance ?? c.originalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {group.replaced.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400 italic text-xs">No RECON REPLACED checks</td></tr>
                    )}
                  </tbody>
                  {group.replaced.length > 0 && (() => {
                    loadInterest(group.code);
                    if (group.replacement.length === 0) loadSchedule(group.code);
                    const total = group.replaced.reduce((s, c) => s + c.originalAmount, 0);
                    const balanceSum = group.replacement.length > 0 ? 0 : group.replaced.reduce((s, c) => s + (c.balance ?? c.originalAmount), 0);
                    const interestStr = interestMap[group.code] ?? '';
                    const interestVal = parseFloat(interestStr.replace(/,/g, '')) || 0;
                    const grandTotal = total + interestVal;
                    const grandBalanceTotal = balanceSum + interestVal;
                    const isEditing = editingInterest === group.code;
                    return (
                      <tfoot className="sticky bottom-0">
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={2} className={td + ' font-bold text-gray-700 text-right'}>Total</td>
                          <td className={td + ' text-right font-mono font-bold text-gray-900'}>
                            {total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={td + ' text-right font-mono font-bold text-gray-900'}>
                            {balanceSum.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr className="bg-amber-50 border-t border-amber-100">
                          <td colSpan={2} className={td + ' font-semibold text-amber-700 text-right'}>
                            Interest{interestSaving[group.code] ? ' 💾' : ''}
                          </td>
                          <td className={td + ' text-right font-mono text-amber-700'}>
                            {(interestVal > 0 && !isEditing) ? (
                              <span
                                onClick={() => setEditingInterest(group.code)}
                                className="cursor-pointer hover:bg-amber-100 rounded px-2 py-1 inline-block"
                                title="Click to edit"
                              >
                                {interestVal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <input
                                type="text"
                                autoFocus={isEditing}
                                value={interestStr}
                                onChange={e => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  if (!/^\d*\.?\d*$/.test(raw)) return;
                                  const parts = raw.split('.');
                                  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                  const formatted = parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
                                  setInterestMap(prev => ({ ...prev, [group.code]: formatted }));
                                }}
                                onBlur={() => {
                                  const raw = (interestMap[group.code] ?? '').replace(/,/g, '');
                                  const num = parseFloat(raw);
                                  if (!isNaN(num) && num > 0) {
                                    setInterestMap(prev => ({ ...prev, [group.code]: num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
                                    saveInterest(group.code, raw);
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const raw = (interestMap[group.code] ?? '').replace(/,/g, '');
                                    const num = parseFloat(raw);
                                    if (!isNaN(num) && num > 0) {
                                      setInterestMap(prev => ({ ...prev, [group.code]: num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
                                      saveInterest(group.code, raw);
                                    } else {
                                      setInterestMap(prev => ({ ...prev, [group.code]: '' }));
                                      saveInterest(group.code, '0');
                                    }
                                    setEditingInterest(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                placeholder="0.00"
                                className="w-full text-right border border-amber-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 font-mono"
                              />
                            )}
                          </td>
                          <td className={td}></td>
                        </tr>
                        {interestVal > 0 && (
                          <tr className="bg-violet-50 border-t border-violet-200">
                            <td colSpan={2} className={td + ' font-bold text-violet-800 text-right'}>Grand Total</td>
                            <td className={td + ' text-right font-mono font-bold text-violet-900'}>
                              {grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={td + ' text-right font-mono font-bold text-violet-900'}>
                              {grandBalanceTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>

            {/* RIGHT: RECONSTRUCT PAYMENT / SCHEDULE toggle */}
            <div className="flex-1 min-w-[480px]">
              <div className="relative flex items-center justify-center bg-gray-100 border border-gray-200 rounded-t-lg px-3 py-1.5">
                <span className="text-xs font-bold text-gray-700">
                  {(group.replacement.length === 0 && (rightMode[group.code] ?? 'schedule') === 'schedule')
                    ? 'RECONSTRUCT PAYMENT SCHEDULE'
                    : 'RECONSTRUCT PAYMENT'}
                </span>
                {group.replacement.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = (rightMode[group.code] ?? 'schedule') === 'payment' ? 'schedule' : 'payment';
                      setRightMode(prev => ({ ...prev, [group.code]: next }));
                      if (next === 'schedule') loadSchedule(group.code);
                    }}
                    className="absolute right-2 text-[11px] font-semibold px-2 py-0.5 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    {(rightMode[group.code] ?? 'schedule') === 'payment' ? 'Switch to Schedule' : 'Switch to Payment'}
                  </button>
                )}
              </div>

              {(group.replacement.length > 0 || (rightMode[group.code] ?? 'schedule') === 'payment') ? (
                <div className="overflow-y-auto max-h-[400px] border border-t-0 border-gray-200 rounded-b-lg">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0">
                      <tr>
                        <th className={th}>CHECK Number</th>
                        <th className={th}>CHECK DATE</th>
                        <th className={th + ' text-right'}>ORIGINAL AMOUNT</th>
                        <th className={th + ' text-right'}>BALANCE</th>
                        <th className={th}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.replacement.map(c => (
                        <tr key={c.id} className="hover:bg-purple-50/40">
                          <td className={td + ' font-mono font-semibold text-gray-800'}>{c.bank}-{c.checkNo}</td>
                          <td className={td + ' text-gray-600'}>{c.checkDate ? new Date(c.checkDate + 'T00:00:00').toLocaleDateString('en-US') : '—'}</td>
                          <td className={td + ' text-right font-mono text-gray-700'}>{c.originalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          <td className={td + ' text-right font-mono text-gray-700'}>
                            {(c.balance ?? c.originalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={td}>
                            <StatusBadge status={c.status ?? c.finalStatus ?? 'OPEN'} />
                          </td>
                        </tr>
                      ))}
                      {group.replacement.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic text-xs">No RECON REPLACEMENT checks</td></tr>
                      )}
                    </tbody>
                    {group.replacement.length > 0 && (
                      <tfoot className="sticky bottom-0">
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={2} className={td + ' font-bold text-gray-700 text-right'}>Total</td>
                          <td className={td + ' text-right font-mono font-bold text-gray-900'}>
                            {group.replacement.reduce((s, c) => s + c.originalAmount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={td + ' text-right font-mono font-bold text-gray-900'}>
                            {group.replacement.reduce((s, c) => s + (c.balance ?? c.originalAmount), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={td}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                (() => {
                  const sRows = scheduleMap[group.code] ?? Array.from({ length: 6 }, (_, i) => ({ id: `new-${i}`, scheduleDate: '', monthlyAmortization: '', amount: '', paymentDetails: '', eventId: null, checkId: null, editing: true }));
                  const sorted = [...sRows].sort((a, b) => {
                    if (!a.scheduleDate) return 1;
                    if (!b.scheduleDate) return -1;
                    return a.scheduleDate.localeCompare(b.scheduleDate);
                  });
                  const totalPayment = sorted.reduce((s, r) => s + (parseFloat(r.amount.replace(/,/g, '')) || 0), 0);
                  const leftBalanceSum = group.replaced.reduce((s, c) => s + (c.balance ?? c.originalAmount), 0);
                  const interestVal = parseFloat((interestMap[group.code] ?? '').replace(/,/g, '')) || 0;
                  const outstandingBalance = leftBalanceSum + interestVal;

                  const updateRow = (id: string, field: 'scheduleDate' | 'monthlyAmortization' | 'amount' | 'paymentDetails', val: string) => {
                    const updated = sRows.map(r => r.id === id ? { ...r, [field]: val } : r);
                    setScheduleMap(prev => ({ ...prev, [group.code]: updated }));
                  };

                  const addRow = () => {
                    const updated = [...sRows, { id: `new-${Date.now()}`, scheduleDate: '', monthlyAmortization: '', amount: '', paymentDetails: '', eventId: null, checkId: null, editing: true }];
                    setScheduleMap(prev => ({ ...prev, [group.code]: updated }));
                  };

                  return (
                    <div className="overflow-y-auto max-h-[400px] border border-t-0 border-gray-200 rounded-b-lg">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0">
                          <tr>
                            <th className={th + ' w-6'}></th>
                            <th className={th}>Date</th>
                            <th className={th + ' text-right'}>M/A</th>
                            <th className={th + ' text-right'}>Amount</th>
                            <th className={th}>Payment Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map(r => {
                            const startEdit = () => {
                              if (!r.editing) {
                                setScheduleMap(prev => ({
                                  ...prev,
                                  [group.code]: (prev[group.code] ?? []).map(row => row.id === r.id ? { ...row, editing: true } : row),
                                }));
                              }
                            };
                            const fmtDisp = (v: string) => {
                              const n = parseFloat(String(v).replace(/,/g, ''));
                              return isNaN(n) ? '' : n.toLocaleString('en-PH', { minimumFractionDigits: 2 });
                            };
                            const fmtDateDisp = (d: string) =>
                              d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US') : '';
                            return (
                            <tr key={r.id} className="hover:bg-indigo-50/30">
                              <td className={td + ' text-center'}>
                                <input type="checkbox" className="accent-blue-700" />
                              </td>
                              {/* Date */}
                              <td className={td}>
                                {r.editing ? (
                                  <input
                                    type="date"
                                    value={r.scheduleDate}
                                    autoFocus
                                    onChange={e => { updateRow(r.id, 'scheduleDate', e.target.value); saveSchedule(group.code, sRows.map(row => row.id === r.id ? { ...row, scheduleDate: e.target.value } : row)); }}
                                    className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-blue-500 font-mono"
                                  />
                                ) : (
                                  <span onClick={startEdit} className="cursor-pointer font-mono block min-w-[70px] py-0.5">
                                    {fmtDateDisp(r.scheduleDate) || <span className="text-gray-300">—</span>}
                                  </span>
                                )}
                              </td>
                              {/* Monthly amortization */}
                              <td className={td + ' text-right font-mono font-semibold text-blue-700'}>
                                {r.editing ? (
                                  <input
                                    type="text"
                                    value={r.monthlyAmortization}
                                    placeholder="0.00"
                                    onChange={e => updateRow(r.id, 'monthlyAmortization', e.target.value)}
                                    onBlur={() => saveSchedule(group.code, sRows)}
                                    className="w-24 text-right border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-blue-500 font-mono text-blue-700 font-semibold"
                                  />
                                ) : (
                                  <span onClick={startEdit} className="cursor-pointer block py-0.5">
                                    {fmtDisp(r.monthlyAmortization) || <span className="text-gray-300">—</span>}
                                  </span>
                                )}
                              </td>
                              {/* Amount */}
                              <td className={td + ' text-right font-mono font-semibold text-gray-800'}>
                                {r.editing ? (
                                  <input
                                    type="text"
                                    value={r.amount}
                                    placeholder="0.00"
                                    onChange={e => updateRow(r.id, 'amount', e.target.value)}
                                    onBlur={() => saveSchedule(group.code, sRows)}
                                    className="w-24 text-right border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-blue-500 font-mono"
                                  />
                                ) : (
                                  <span onClick={startEdit} className="cursor-pointer block py-0.5">
                                    {fmtDisp(r.amount) || <span className="text-gray-400">DUE</span>}
                                  </span>
                                )}
                              </td>
                              {/* Payment details */}
                              <td className={td}>
                                {r.editing ? (
                                  <input
                                    type="text"
                                    value={r.paymentDetails}
                                    placeholder="Payment details…"
                                    onChange={e => updateRow(r.id, 'paymentDetails', e.target.value)}
                                    onBlur={() => saveSchedule(group.code, sRows)}
                                    className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                                  />
                                ) : (
                                  <span onClick={startEdit} className="cursor-pointer block py-0.5">
                                    {r.paymentDetails || <span className="text-gray-400">DUE</span>}
                                  </span>
                                )}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td colSpan={5} className="px-3 py-1.5 text-left">
                              <button onClick={addRow} className="text-xs text-blue-600 hover:underline font-semibold">+ Add row</button>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={3} className={td + ' font-bold text-gray-700 text-left'}>Total Payment</td>
                            <td className={td + ' text-right font-mono font-bold text-gray-900'}>
                              {totalPayment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={td} />
                          </tr>
                          <tr className="bg-indigo-50 border-t border-indigo-100">
                            <td colSpan={3} className={td + ' font-bold text-indigo-900 text-left'}>Outstanding Balance</td>
                            <td className={td + ' text-right font-mono font-bold text-indigo-900'}>
                              {outstandingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={td} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Client attachments */}
          <ClientAttachmentsPanel
            clientCode={group.code}
            clientName={group.name}
            canUpload={canCreate(perms)}
          />
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
          <span>Page {page} of {totalPages} ({clientGroups.length} clients)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40">
              ← Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
