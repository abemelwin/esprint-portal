'use client';
/**
 * PenaltyClient — Penalty Monitoring (standalone editable list).
 * Ported from esprint-check-monitoring/app/reports/penalty/page.tsx.
 * Calls /api/penalty (GET/POST/DELETE).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/modules/checks/components/Toast';
import { fmtPHP } from '@/modules/checks/lib/format';
import { useColumnResize } from '@/modules/checks/hooks/useColumnResize';
import { useStickyScrollbar } from '@/modules/checks/hooks/useStickyScrollbar';

interface PenaltyRow {
  id: string;
  client: string;
  moveNum: string;
  checkNo: string;
  checkDate: string;
  amount: number;
  paidCharge: number;
  pendingCharge: number;
  paymentDetails: string;
}

const ORDINALS = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH'];
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const EMPTY_ROW = (): PenaltyRow => ({
  id: newId(), client: '', moveNum: '1ST', checkNo: '', checkDate: '',
  amount: 0, paidCharge: 500, pendingCharge: 0, paymentDetails: '',
});

export function PenaltyClient() {
  const { showToast } = useToast();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { startResize } = useColumnResize(tableRef, 'col-widths-penalty');
  useStickyScrollbar(scrollRef);

  const [rows, setRows]       = useState<PenaltyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterMoveNum, setFilterMoveNum] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow]   = useState<PenaltyRow | null>(null);
  const [form, setForm]         = useState<PenaltyRow>(EMPTY_ROW());
  const [saving, setSaving]     = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/penalty');
      const json = await res.json();
      if (json.ok) {
        setRows((json.data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id, client: r.client, moveNum: r.move_num, checkNo: r.check_no,
          checkDate: r.check_date ?? '', amount: Number(r.amount ?? 0),
          paidCharge: Number(r.paid_charge ?? 0), pendingCharge: Number(r.pending_charge ?? 0),
          paymentDetails: r.payment_details ?? '',
        })));
      }
    } catch { showToast('Failed to load penalty records', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    if (search && !r.client.toLowerCase().includes(q) && !r.checkNo.toLowerCase().includes(q)) return false;
    if (filterMoveNum && r.moveNum !== filterMoveNum) return false;
    if (filterDateFrom && r.checkDate && r.checkDate < filterDateFrom) return false;
    if (filterDateTo   && r.checkDate && r.checkDate > filterDateTo)   return false;
    return true;
  });

  function exportCSV() {
    const headers = ['Client', '# of Move', 'Check #', 'Check Date', 'Amount', 'Paid Charge', 'Pending Charge', 'Payment Details'];
    const lines = [
      headers.join(','),
      ...filtered.map(r => [r.client, r.moveNum, r.checkNo, r.checkDate, r.amount, r.paidCharge, r.pendingCharge, r.paymentDetails]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ESPrint_Penalty_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const totalPaid    = filtered.reduce((s, r) => s + r.paidCharge, 0);
  const totalPending = filtered.reduce((s, r) => s + r.pendingCharge, 0);

  function openAdd() { setForm(EMPTY_ROW()); setEditRow(null); setShowForm(true); }
  function openEdit(r: PenaltyRow) { setForm({ ...r }); setEditRow(r); setShowForm(true); }

  async function saveForm() {
    if (!form.client.trim() || !form.checkNo.trim()) { showToast('Client and Check # are required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/penalty', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id, client: form.client, move_num: form.moveNum, check_no: form.checkNo,
          check_date: form.checkDate || null, amount: form.amount,
          paid_charge: form.paidCharge, pending_charge: form.pendingCharge, payment_details: form.paymentDetails,
        }),
      });
      const json = await res.json();
      if (json.ok) { showToast(editRow ? 'Row updated' : 'Row added', 'success'); setShowForm(false); fetchRows(); }
      else showToast(json.error ?? 'Save failed', 'error');
    } catch { showToast('Error saving', 'error'); }
    finally { setSaving(false); }
  }

  async function deleteRow(id: string) {
    try {
      const res = await fetch('/api/penalty', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const json = await res.json();
      if (json.ok) { showToast('Row deleted', 'success'); fetchRows(); }
      else showToast(json.error ?? 'Delete failed', 'error');
    } catch { showToast('Error deleting', 'error'); }
  }

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600';
  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 placeholder:text-gray-400';
  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Penalty Monitoring</h1>
          <p className="text-sm text-gray-500">₱500 charge per hold/move. Standalone records — separate from All Checks.</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-700">+ Add Row</button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Client or check #…" className={sel + ' w-full'} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1"># of Move</label>
            <select value={filterMoveNum} onChange={e => setFilterMoveNum(e.target.value)} className={sel + ' w-full'}>
              <option value="">All</option>
              {ORDINALS.slice(1).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">From</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={sel + ' w-full'} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={sel + ' w-full'} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50">Export CSV</button>
          {(search || filterMoveNum || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setSearch(''); setFilterMoveNum(''); setFilterDateFrom(''); setFilterDateTo(''); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Total Rows</div>
          <div className="text-2xl font-bold text-gray-900">{filtered.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Total Paid</div>
          <div className="text-2xl font-bold text-green-700">{fmtPHP(totalPaid)}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-1">Total Pending</div>
          <div className="text-2xl font-bold text-red-700">{fmtPHP(totalPending)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table ref={tableRef} className="report w-full min-w-max text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['CLIENT','# OF MOVE','CHECK #','CHECK DATE'].map((h, i) => (
                  <th key={h} className="relative px-3 py-2.5 text-left font-semibold text-gray-600">{h}<span onMouseDown={e => startResize(e, i)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', zIndex:1 }} /></th>
                ))}
                <th className="relative px-3 py-2.5 text-right font-semibold text-gray-600">AMOUNT<span onMouseDown={e => startResize(e, 4)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-right font-semibold text-green-700">PAID CHARGE<span onMouseDown={e => startResize(e, 5)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-right font-semibold text-red-600">PENDING CHARGE<span onMouseDown={e => startResize(e, 6)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5 text-left font-semibold text-gray-600">PAYMENT DETAILS<span onMouseDown={e => startResize(e, 7)} onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:0, bottom:0, width:5, cursor:'col-resize', zIndex:1 }} /></th>
                <th className="relative px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 italic">Loading…</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate" title={r.client}>{r.client}</td>
                  <td className="px-3 py-2 font-bold text-blue-700">{r.moveNum}</td>
                  <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{r.checkNo}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.checkDate ? new Date(r.checkDate).toLocaleDateString('en-US') : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtPHP(r.amount)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{r.paidCharge > 0 ? fmtPHP(r.paidCharge) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-600">{r.pendingCharge > 0 ? fmtPHP(r.pendingCharge) : '—'}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={r.paymentDetails}>{r.paymentDetails || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                    <button onClick={() => deleteRow(r.id)} className="text-xs text-red-500 hover:underline">Del</button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 italic">No records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">* Data is shared across all users — stored in the database.</p>

      {/* Add/Edit Modal */}
      {showForm && typeof document !== 'undefined' && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'60px 16px 32px', overflowY:'auto' }}
          onClick={() => setShowForm(false)}>
          <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.25)', width:'100%', maxWidth:560, marginBottom:32 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderBottom:'1px solid #f1f5f9' }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>{editRow ? 'Edit Row' : 'Add Row'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:18, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ gridColumn:'span 2' }}>
                <label className={lbl}>Client *</label>
                <input value={form.client} onChange={e => setForm(f=>({...f,client:e.target.value}))} className={inp} placeholder="Client name" />
              </div>
              <div>
                <label className={lbl}># of Move</label>
                <select value={form.moveNum} onChange={e => setForm(f=>({...f,moveNum:e.target.value}))} className={inp}>
                  {ORDINALS.slice(1).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Check # *</label>
                <input value={form.checkNo} onChange={e => setForm(f=>({...f,checkNo:e.target.value}))} className={inp} placeholder="e.g. RCBC-9000033" />
              </div>
              <div>
                <label className={lbl}>Check Date</label>
                <input type="date" value={form.checkDate} onChange={e => setForm(f=>({...f,checkDate:e.target.value}))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Amount</label>
                <input type="number" value={form.amount || ''} onChange={e => setForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} className={inp} placeholder="0.00" />
              </div>
              <div>
                <label className={lbl}>Paid Charge</label>
                <input type="number" value={form.paidCharge || ''} onChange={e => setForm(f=>({...f,paidCharge:parseFloat(e.target.value)||0}))} className={inp} placeholder="500" />
              </div>
              <div>
                <label className={lbl}>Pending Charge</label>
                <input type="number" value={form.pendingCharge || ''} onChange={e => setForm(f=>({...f,pendingCharge:parseFloat(e.target.value)||0}))} className={inp} placeholder="0" />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label className={lbl}>Payment Details</label>
                <input value={form.paymentDetails} onChange={e => setForm(f=>({...f,paymentDetails:e.target.value}))} className={inp} placeholder="e.g. BTB BDO0951 2/26/2026 1,500.00" />
              </div>
              <div style={{ gridColumn:'span 2', display:'flex', justifyContent:'flex-end', gap:10, paddingTop:12, borderTop:'1px solid #f1f5f9', marginTop:4 }}>
                <button onClick={() => setShowForm(false)} style={{ padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:600, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151' }}>Cancel</button>
                <button onClick={saveForm} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:700, background:'#1e3a8a', color:'#fff', border:'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : editRow ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
