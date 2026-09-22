'use client';
/**
 * AllChecksTable — full interactive checks table.
 *
 * Ported from esprint-check-monitoring/app/checks/page.tsx.
 * - All filters: Subsidiary, BranchMultiSelect, Client datalist, AE datalist,
 *   Date range, StatusMultiSelect, Payment For, free text search.
 * - Column picker (show/hide) + column resize + sticky scrollbar.
 * - Row selection checkboxes for Notice / SOA / Reconstruct bulk actions.
 * - Per-row Notes button with count badge.
 * - Row click → CheckDetailModal.
 * - + New Check button (canCreate guard).
 * - Top + bottom pagination.
 * - Load full history button.
 * - Total balance display.
 *
 * Data: passed as props from the server page (serverLoad → enrichChecks).
 * Writes call API routes → router.refresh() reloads the page.
 */

import {
  useState, useMemo, useCallback, useEffect, useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import StatusBadge from './StatusBadge';
import CheckModal from './CheckModal';
import CheckDetailModal from './CheckDetailModal';
import CheckNotesModal from './CheckNotesModal';
import ExportCsvModal from './ExportCsvModal';
import ReconstructBulkModal, { type SelectedCheck } from './ReconstructBulkModal';
import { generateSOA } from '../lib/exportSOA';
import { fmtPHP, fmtDate, todayISO, STALE_DAYS, PAYMENT_FOR_OPTIONS } from '../lib/format';
import { canCreate, canSeeCheck, type CheckPerms } from '../lib/permissions';
import { computeCheckStatus, compareEvents, groupSortedEvents } from '../lib/computeStatus';
import { useColumnResize } from '../hooks/useColumnResize';
import { useStickyScrollbar } from '../hooks/useStickyScrollbar';
import type { AppData, Check } from '../lib/database.types';

// ── Status lists ──────────────────────────────────────────────────────────────
const OPEN_STATUSES   = ['OPEN','HELD','RETURNED','PARTIAL','ALTERATION','LEGAL','RECONSTRUCT'];
const CLOSED_STATUSES = ['CLEARED','DEPOSITED','SETTLED (PAID)','REPLACED','CANCELLED','RECON REPLACED','RECON REPLACEMENT'];
const ALL_STATUSES    = [...OPEN_STATUSES, ...CLOSED_STATUSES];
const STATUS_DISPLAY: Record<string,string> = { CANCELLED:'Write-off / Blacklist' };

const PAGE_SIZE = 50;
type SortKey = 'checkDate'|'originalAmount'|'checkNo'|'status'|'branch'|'clientName'|'nextDeposit'|'aging'|'balance';

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={handleCopy}
      style={{ padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:700,background:copied?'#15803d':'#1e3a8a',color:'#fff',border:'none',cursor:'pointer',minWidth:160 }}>
      {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
    </button>
  );
}

