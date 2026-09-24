'use client';
/**
 * DashboardClient — interactive portal dashboard.
 *
 * Ported from esprint-check-monitoring/app/dashboard/page.tsx.
 * Adds: clickable stat cards → DrillModal, clickable branch rows →
 * /checks/all?branch=X, clickable recent events → /checks/[id],
 * and "Export full ledger" → ExportCsvModal.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { fmtPHP, fmtDate, todayISO, EVENT_LABELS, STALE_DAYS } from '../lib/format';
import { DonutChart, BranchBarChart } from './charts';
import ExportCsvModal from './ExportCsvModal';
import StatusBadge from './StatusBadge';
import type {
  DashboardSummary, EnrichedDrillCheck,
} from '../lib/summary';

// ─── Types ────────────────────────────────────────────────────────────────────

type DrillKey = 'HELD' | 'RETURNED' | 'PARTIAL' | 'DUE_TODAY' | 'OVERDUE' | 'STALE';

const DRILL_COLS = [
  'Subsidiary', 'Branch', 'Client', 'AE', 'Bank / Check #', 'Check Date',
  'Original ₱', 'Balance ₱', 'Status', 'Next Deposit',
  'Aging', 'Reason', 'Payment For', 'Description', 'Notes', 'Encoded By',
] as const;
type DrillCol = typeof DRILL_COLS[number];

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardClient({ summary }: { summary: DashboardSummary }) {
  const router = useRouter();
  const [drillKey, setDrillKey] = useState<DrillKey | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDrillExport, setShowDrillExport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh every 30 seconds — keeps dashboard in sync with other users
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      router.refresh();
      setTimeout(() => setRefreshing(false), 800);
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  const { kpi, branchRows, statusChart, recentEvents, drillChecks } = summary;

  // Stat card definitions — matches original exactly
  const stats: { label: string; value: number; sub: string; tag: string; tagCls: string; valueCls: string; key: DrillKey }[] = [
    { label: 'HELD',            value: kpi.held.count,     sub: fmtPHP(kpi.held.amount),     tag: 'Open',     tagCls: 'bg-blue-50 text-blue-700',    valueCls: 'text-blue-700',   key: 'HELD' },
    { label: 'RETURNED (OPEN)', value: kpi.returned.count, sub: fmtPHP(kpi.returned.amount), tag: 'Returned', tagCls: 'bg-red-50 text-red-700',      valueCls: 'text-red-600',    key: 'RETURNED' },
    { label: 'PARTIALLY PAID',  value: kpi.partial.count,  sub: fmtPHP(kpi.partial.amount),  tag: 'Partial',  tagCls: 'bg-amber-50 text-amber-700',  valueCls: 'text-amber-600',  key: 'PARTIAL' },
    { label: 'DUE TODAY',       value: kpi.dueToday.count, sub: fmtDate(todayISO()),          tag: 'Today',    tagCls: 'bg-slate-100 text-slate-700', valueCls: 'text-slate-900',  key: 'DUE_TODAY' },
    { label: 'OVERDUE HOLDS',   value: kpi.overdue.count,  sub: 'Past move date',             tag: 'Late',     tagCls: 'bg-amber-50 text-amber-800',  valueCls: 'text-amber-700',  key: 'OVERDUE' },
    {
      label: 'STALE CHECKS', value: kpi.stale.count,
      sub: fmtPHP(kpi.stale.amount) + ` · >${STALE_DAYS}d`,
      tag: 'Stale', tagCls: 'bg-purple-50 text-purple-700', valueCls: 'text-purple-700', key: 'STALE',
    },
  ];

  // Which checks to show in the drill modal
  const drillConfig = drillKey ? {
    HELD:      { title: 'Held Checks',     totalLabel: 'Total held balance',    checks: drillChecks.held },
    RETURNED:  { title: 'Returned Checks', totalLabel: 'Total outstanding',     checks: drillChecks.returned },
    PARTIAL:   { title: 'Partially Paid',  totalLabel: 'Remaining balance',     checks: drillChecks.partial },
    DUE_TODAY: { title: 'Due Today',       totalLabel: 'Total due today',       checks: drillChecks.dueToday },
    OVERDUE:   { title: 'Overdue Holds',   totalLabel: 'Total overdue balance', checks: drillChecks.overdue },
    STALE:     { title: 'Stale Checks',    totalLabel: 'Total stale balance',   checks: drillChecks.stale },
  }[drillKey] : null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          <span className="font-medium text-green-600">Live</span>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 transition-opacity duration-500 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
        {stats.map((s) => (
          <div
            key={s.key}
            className="stat-card clickable"
            onClick={() => setDrillKey(s.key)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold leading-tight">{s.label}</div>
              <div className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${s.tagCls}`}>{s.tag}</div>
            </div>
            <div className={`mt-3 text-3xl font-bold ${s.valueCls}`}>{s.value}</div>
            <div className="mt-1 text-xs text-slate-500">{s.sub}</div>
            <div className="mt-4 text-[10px] text-slate-400 flex items-center justify-between">
              <span>View breakdown</span><span>→</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-gray-900">Check Status Distribution</h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">Interactive</span>
          </div>
          <DonutChart data={statusChart} />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-gray-900">Branch Share &amp; Export</h3>
            <button
              onClick={() => setShowExportModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-bold flex items-center gap-1 cursor-pointer bg-transparent border-none"
            >
              ↓ Export full ledger
            </button>
          </div>
          <BranchBarChart data={branchRows} />
        </div>
      </div>

      {/* ── Branch table + Recent events ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Branch summary */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-sm text-gray-900 mb-1">By branch (your access)</h3>
          <p className="text-xs text-gray-400 mb-3">Click any row to filter All Checks by that branch.</p>
          <div className="overflow-x-auto">
            <table className="report w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-semibold uppercase tracking-wide text-[10px]">BRANCH</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">HELD</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">HELD &#8369;</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">RETURNED</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">RETURNED &#8369;</th>
                  <th className="pb-2 font-semibold text-right uppercase tracking-wide text-[10px]">STALE</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/checks/all?branch=${b.id}`)}
                  >
                    <td className="py-2 font-medium text-gray-800">{b.name}</td>
                    <td className="py-2 text-right text-blue-700 font-semibold">{b.held || '—'}</td>
                    <td className="py-2 text-right text-blue-600 font-mono text-[11px]">{b.heldAmt > 0 ? fmtPHP(b.heldAmt) : '—'}</td>
                    <td className="py-2 text-right text-red-600 font-semibold">{b.returned || '—'}</td>
                    <td className="py-2 text-right text-red-500 font-mono text-[11px]">{b.retAmt > 0 ? fmtPHP(b.retAmt) : '—'}</td>
                    <td className="py-2 text-right text-purple-600 font-semibold">{b.stale || '—'}</td>
                  </tr>
                ))}
                {branchRows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-gray-400 italic">No check data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent events */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent events</h3>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No events recorded yet. Start by encoding a check.</p>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => router.push(`/checks/${ev.checkId}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {EVENT_LABELS[ev.type] ?? ev.type}{ev.clientName ? ` · ${ev.clientName}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ev.branchName}{ev.checkNo ? ` · ${ev.bank} ${ev.checkNo}` : ''} · {fmtDate(ev.eventDate)}
                      </div>
                    </div>
                    {ev.amount != null && (
                      <div className="text-xs font-mono font-semibold text-slate-800 shrink-0">{fmtPHP(ev.amount)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Drill-down modal ── */}
      {drillKey && drillConfig && (
        <DrillModal
          title={drillConfig.title}
          totalLabel={drillConfig.totalLabel}
          checks={drillConfig.checks}
          drillKey={drillKey}
          onClose={() => setDrillKey(null)}
          onExport={() => { setShowDrillExport(true); }}
          onOpenCheck={(id) => { router.push(`/checks/${id}`); setDrillKey(null); }}
        />
      )}

      {/* Export full ledger modal */}
      <ExportCsvModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        rows={drillChecks.all as any[]}
        filename={`Full_Check_Ledger_${todayISO()}.csv`}
      />

      {/* Export drill CSV modal */}
      <ExportCsvModal
        isOpen={showDrillExport}
        onClose={() => setShowDrillExport(false)}
        rows={(drillConfig?.checks ?? []) as any[]}
        filename={`${drillConfig?.title.replace(/\s+/g, '_') ?? 'export'}_${todayISO()}.csv`}
      />
    </div>
  );
}

// ─── DrillModal ───────────────────────────────────────────────────────────────

function DrillModal({
  title, totalLabel, checks, drillKey, onClose, onExport, onOpenCheck,
}: {
  title: string; totalLabel: string;
  checks: EnrichedDrillCheck[]; drillKey: DrillKey;
  onClose: () => void; onExport: () => void;
  onOpenCheck: (id: string) => void;
}) {
  const showNextDep = drillKey === 'HELD' || drillKey === 'DUE_TODAY' || drillKey === 'OVERDUE';
  const [hiddenCols, setHiddenCols] = useState<Set<DrillCol>>(
    () => new Set<DrillCol>(['Description', 'Notes', 'Encoded By'])
  );
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  const vis = (col: DrillCol) => !hiddenCols.has(col);
  function toggleCol(col: DrillCol) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  }

  const total = checks.reduce((s, c) => s + c.balance, 0);
  const visColCount = DRILL_COLS.filter((c) => {
    if (c === 'Next Deposit' && !showNextDep) return false;
    return vis(c);
  }).length;

  // Keyboard + outside-click close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '32px 16px', minHeight: '100vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: 1100, marginBottom: 32,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {checks.length} check{checks.length !== 1 ? 's' : ''} · {totalLabel}:{' '}
              <span style={{ fontWeight: 600, color: '#374151' }}>{fmtPHP(total)}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Column picker */}
            <div ref={colPickerRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowColPicker((o) => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                  fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', background: '#f8fafc',
                  cursor: 'pointer', color: '#374151',
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                Columns
                {hiddenCols.size > 0 && (
                  <span style={{ background: '#1e3a8a', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                    {hiddenCols.size}
                  </span>
                )}
              </button>
              {showColPicker && (
                <div style={{
                  position: 'absolute', right: 0, top: 40, zIndex: 10,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: '8px 0', minWidth: 180,
                }}>
                  <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show / Hide</span>
                    {hiddenCols.size > 0 && (
                      <button onClick={() => setHiddenCols(new Set())} style={{ fontSize: 10, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Reset
                      </button>
                    )}
                  </div>
                  {DRILL_COLS.filter((col) => col !== 'Next Deposit' || showNextDep).map((col) => (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                      <input type="checkbox" checked={vis(col)} onChange={() => toggleCol(col)} style={{ accentColor: '#1e3a8a', width: 13, height: 13 }} />
                      {col}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onExport}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}
            >
              ↓ Export CSV
            </button>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'auto' }}>
          {checks.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <p style={{ color: '#6b7280', fontSize: 14, fontWeight: 500 }}>No matching checks</p>
            </div>
          ) : (
            <table className="report w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                  {DRILL_COLS.filter((c) => c !== 'Next Deposit' || showNextDep).filter(vis).map((h) => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: h.includes('₱') || h === 'Aging' ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                      borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onOpenCheck(c.id)}
                    style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#eff6ff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
                  >
                    {vis('Subsidiary') && (
                      <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {c.subsidiary
                          ? <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{c.subsidiary}</span>
                          : '—'}
                      </td>
                    )}
                    {vis('Branch') && <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>{c.branchName}</td>}
                    {vis('Client') && <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{c.clientName}</td>}
                    {vis('AE') && <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{c.ae ?? '—'}</td>}
                    {vis('Bank / Check #') && <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{c.bank} {c.checkNo}</td>}
                    {vis('Check Date') && <td style={{ padding: '8px 12px', color: '#4b5563', whiteSpace: 'nowrap' }}>{fmtDate(c.checkDate)}</td>}
                    {vis('Original ₱') && <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#374151', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtPHP(c.originalAmount)}</td>}
                    {vis('Balance ₱') && (
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: c.balance < c.originalAmount ? '#b45309' : '#111827' }}>
                        {fmtPHP(c.balance)}
                      </td>
                    )}
                    {vis('Status') && (
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <StatusBadge status={c.status} />
                          {c.stale && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 5px', borderRadius: 4 }}>STALE</span>}
                        </div>
                      </td>
                    )}
                    {showNextDep && vis('Next Deposit') && (
                      <td style={{ padding: '8px 12px', color: '#4b5563', whiteSpace: 'nowrap' }}>{c.nextDeposit ? fmtDate(c.nextDeposit) : '—'}</td>
                    )}
                    {vis('Aging') && (
                      <td style={{
                        padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap',
                        color: (c.aging ?? 0) > 90 ? '#dc2626' : (c.aging ?? 0) > 30 ? '#d97706' : '#6b7280',
                        fontWeight: (c.aging ?? 0) > 90 ? 600 : 400,
                      }}>
                        {c.aging != null ? `${c.aging}d` : '—'}
                      </td>
                    )}
                    {vis('Reason') && <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{c.reason ?? '—'}</td>}
                    {vis('Payment For') && (
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {c.paymentFor
                          ? <span style={{
                              background: c.paymentFor.toLowerCase() === 'others' ? '#fef3c7' : '#f3e8ff',
                              color: c.paymentFor.toLowerCase() === 'others' ? '#92400e' : '#6b21a8',
                              border: c.paymentFor.toLowerCase() === 'others' ? '1px solid #fde047' : 'none',
                              borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                            }}>{c.paymentFor}</span>
                          : '—'}
                      </td>
                    )}
                    {vis('Description') && <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }} title={c.paymentDescription}>{c.paymentDescription || '—'}</td>}
                    {vis('Notes') && <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }} title={c.notes}>{c.notes || '—'}</td>}
                    {vis('Encoded By') && <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{c.createdBy ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <td
                    colSpan={visColCount - (vis('Balance ₱') ? 1 : 0)}
                    style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#374151' }}
                  >
                    Total ({checks.length} checks)
                  </td>
                  {vis('Balance ₱') && (
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#111827', textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtPHP(total)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
