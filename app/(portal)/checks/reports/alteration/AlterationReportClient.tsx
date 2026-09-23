'use client';
/**
 * AlterationReportClient — all checks flagged with ALTERATION events,
 * filterable by recorded date. Row click → CheckDetailModal.
 *
 * Ported from esprint-check-monitoring/app/reports/alteration/page.tsx.
 */
import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import CheckDetailModal from '@/modules/checks/components/CheckDetailModal';
import { useStickyScrollbar } from '@/modules/checks/hooks/useStickyScrollbar';
import { fmtPHP, fmtDate, todayISO } from '@/modules/checks/lib/format';
import type { CheckPerms } from '@/modules/checks/lib/permissions';

interface AltRow {
  id:        string;
  evId:      string;
  branch:    string;
  client:    string;
  bank:      string;
  checkDate: string | null;
  original:  number;
  balance:   number;
  aging:     number | null;
  reason:    string;
  recordedBy:string;
  recordedAt:string;
}

const EXPORT_COLUMNS = [
  { key:'branch',     label:'Branch' },
  { key:'client',     label:'Client' },
  { key:'bank',       label:'Bank / Check #' },
  { key:'checkDate',  label:'Check Date' },
  { key:'original',   label:'Original Amount' },
  { key:'balance',    label:'Balance' },
  { key:'aging',      label:'Aging (days)' },
  { key:'reason',     label:'Reason' },
  { key:'recordedBy', label:'Recorded By' },
  { key:'recordedAt', label:'Recorded At' },
];

function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10);
}
function startOfMonth() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

interface Props {
  initialRows: AltRow[];
  userEmail:   string;
  userName:    string;
  perms:       CheckPerms;
}

export function AlterationReportClient({ initialRows, userEmail, userName, perms }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  useStickyScrollbar(scrollRef);

  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo,   setDateTo]     = useState('');
  const [selectedCheckId, setSelectedCheckId] = useState<string|null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportCols, setExportCols] = useState<Set<string>>(new Set(EXPORT_COLUMNS.map(c=>c.key)));

  function setQuick(preset: 'today'|'week'|'month') {
    const today = todayISO();
    if (preset==='today') { setDateFrom(today); setDateTo(today); }
    if (preset==='week')  { setDateFrom(startOfWeek()); setDateTo(today); }
    if (preset==='month') { setDateFrom(startOfMonth()); setDateTo(today); }
  }

  const rows = useMemo(() => {
    return initialRows.filter(r => {
      const dt = r.recordedAt ? r.recordedAt.slice(0,10) : r.checkDate ?? '';
      if (dateFrom && dt < dateFrom) return false;
      if (dateTo   && dt > dateTo)   return false;
      return true;
    });
  }, [initialRows, dateFrom, dateTo]);

  function handleExport() {
    if (exportCols.size===0) return;
    const activeCols = EXPORT_COLUMNS.filter(c=>exportCols.has(c.key));
    const escape = (v: unknown) => { const s=String(v??''); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
    const csv = [
      activeCols.map(c=>escape(c.label)).join(','),
      ...rows.map(r => activeCols.map(col => {
        const key = col.key as keyof AltRow;
        const val = r[key];
        if (col.key==='checkDate') return escape(fmtDate(val as string));
        if (col.key==='original'||col.key==='balance') return escape(val??0);
        if (col.key==='aging') return escape(val!=null?val:'');
        if (col.key==='recordedAt') return escape(val?(val as string).slice(0,16).replace('T',' '):'');
        return escape(val??'');
      }).join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`alteration-report-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url); setShowExport(false);
  }

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600';

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alteration Report</h1>
          <p className="text-sm text-gray-500">All checks flagged with Alteration events, filtered by recorded date.</p>
        </div>
        {rows.length>0 && (
          <button onClick={()=>setShowExport(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50">
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className={sel} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className={sel} />
        </div>
        <div className="flex gap-1.5">
          <button onClick={()=>setQuick('today')}  className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-gray-700">Today</button>
          <button onClick={()=>setQuick('week')}   className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-gray-700">This Week</button>
          <button onClick={()=>setQuick('month')}  className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-gray-700">This Month</button>
        </div>
        {(dateFrom||dateTo) && (
          <button onClick={()=>{setDateFrom('');setDateTo('');}} className="text-xs text-gray-400 hover:text-gray-600 ml-1">✕ Clear</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{rows.length} record{rows.length!==1?'s':''}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full min-w-max text-sm border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                {['BRANCH','CLIENT','BANK / CHECK #','CHECK DATE','ORIGINAL','ALTERATION DETAILS','BALANCE','AGING'].map(h=>(
                  <th key={h} className={`px-3 py-2.5 font-semibold text-gray-700 border border-gray-200 ${h==='ORIGINAL'||h==='BALANCE'||h==='AGING'?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length===0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400 italic border border-gray-200">No alteration records found for the selected date range.</td></tr>
              ) : rows.map(r=>(
                <tr key={r.evId} onClick={()=>setSelectedCheckId(r.id)} className="hover:bg-blue-50/30 cursor-pointer">
                  <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200">{r.branch}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 font-medium border border-gray-200">{r.client}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200">{r.bank}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 border border-gray-200">{fmtDate(r.checkDate)}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 text-right font-mono border border-gray-200">{fmtPHP(r.original)}</td>
                  <td className="px-3 py-2 text-xs text-orange-700 font-medium border border-gray-200">{r.reason||'—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 text-right font-mono border border-gray-200">{fmtPHP(r.balance)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 text-right border border-gray-200">{r.aging!=null?`${r.aging}d`:'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check Detail Modal */}
      {selectedCheckId && (
        <CheckDetailModal
          checkId={selectedCheckId}
          perms={perms}
          userEmail={userEmail}
          userName={userName}
          onClose={()=>setSelectedCheckId(null)}
          onSaved={()=>{setSelectedCheckId(null);router.refresh();}}
          readOnly
        />
      )}

      {/* Export column picker */}
      {showExport && typeof document!=='undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={()=>setShowExport(false)}>
          <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] w-full max-w-sm"
            onClick={e=>e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Export CSV — Select Columns</h2>
              <button onClick={()=>setShowExport(false)} className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 text-lg leading-none">×</button>
            </div>
            <div className="p-5 space-y-2">
              <div className="flex justify-between mb-3">
                <button onClick={()=>setExportCols(new Set(EXPORT_COLUMNS.map(c=>c.key)))} className="text-xs text-blue-600 hover:underline">Select All</button>
                <button onClick={()=>setExportCols(new Set())} className="text-xs text-gray-400 hover:underline">Deselect All</button>
              </div>
              {EXPORT_COLUMNS.map(col=>(
                <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-blue-50 rounded px-2 py-1">
                  <input type="checkbox" checked={exportCols.has(col.key)} onChange={()=>{const n=new Set(exportCols);n.has(col.key)?n.delete(col.key):n.add(col.key);setExportCols(n);}} className="accent-blue-700" />
                  {col.label}
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={()=>setShowExport(false)} className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={handleExport} disabled={exportCols.size===0}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1e3a8a] text-white hover:bg-blue-700 disabled:opacity-40">
                Download ({exportCols.size} columns)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