// ── StatusMultiSelect ─────────────────────────────────────────────────────────
function StatusMultiSelect({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<'open'|'closed'|null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function toggle(s: string) { const n = new Set(selected); n.has(s)?n.delete(s):n.add(s); onChange(n); }
  function selectGroup(g: 'open'|'closed') { const ss = g==='open'?OPEN_STATUSES:CLOSED_STATUSES; onChange(new Set(ss)); setExpandedGroup(g); }
  function uncheckGroup(g: 'open'|'closed') { const ss = g==='open'?OPEN_STATUSES:CLOSED_STATUSES; const n=new Set(selected); ss.forEach(s=>n.delete(s)); onChange(n); }

  const openCount   = OPEN_STATUSES.filter(s=>selected.has(s)).length;
  const closedCount = CLOSED_STATUSES.filter(s=>selected.has(s)).length;
  const isAllOpen   = OPEN_STATUSES.every(s=>selected.has(s));
  const isAllClosed = CLOSED_STATUSES.every(s=>selected.has(s));

  let label = 'All';
  if (selected.size > 0) {
    if (ALL_STATUSES.every(s=>selected.has(s))) { label = 'All statuses'; }
    else {
      const parts: string[] = [];
      if (isAllOpen) parts.push('Open (all)'); else if (openCount>0) parts.push(`Open (${openCount})`);
      if (isAllClosed) parts.push('Closed (all)'); else if (closedCount>0) parts.push(`Closed (${closedCount})`);
      label = parts.join(', ') || 'All';
    }
  }

  const selCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600';
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o=>!o)} className={selCls+' w-full text-left flex items-center justify-between gap-1 truncate'} title={selected.size===0?'All':[...selected].join(', ')}>
        <span className="truncate text-gray-700">{label}</span><span className="text-gray-400 shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-[240px] bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          <div className="px-3 py-1.5 flex justify-between border-b border-gray-100">
            <button type="button" className="text-xs text-blue-600 hover:underline font-semibold" onClick={() => { onChange(new Set(ALL_STATUSES)); setExpandedGroup(null); }}>Select all</button>
            <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { onChange(new Set()); setExpandedGroup(null); }}>Clear all</button>
          </div>
          {/* Open group */}
          <div className="border-b border-gray-100">
            <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-50" onClick={() => selectGroup('open')}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={openCount>0} readOnly className="accent-blue-700 pointer-events-none" style={{ opacity:openCount>0&&!isAllOpen?0.5:1 }} />
                <span className="text-sm font-semibold text-gray-800">Open</span>
                {openCount>0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{openCount}</span>}
              </div>
              <span className="text-gray-400 text-xs">{expandedGroup==='open'?'▴':'▾'}</span>
            </div>
            {expandedGroup==='open' && (
              <div className="pl-4 pr-3 pb-2 space-y-0.5">
                {OPEN_STATUSES.map(s=>(
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700">
                    <input type="checkbox" checked={selected.has(s)} onChange={() => toggle(s)} className="accent-blue-700" />
                    {s==='OPEN'?'In-progress':(STATUS_DISPLAY[s]??(s.charAt(0)+s.slice(1).toLowerCase()))}
                  </label>
                ))}
                {openCount>0 && <button type="button" className="text-[11px] text-red-500 hover:underline ml-2 mt-1" onClick={e=>{e.stopPropagation();uncheckGroup('open');}}>Uncheck all Open</button>}
              </div>
            )}
          </div>
          {/* Closed group */}
          <div>
            <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-green-50" onClick={() => selectGroup('closed')}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={closedCount>0} readOnly className="accent-green-700 pointer-events-none" style={{ opacity:closedCount>0&&!isAllClosed?0.5:1 }} />
                <span className="text-sm font-semibold text-gray-800">Closed</span>
                {closedCount>0 && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">{closedCount}</span>}
              </div>
              <span className="text-gray-400 text-xs">{expandedGroup==='closed'?'▴':'▾'}</span>
            </div>
            {expandedGroup==='closed' && (
              <div className="pl-4 pr-3 pb-2 space-y-0.5">
                {CLOSED_STATUSES.map(s=>(
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 hover:bg-green-50 cursor-pointer rounded text-sm text-gray-700">
                    <input type="checkbox" checked={selected.has(s)} onChange={() => toggle(s)} className="accent-green-700" />
                    {STATUS_DISPLAY[s]??(s==='SETTLED (PAID)'?'Settled (Paid)':s.charAt(0)+s.slice(1).toLowerCase())}
                  </label>
                ))}
                {closedCount>0 && <button type="button" className="text-[11px] text-red-500 hover:underline ml-2 mt-1" onClick={e=>{e.stopPropagation();uncheckGroup('closed');}}>Uncheck all Closed</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BranchMultiSelect ─────────────────────────────────────────────────────────
function BranchMultiSelect({ branches, selected, onChange }: { branches:{id:string;name:string}[]; selected:Set<string>; onChange:(s:Set<string>)=>void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  function toggle(id: string) { const n=new Set(selected); n.has(id)?n.delete(id):n.add(id); onChange(n); }
  const label = selected.size===0?'All my branches':selected.size===1?(branches.find(b=>selected.has(b.id))?.name??'1 branch'):`${selected.size} branches`;
  const selCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600';
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o=>!o)} className={selCls+' w-full text-left flex items-center justify-between gap-1 truncate'}>
        <span className="truncate text-gray-700">{label}</span><span className="text-gray-400 shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-52 overflow-y-auto">
          <div className="px-3 py-1 flex justify-end">
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => onChange(new Set())}>Clear all</button>
          </div>
          {branches.map(b=>(
            <label key={b.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="accent-blue-700" />
              {b.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  initialData: AppData;
  perms:       CheckPerms;
  userEmail:   string;
  userName:    string;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AllChecksTable({ initialData, perms, userEmail, userName }: Props) {
  const router     = useRouter();
  const tableRef   = useRef<HTMLTableElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const { startResize, syncCols, resetCols } = useColumnResize(tableRef, 'col-widths-checks');
  useStickyScrollbar(scrollRef);

  const [data, setData]   = useState<AppData>(initialData);
  const [loading, setLoading] = useState(false);

  // Reload data from server
  const reload = useCallback(async (full = false) => {
    setLoading(true);
    try {
      const res  = await fetch(full ? '/api/checks/load?full=1' : '/api/checks/load');
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch {}
    setLoading(false);
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterSub,         setFilterSub]         = useState('');
  const [filterBranches,    setFilterBranches]     = useState<Set<string>>(new Set());
  const [filterClientInput, setFilterClientInput]  = useState('');
  const [filterClient,      setFilterClient]       = useState('');
  const [filterPayFor,      setFilterPayFor]       = useState('');
  const [filterAE,          setFilterAE]           = useState('');
  const [selectedStatuses,  setSelectedStatuses]   = useState<Set<string>>(new Set());
  const [filterStale,       setFilterStale]        = useState(false);
  const [search,            setSearch]             = useState('');
  const [dateFrom,          setDateFrom]           = useState('');
  const [dateTo,            setDateTo]             = useState('');
  const [page,              setPage]               = useState(1);
  const [sortKey,           setSortKey]            = useState<SortKey>('checkDate');
  const [sortDir,           setSortDir]            = useState<'asc'|'desc'>('desc');
  const [filtersCollapsed,  setFiltersCollapsed]   = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('checks-filters-collapsed') === '1';
  });
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('checks-filters-collapsed', filtersCollapsed?'1':'0'); }, [filtersCollapsed]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showModal,          setShowModal]          = useState(false);
  const [selectedCheckId,    setSelectedCheckId]    = useState<string|null>(null);
  const [selectedForNotice,  setSelectedForNotice]  = useState<Set<string>>(new Set());
  const [showNoticeModal,    setShowNoticeModal]     = useState(false);
  const [notesCheckId,       setNotesCheckId]       = useState<string|null>(null);
  const [notesCounts,        setNotesCounts]        = useState<Record<string,number>>({});
  const [recentlyCreatedId,  setRecentlyCreatedId]  = useState<string|null>(null);
  const [showCsvExport,      setShowCsvExport]      = useState(false);
  const [showReconstructModal, setShowReconstructModal] = useState(false);

  // Seed notes counts from data
  useEffect(() => { if (data?.NOTES_COUNTS) setNotesCounts(data.NOTES_COUNTS); }, [data?.NOTES_COUNTS]);

  // ── Column visibility ─────────────────────────────────────────────────────
  const ALL_COLS = ['SUBSIDIARY','BRANCH','CLIENT','AE','BANK / CHECK #','CHECK DATE','ORIGINAL ₱','BALANCE ₱','NEXT DEPOSIT','AGING','STATUS','REASON','NOTES','PAYMENT FOR','PAYMENT DE…'] as const;
  type ColName = typeof ALL_COLS[number];
  const [hiddenCols, setHiddenCols] = useState<Set<ColName>>(() => {
    try {
      const saved = localStorage.getItem('checks-hidden-cols');
      const base = saved ? new Set(JSON.parse(saved) as ColName[]) : new Set<ColName>();
      base.delete('NOTES');
      return base;
    } catch {}
    return new Set<ColName>();
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  function toggleCol(col: ColName) {
    setHiddenCols(prev => {
      const next = new Set(prev); next.has(col)?next.delete(col):next.add(col);
      try { localStorage.setItem('checks-hidden-cols', JSON.stringify([...next])); } catch {}
      return next;
    });
    setTimeout(syncCols, 50);
  }
  const vis  = (col: ColName) => !hiddenCols.has(col);
  const colIdx = (col: ColName) => { let pos=1; for (const c of ALL_COLS) { if (c===col) return pos; if (!hiddenCols.has(c)) pos++; } return pos; };

  const userCanCreate = canCreate(perms);

  // ── Subsidiary → branch map ───────────────────────────────────────────────
  const subsidiaryBranches = useMemo<Record<string,string[]>>(() => {
    const map: Record<string,string[]> = {};
    for (const b of data.BRANCHES) { if (b.subsidiary) (map[b.subsidiary]??=[]).push(b.id); }
    return map;
  }, [data.BRANCHES]);

  const visibleBranches = useMemo(() => {
    const acc = perms.branches.length===0||perms.branches.includes('ALL')
      ? data.BRANCHES
      : data.BRANCHES.filter(b=>perms.branches.includes(b.id));
    if (!filterSub) return acc;
    const allowed = subsidiaryBranches[filterSub]??[];
    return acc.filter(b=>allowed.includes(b.id));
  }, [data.BRANCHES, filterSub, subsidiaryBranches, perms.branches]);

  // ── Client datalist ───────────────────────────────────────────────────────
  const clientDatalistOptions = useMemo(() => {
    const branchMap = new Map(data.BRANCHES.map(b=>[b.id,b.name]));
    const allowedBranches = filterBranches.size>0 ? filterBranches : filterSub ? new Set(subsidiaryBranches[filterSub]??[]) : null;
    return data.CLIENTS.filter(c => {
      if (allowedBranches && !allowedBranches.has(c.branch)) return false;
      if (filterAE && !(c.ae??'').toLowerCase().includes(filterAE.toLowerCase())) return false;
      return true;
    }).map(c => {
      const branchName = branchMap.get(c.branch)??c.branch;
      const ae = c.ae??'';
      const subsidiary = Object.entries(subsidiaryBranches).find(([,bs])=>bs.includes(c.branch))?.[0]??'';
      return { value:c.name, code:c.code, branch:c.branch, ae, subsidiary };
    });
  }, [data.CLIENTS, data.BRANCHES, filterBranches, filterSub, filterAE, subsidiaryBranches]);

  const aeOptions = useMemo(() => {
    const allowedBranches = filterBranches.size>0 ? filterBranches : filterSub ? new Set(subsidiaryBranches[filterSub]??[]) : null;
    if (!allowedBranches) return data.AE_LIST??[];
    const aeSet = new Set<string>();
    for (const c of data.CLIENTS) { if (allowedBranches.has(c.branch)&&c.ae) aeSet.add(c.ae); }
    return (data.AE_LIST??[]).filter(ae=>aeSet.has(ae));
  }, [data.CLIENTS, data.AE_LIST, filterBranches, filterSub, subsidiaryBranches]);

  function handleClientInput(raw: string) {
    setFilterClientInput(raw); setPage(1);
    const trimmed = raw.trim().toLowerCase();
    const opt = clientDatalistOptions.find(o=>o.value.toLowerCase()===trimmed);
    if (opt) {
      setFilterClient(opt.code);
      const allMatch = clientDatalistOptions.filter(o=>o.value.toLowerCase()===trimmed);
      if (allMatch.length===1) { setFilterSub(opt.subsidiary); setFilterBranches(new Set([opt.branch])); setFilterAE(opt.ae); }
    } else { setFilterClient(''); }
  }

  function handleSubChange(sub: string) {
    setFilterSub(sub); setPage(1);
    if (!sub) return;
    const allowed = subsidiaryBranches[sub]??[];
    if (allowed.length===1) setFilterBranches(new Set([allowed[0]]));
    else if (![...filterBranches].every(b=>allowed.includes(b))) setFilterBranches(new Set());
  }

  // ── Enriched rows ─────────────────────────────────────────────────────────
  const enriched = useMemo(() => {
    const clientMap = new Map(data.CLIENTS.map(c=>[c.code,c]));
    const branchMap = new Map(data.BRANCHES.map(b=>[b.id,b.name]));
    const today = todayISO();
    const meta = data.CHECKS_META;
    const hasEvents = (data.EVENTS?.length??0) > 0;
    const eventsMap = hasEvents ? groupSortedEvents(data.EVENTS) : null;

    return data.CHECKS.filter(c=>canSeeCheck(perms,c)).map(c => {
      const cl = clientMap.get(c.client);
      let status='OPEN', balance=c.originalAmount, totalPaid=0, holdCount=0, returnCount=0;
      let nextDeposit:string|null=null, reason:string|null=null;

      if (meta&&meta[c.id]) {
        const m=meta[c.id]; status=m.status; balance=m.balance; totalPaid=m.totalPaid;
        holdCount=m.holdCount; returnCount=m.returnCount; nextDeposit=m.nextDeposit; reason=m.reason;
      } else if (eventsMap) {
        const evs=eventsMap.get(c.id)??[];
        const computed=computeCheckStatus(c,evs);
        status=computed.status; holdCount=computed.holdCount; returnCount=computed.returnCount;
        totalPaid=Math.round(evs.filter(e=>['PARTIAL_PAYMENT','REPLACEMENT','SETTLED_PAID'].includes(e.type)).reduce((s,e)=>s+(e.amount??0),0)*100)/100;
        balance=status==='CLEARED'?0:Math.max(0,Math.round((c.originalAmount-totalPaid)*100)/100);
        for (let j=evs.length-1;j>=0;j--) { if ((evs[j].type==='HOLD_REQUEST'||evs[j].type==='RECONSTRUCT')&&evs[j].moveDate){nextDeposit=evs[j].moveDate;break;} if(evs[j].type==='RETURN'||evs[j].type==='DEPOSIT_CLEARED')break; }
        let fb:string|null=null;
        for (let j=evs.length-1;j>=0;j--) { const ev=evs[j]; if(ev.reason?.trim()){if(ev.type==='RETURN'){reason=ev.reason.trim();break;} if(!fb)fb=ev.reason.trim();} }
        if (!reason) reason=fb;
      } else { status=(c.finalStatus as string)||'OPEN'; }

      const aging = c.checkDate ? (nextDeposit ? Math.floor((new Date(nextDeposit).getTime()-new Date(c.checkDate).getTime())/86400000) : Math.floor((new Date(today).getTime()-new Date(c.checkDate).getTime())/86400000)) : null;
      const daysSince = c.checkDate ? Math.floor((new Date(today).getTime()-new Date(c.checkDate).getTime())/86400000) : 0;
      const stale = daysSince>STALE_DAYS&&!['CLEARED','REPLACED','SETTLED (PAID)','CANCELLED'].includes(status);

      return { ...c, status, balance, totalPaid, holdCount, returnCount, nextDeposit, reason, aging, stale, clientName:cl?.name??'', branchName:branchMap.get(c.branch)??c.branch };
    });
  }, [data.CHECKS, data.CHECKS_META, data.EVENTS, data.CLIENTS, data.BRANCHES, perms]);

  const staleCount = useMemo(() => enriched.filter(c=>c.stale).length, [enriched]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterStale)              rows=rows.filter(c=>c.stale);
    if (filterSub)                rows=rows.filter(c=>c.subsidiary===filterSub);
    if (filterBranches.size>0)    rows=rows.filter(c=>filterBranches.has(c.branch));
    if (filterClient) {
      const selectedName=data.CLIENTS.find(c=>c.code===filterClient)?.name?.toLowerCase()??'';
      const codes=new Set(data.CLIENTS.filter(cl=>cl.code===filterClient||(selectedName&&cl.name.toLowerCase()===selectedName)).map(cl=>cl.code));
      rows=rows.filter(c=>codes.has(c.client));
    } else if (filterClientInput.trim()) {
      const q=filterClientInput.trim().toLowerCase();
      rows=rows.filter(c=>c.clientName.toLowerCase().includes(q)||c.client.toLowerCase().includes(q));
    }
    if (filterPayFor) rows=rows.filter(c=>c.paymentFor===filterPayFor);
    if (filterAE)     rows=rows.filter(c=>(c.ae??'').toLowerCase().includes(filterAE.toLowerCase()));
    if (selectedStatuses.size>0) rows=rows.filter(c=>selectedStatuses.has(c.status));
    if (search) { const q=search.toLowerCase(); rows=rows.filter(c=>c.checkNo.toLowerCase().includes(q)||c.clientName.toLowerCase().includes(q)||(c.bank??'').toLowerCase().includes(q)); }
    if (dateFrom) rows=rows.filter(c=>(c.checkDate??'')>=dateFrom);
    if (dateTo)   rows=rows.filter(c=>(c.checkDate??'')<=dateTo);
    return rows;
  }, [enriched,filterStale,filterSub,filterBranches,filterClient,filterClientInput,filterPayFor,filterAE,selectedStatuses,search,dateFrom,dateTo,data.CLIENTS]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a,b) => {
      let va:unknown, vb:unknown;
      if (sortKey==='clientName') { va=a.clientName; vb=b.clientName; }
      else if (sortKey==='nextDeposit') { va=a.nextDeposit??''; vb=b.nextDeposit??''; }
      else if (sortKey==='aging') { va=a.aging??-1; vb=b.aging??-1; }
      else if (sortKey==='originalAmount') { va=a.originalAmount; vb=b.originalAmount; }
      else if (sortKey==='balance') { va=a.balance; vb=b.balance; }
      else { va=(a as Record<string,unknown>)[sortKey]??''; vb=(b as Record<string,unknown>)[sortKey]??''; }
      const cmp = (va as string|number)<(vb as string|number)?-1:(va as string|number)>(vb as string|number)?1:0;
      return sortDir==='asc'?cmp:-cmp;
    });
  }, [filtered,sortKey,sortDir]);

  const totalBalance = filtered.reduce((s,c)=>s+c.balance,0);
  const totalPages   = Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));
  const pageRows     = sorted.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const toggleSort   = useCallback((key:SortKey)=>{ if(sortKey===key)setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortKey(key);setSortDir('asc');} },[sortKey]);

  function SortTh({ col,label,right,colIndex }: { col:SortKey;label:string;right?:boolean;colIndex:number }) {
    const active=sortKey===col;
    return (
      <th className={`relative px-3 py-2.5 text-xs font-semibold cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap ${right?'text-right':'text-left'}`} onClick={()=>toggleSort(col)}>
        {label}{active?(sortDir==='asc'?' ↑':' ↓'):''}
        <span onMouseDown={e=>{e.stopPropagation();startResize(e,colIndex);}} onClick={e=>e.stopPropagation()} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none',zIndex:1 }} />
      </th>
    );
  }

  function clearAllFilters() {
    setFilterSub('');setFilterBranches(new Set());setFilterClientInput('');setFilterClient('');
    setFilterPayFor('');setFilterAE('');setSelectedStatuses(new Set());setFilterStale(false);
    setSearch('');setDateFrom('');setDateTo('');setPage(1);
  }
  const anyFilter = filterSub||filterBranches.size>0||filterClient||filterClientInput||filterPayFor||filterAE||selectedStatuses.size>0||filterStale||search||dateFrom||dateTo;

  function generateNoticeText() {
    return sorted.filter(c=>selectedForNotice.has(c.id)).map(c => {
      const bankCheck=`${c.bank}-${c.checkNo}`;
      const date=c.checkDate?new Date(c.checkDate).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric'}):'—';
      const amount=c.originalAmount?c.originalAmount.toLocaleString('en-PH',{minimumFractionDigits:2}):'—';
      const reason=c.reason?.trim()||c.status||'RETURNED';
      const clientName=c.clientName||c.client;
      const payFor=c.paymentFor?c.paymentFor.replace(/^PAYMENT FOR\s*/i,''):'';
      return `Subject: Bounced Check Notification\nClient : ${clientName}\nCheck details: ${bankCheck}, ${date}, ${amount}-${reason}\n\nGood day, Ma'am/Sir!\n\nPlease be informed that the check issued for your account, Check No. ${c.checkNo}, dated ${date}, in the amount of ₱${amount} payment for ${payFor}, was returned by the bank. We kindly request that you coordinate with us at your earliest convenience.\n\nThank you!\n${userName}\nES PRINT ACCOUNTING  MANILA`;
    }).join('\n\n'+'─'.repeat(50)+'\n\n');
  }

  const mouseDownPos = useRef<{x:number;y:number}|null>(null);
  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600';

  return (
    <div className="animate-fade-in space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Checks</h1>
          <p className="text-sm text-gray-500">Click any check to view its full event timeline and add hold requests, returns, or partial payments.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedForNotice.size>0 && (
            <>
              <button onClick={()=>setShowReconstructModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100">
                🔄 Reconstruct ({selectedForNotice.size})
              </button>
              <button onClick={()=>setShowNoticeModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">
                📋 Generate Notice ({selectedForNotice.size})
              </button>
              <button onClick={async () => {
                const selected = sorted.filter(c=>selectedForNotice.has(c.id));
                const isAllAPSI = selected.length>0&&selected.every(c=>c.subsidiary==='APSI');
                await generateSOA({
                  checks: selected.map(c=>({
                    id:c.id, client:c.client, clientName:c.clientName, bank:c.bank,
                    checkNo:c.checkNo, checkDate:c.checkDate, originalAmount:c.originalAmount,
                    balance:c.balance, totalPaid:c.totalPaid, status:c.status,
                    reason:c.reason, branchName:c.branchName,
                    paymentDetails:data.CHECKS_META?.[c.id]?.paymentDetails ?? '',
                  })),
                  preparedBy: userName,
                  template: isAllAPSI ? 'APSI' : 'ES',
                });
              }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100">
                📄 Export SOA ({selectedForNotice.size})
              </button>
            </>
          )}
          {userCanCreate && (
            <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-700">
              + New Check
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Filters</span>
          <button onClick={()=>setFiltersCollapsed(c=>!c)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            {filtersCollapsed?'▾ Show filters':'▴ Hide filters'}
          </button>
        </div>
        {!filtersCollapsed && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Subsidiary</label>
                <select value={filterSub} onChange={e=>handleSubChange(e.target.value)} className={sel+' w-full'}>
                  <option value="">All subsidiaries</option>
                  {data.SUBSIDIARIES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Branch</label>
                <BranchMultiSelect branches={visibleBranches} selected={filterBranches} onChange={s=>{setFilterBranches(s);setPage(1);}} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Client</label>
                <input list="client-datalist" value={filterClientInput} onChange={e=>handleClientInput(e.target.value)} placeholder="Type client name…" className={sel+' w-full'} autoComplete="off" />
                <datalist id="client-datalist">{clientDatalistOptions.map(o=><option key={o.code} value={o.value} />)}</datalist>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">AE</label>
                <input list="ae-datalist" value={filterAE} onChange={e=>{setFilterAE(e.target.value);setPage(1);}} placeholder="Type AE…" className={sel+' w-full'} autoComplete="off" />
                <datalist id="ae-datalist">{aeOptions.map(ae=><option key={ae} value={ae} />)}</datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} className={sel+' w-full'} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">To</label>
                <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}} className={sel+' w-full'} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Status</label>
                <StatusMultiSelect selected={selectedStatuses} onChange={s=>{setSelectedStatuses(s);setPage(1);}} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Payment For</label>
                <select value={filterPayFor} onChange={e=>{setFilterPayFor(e.target.value);setPage(1);}} className={sel+' w-full'}>
                  <option value="">All</option>
                  {PAYMENT_FOR_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="check #, bank, client…" className={sel+' w-full'} />
              </div>
              <button onClick={()=>setPage(1)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-blue-700">Apply</button>
              <button onClick={()=>setShowCsvExport(true)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50">Export CSV</button>
              {anyFilter && <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear filters</button>}
            </div>
          </>
        )}
      </div>

      {/* Count + pagination header */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 px-1">
        <div className="flex items-center gap-3">
          <span>
            {sorted.length} check{sorted.length!==1?'s':''}{sorted.length>0&&` · showing ${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,sorted.length)}`}
            {staleCount>0 && <button onClick={()=>{setFilterStale(true);setPage(1);}} className="ml-2 text-purple-600 font-semibold hover:underline">· {staleCount} stale</button>}
          </span>
          {totalPages>1 && (
            <div className="flex items-center gap-1.5 ml-2">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40">← Prev</button>
              <span className="text-xs font-semibold text-gray-700 px-1">Page {page} of {totalPages}</span>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={()=>reload(true)} disabled={loading} className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold disabled:opacity-40">
            {sorted.length===0&&anyFilter?'⚠ No results — try loading full history':'Load full history'}
          </button>
          <div ref={colPickerRef} className="relative">
            <button onClick={()=>setShowColPicker(o=>!o)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
              Columns {hiddenCols.size>0&&<span className="bg-blue-600 text-white rounded-full px-1.5 text-[10px]">{hiddenCols.size}</span>}
            </button>
            {showColPicker && (
              <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[180px]">
                <div className="px-3 pb-1 flex items-center justify-between border-b border-gray-100 mb-1">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Show / Hide Columns</span>
                  <button onClick={()=>{setHiddenCols(new Set());try{localStorage.removeItem('checks-hidden-cols');}catch{}resetCols();}} className="text-[10px] text-blue-600 hover:underline">Reset</button>
                </div>
                {ALL_COLS.map(col=>(
                  <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-gray-700 select-none">
                    <input type="checkbox" checked={!hiddenCols.has(col)} onChange={()=>toggleCol(col)} className="accent-blue-700 w-3.5 h-3.5" />
                    {col}
                  </label>
                ))}
              </div>
            )}
          </div>
          <span className="font-semibold text-gray-800">Total balance: {fmtPHP(totalBalance)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table ref={tableRef} className="report w-full min-w-max text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                  <input type="checkbox" className="accent-blue-700"
                    checked={pageRows.length>0&&pageRows.every(r=>selectedForNotice.has(r.id))}
                    onChange={e=>{const n=new Set(selectedForNotice);pageRows.forEach(r=>e.target.checked?n.add(r.id):n.delete(r.id));setSelectedForNotice(n);}} />
                  <span onMouseDown={e=>startResize(e,0)} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} />
                </th>
                {vis('SUBSIDIARY')     && <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">SUBSIDIARY<span onMouseDown={e=>startResize(e,colIdx('SUBSIDIARY'))} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} /></th>}
                {vis('BRANCH')         && <SortTh col="branch"         label="BRANCH"        colIndex={colIdx('BRANCH')} />}
                {vis('CLIENT')         && <SortTh col="clientName"     label="CLIENT"        colIndex={colIdx('CLIENT')} />}
                {vis('AE')             && <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">AE<span onMouseDown={e=>startResize(e,colIdx('AE'))} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} /></th>}
                {vis('BANK / CHECK #') && <SortTh col="checkNo"        label="BANK / CHECK #" colIndex={colIdx('BANK / CHECK #')} />}
                {vis('CHECK DATE')     && <SortTh col="checkDate"      label="CHECK DATE"     colIndex={colIdx('CHECK DATE')} />}
                {vis('ORIGINAL ₱')    && <SortTh col="originalAmount"  label="ORIGINAL ₱"    right colIndex={colIdx('ORIGINAL ₱')} />}
                {vis('BALANCE ₱')     && <SortTh col="balance"         label="BALANCE ₱"     right colIndex={colIdx('BALANCE ₱')} />}
                {vis('NEXT DEPOSIT')  && <SortTh col="nextDeposit"     label="NEXT DEPOSIT"   colIndex={colIdx('NEXT DEPOSIT')} />}
                {vis('AGING')         && <SortTh col="aging"           label="AGING"          right colIndex={colIdx('AGING')} />}
                {vis('STATUS')        && <SortTh col="status"          label="STATUS"         colIndex={colIdx('STATUS')} />}
                {vis('REASON')        && <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">REASON<span onMouseDown={e=>startResize(e,colIdx('REASON'))} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} /></th>}
                {vis('NOTES')         && <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">NOTES<span onMouseDown={e=>startResize(e,colIdx('NOTES'))} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} /></th>}
                {vis('PAYMENT FOR')   && <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">PAYMENT FOR<span onMouseDown={e=>startResize(e,colIdx('PAYMENT FOR'))} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} /></th>}
                {vis('PAYMENT DE…')   && <th className="relative px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">PAYMENT DE…<span onMouseDown={e=>startResize(e,colIdx('PAYMENT DE…'))} style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:1 }} /></th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(c=>{
                const isOverdue  = c.status==='HELD'&&c.nextDeposit&&c.nextDeposit<todayISO();
                const isDueToday = c.status==='HELD'&&c.nextDeposit===todayISO();
                return (
                  <tr key={c.id} id={`check-row-${c.id}`}
                    className={`border-b border-gray-50 transition-colors hover:bg-blue-50 ${recentlyCreatedId===c.id?'bg-green-100 animate-pulse':c.stale?'bg-purple-50/40':isOverdue?'bg-amber-50/40':''}`}
                    style={{ cursor:'pointer' }}
                    onMouseDown={e=>{ mouseDownPos.current={x:e.clientX,y:e.clientY}; }}
                    onClick={e=>{
                      const down=mouseDownPos.current;
                      if (down&&(Math.abs(e.clientX-down.x)>5||Math.abs(e.clientY-down.y)>5)) return;
                      if (window.getSelection()?.toString()) return;
                      setSelectedCheckId(c.id);
                    }}
                  >
                    <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" className="accent-blue-700" checked={selectedForNotice.has(c.id)}
                        onChange={e=>{const n=new Set(selectedForNotice);e.target.checked?n.add(c.id):n.delete(c.id);setSelectedForNotice(n);}} />
                    </td>
                    {vis('SUBSIDIARY')     && <td className="px-3 py-2 text-gray-500 select-text">{c.subsidiary?<span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-semibold">{c.subsidiary}</span>:'—'}</td>}
                    {vis('BRANCH')         && <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap select-text">{c.branchName}</td>}
                    {vis('CLIENT')         && <td className="px-3 py-2 text-gray-700 whitespace-nowrap select-text">{c.clientName||c.client}</td>}
                    {vis('AE')             && <td className="px-3 py-2 text-gray-500 select-text">{c.ae??'—'}</td>}
                    {vis('BANK / CHECK #') && <td className="px-3 py-2 font-mono font-semibold text-gray-800 whitespace-nowrap select-text">{c.bank} {c.checkNo}</td>}
                    {vis('CHECK DATE')     && <td className="px-3 py-2 text-gray-600 whitespace-nowrap select-text">{fmtDate(c.checkDate)}</td>}
                    {vis('ORIGINAL ₱')    && <td className="px-3 py-2 font-mono text-gray-700 text-right whitespace-nowrap select-text">{fmtPHP(c.originalAmount)}</td>}
                    {vis('BALANCE ₱')     && <td className={`px-3 py-2 font-mono font-semibold text-right whitespace-nowrap select-text ${c.balance<c.originalAmount?'text-amber-700':'text-gray-800'}`}>{fmtPHP(c.balance)}</td>}
                    {vis('NEXT DEPOSIT')  && <td className={`px-3 py-2 whitespace-nowrap text-sm select-text ${isOverdue?'text-red-600 font-semibold':isDueToday?'text-green-700 font-semibold':'text-gray-600'}`}>
                      {c.nextDeposit?fmtDate(c.nextDeposit):'—'}
                      {isOverdue&&<span className="ml-1 text-[10px] font-bold">⚠</span>}
                      {isDueToday&&<span className="ml-1 text-[10px] font-bold">●</span>}
                    </td>}
                    {vis('AGING')         && <td className={`px-3 py-2 text-right whitespace-nowrap font-medium select-text ${(c.aging??0)>180?'text-purple-700':(c.aging??0)>90?'text-red-600':(c.aging??0)>30?'text-amber-600':'text-gray-500'}`}>{c.aging!=null?`${c.aging}d`:'—'}</td>}
                    {vis('STATUS')        && <td className="px-3 py-2 whitespace-nowrap select-text"><div className="flex items-center gap-1"><StatusBadge status={c.status} />{c.stale&&<span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1 rounded">STALE</span>}</div></td>}
                    {vis('REASON')        && <td className="px-3 py-2 text-gray-600 whitespace-nowrap select-text">{c.reason??'—'}</td>}
                    {vis('NOTES')         && (
                      <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setNotesCheckId(c.id)} title="View / add notes"
                          style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600,border:'1px solid #e2e8f0',background:notesCounts[c.id]?'#eff6ff':'#f8fafc',color:notesCounts[c.id]?'#1e3a8a':'#9ca3af',cursor:'pointer',whiteSpace:'nowrap' }}>
                          📋 {notesCounts[c.id]?notesCounts[c.id]:'Add'}
                        </button>
                      </td>
                    )}
                    {vis('PAYMENT FOR')   && <td className="px-3 py-2">{c.paymentFor?<span className={`rounded px-1.5 py-0.5 font-semibold text-[11px] ${(c.paymentFor??'').toLowerCase()==='others'?'bg-amber-100 text-amber-800 border border-amber-300':'bg-violet-100 text-violet-700'}`}>{c.paymentFor}</span>:'—'}</td>}
                    {vis('PAYMENT DE…')   && <td className="px-3 py-2 text-gray-500 whitespace-nowrap select-text" title={c.paymentDescription}>{c.paymentDescription||'—'}</td>}
                  </tr>
                );
              })}
              {pageRows.length===0 && <tr><td colSpan={15} className="px-4 py-10 text-center text-gray-400 italic">No checks match your filters</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages>1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
            <span>Page {page} of {totalPages} · {sorted.length} total</span>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <CheckModal data={data} userEmail={userEmail} onClose={()=>setShowModal(false)}
          onSaved={()=>{reload();setPage(1);}} />
      )}

      {selectedCheckId && (
        <CheckDetailModal checkId={selectedCheckId} perms={perms} userEmail={userEmail} userName={userName}
          onClose={()=>setSelectedCheckId(null)}
          onSaved={()=>{setSelectedCheckId(null);reload();}} />
      )}

      {notesCheckId && (()=>{
        const c=enriched.find(r=>r.id===notesCheckId);
        const label=c?`${c.bank??''} ${c.checkNo} — ${c.clientName||c.client}`.trim():notesCheckId;
        return (
          <CheckNotesModal checkId={notesCheckId} checkLabel={label}
            onClose={()=>setNotesCheckId(null)}
            onCountChange={(id,count)=>setNotesCounts(prev=>({...prev,[id]:count}))} />
        );
      })()}

      {/* Notice Modal */}
      {showNoticeModal && typeof document!=='undefined' && createPortal(
        <div style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}
          onClick={()=>setShowNoticeModal(false)}>
          <div style={{ background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:600,maxHeight:'85vh',display:'flex',flexDirection:'column' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #f1f5f9' }}>
              <h2 style={{ margin:0,fontSize:15,fontWeight:700,color:'#111827' }}>📋 Bounced Check Notice ({selectedForNotice.size} check{selectedForNotice.size!==1?'s':''})</h2>
              <button onClick={()=>setShowNoticeModal(false)} style={{ background:'#f1f5f9',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:18,color:'#6b7280' }}>×</button>
            </div>
            <textarea readOnly value={generateNoticeText()}
              style={{ flex:1,padding:'16px 20px',border:'none',outline:'none',fontSize:13,lineHeight:1.7,resize:'none',fontFamily:'inherit',color:'#1f2937',background:'#f8fafc',overflowY:'auto' }} />
            <div style={{ padding:'12px 20px',borderTop:'1px solid #f1f5f9',display:'flex',gap:10,justifyContent:'flex-end' }}>
              <CopyButton getText={generateNoticeText} />
              <button onClick={()=>setShowNoticeModal(false)} style={{ padding:'9px 18px',borderRadius:8,fontSize:13,fontWeight:600,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',color:'#374151' }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ExportCsvModal
        isOpen={showCsvExport}
        onClose={()=>setShowCsvExport(false)}
        rows={sorted}
        filename={`ESPrint_Checks_${todayISO()}.csv`}
      />

      {/* Reconstruct bulk modal */}
      {showReconstructModal && (() => {
        const checksForModal: SelectedCheck[] = sorted
          .filter(c => selectedForNotice.has(c.id))
          .map(c => ({
            id:             c.id,
            client:         c.client,
            bank:           c.bank,
            checkNo:        c.checkNo,
            checkDate:      c.checkDate,
            originalAmount: c.originalAmount,
            clientName:     c.clientName,
            branch:         c.branchName,
            subsidiary:     c.subsidiary,
            ae:             c.ae,
            paymentFor:     c.paymentFor,
            status:         c.status,
          }));
        return (
          <ReconstructBulkModal
            selectedChecks={checksForModal}
            userEmail={userEmail}
            userName={userName}
            onClose={()=>setShowReconstructModal(false)}
            onSuccess={()=>{ setShowReconstructModal(false); setSelectedForNotice(new Set()); reload(); }}
          />
        );
      })()}
    </div>
  );
}
