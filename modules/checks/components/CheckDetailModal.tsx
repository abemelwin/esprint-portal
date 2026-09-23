'use client';
/**
 * CheckDetailModal — full check detail view with event timeline and
 * quick-action buttons (hold, return, partial, settle, reconstruct, etc.)
 *
 * Ported from esprint-check-monitoring/components/CheckDetailModal.tsx.
 * Data-layer change:
 *   - Fetch check/events via GET /api/checks/[id] (portal RDS route).
 *   - Writes go to /api/checks/[id]/events and /api/checks/[id].
 *   - No Supabase, no useSharedAppData — caller does router.refresh() after saves.
 * UI, layout, and all behaviour identical to the original.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import StatusBadge from './StatusBadge';
import EventForm from './EventForm';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SelectField from './SelectField';
import { computeCheckStatus, compareEvents } from '../lib/computeStatus';
import {
  fmtPHP, fmtDate, fmtDateTime, displayUser, EVENT_LABELS, PAYMENT_FOR_OPTIONS,
} from '../lib/format';
import { canEdit, canDeleteCheck, type CheckPerms } from '../lib/permissions';
import type { Check, CheckEvent, BranchRow, Client, EventType, BankRow } from '../lib/database.types';

interface Props {
  checkId:  string;
  perms:    CheckPerms;
  userEmail: string;
  userName:  string;
  onClose:  () => void;
  /** Called after any write — caller should router.refresh(). */
  onSaved:  () => void;
  readOnly?: boolean;
}

interface PageData {
  check:    Check;
  events:   CheckEvent[];
  client:   Client | null;
  branches: BranchRow[];
  banks:    BankRow[];
}

const EVENT_DOT_BG: Record<string, string> = {
  HOLD_REQUEST:'#1e3a8a', RETURN:'#dc2626', PARTIAL_PAYMENT:'#d97706',
  DEPOSIT_CLEARED:'#059669', DEPOSITED:'#22c55e', ALTERATION:'#ea580c',
  LEGAL:'#7e22ce', RECONSTRUCT:'#4f46e5', REPLACEMENT:'#10b981',
  SETTLED_PAID:'#059669', CANCELLATION:'#6b7280', BAD_ACCOUNT:'#be123c', NOTE:'#94a3b8',
};

function eventDesc(ev: CheckEvent): string {
  switch (ev.type) {
    case 'HOLD_REQUEST':    return `Move deposit to ${fmtDate(ev.moveDate)}${ev.reason?` — ${ev.reason}`:''}`;
    case 'RETURN':          return ev.reason ? `Reason: ${ev.reason}` : '';
    case 'PARTIAL_PAYMENT': return `Method: ${ev.method??'—'}${ev.reference?` · Ref: ${ev.reference}`:''}`;
    case 'DEPOSIT_CLEARED': return 'Deposit cleared';
    case 'DEPOSITED':       return `Submitted for deposit${ev.reference?` · Ref: ${ev.reference}`:''}`;
    case 'ALTERATION':      return ev.reason ? `Alteration: ${ev.reason}` : 'Alteration flagged';
    case 'LEGAL':           return `Sent to legal${ev.reference?` · ${ev.reference}`:''}`;
    case 'RECONSTRUCT':     return [ev.reason,ev.reference?`Ref: ${ev.reference}`:''].filter(Boolean).join(' · ')||'Reconstruct';
    case 'REPLACEMENT':     return `Replaced via ${ev.method??'—'}${ev.reference?` · ${ev.reference}`:''}`;
    case 'SETTLED_PAID':    return `Settled Paid via ${ev.method??'—'}${ev.reference?` · ${ev.reference}`:''}${ev.amount?` · ${fmtPHP(ev.amount)}`:''}`;
    case 'CANCELLATION':    return ev.reason ? `Reason: ${ev.reason}` : 'Cancelled / written off';
    case 'BAD_ACCOUNT':     return ev.reason ? `Bad account: ${ev.reason}` : 'Flagged as bad account';
    default: return '';
  }
}

export default function CheckDetailModal({ checkId, perms, userEmail, userName, onClose, onSaved, readOnly }: Props) {
  const { showToast } = useToast();

  const [pd,           setPd]           = useState<PageData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [activeForm,   setActiveForm]   = useState<EventType | null>(null);
  const [activeMethodOptions, setActiveMethodOptions] = useState<string[] | undefined>();
  const [showEdit,     setShowEdit]     = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [isBankFocused, setIsBankFocused] = useState(false);
  const [confirmState, setConfirmState] = useState<{title:string;message:string;confirmText:string;onConfirm:()=>void}|null>(null);
  const [requestDeleteReason, setRequestDeleteReason] = useState('');
  const [showRequestDeleteModal, setShowRequestDeleteModal] = useState(false);
  const [editingEvent,   setEditingEvent]   = useState<CheckEvent | null>(null);
  const [savingEventEdit,setSavingEventEdit] = useState(false);
  const [deleteEventTarget, setDeleteEventTarget] = useState<CheckEvent | null>(null);
  const [deleteEventReason, setDeleteEventReason] = useState('');
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);

  // Move Partial Payment state
  const [movingEvent,      setMovingEvent]      = useState<CheckEvent | null>(null);
  const [moveSearch,       setMoveSearch]       = useState('');
  const [moveTargetId,     setMoveTargetId]     = useState('');
  const [movingInProgress, setMovingInProgress] = useState(false);
  const [allChecks,        setAllChecks]        = useState<Check[]>([]);
  const [allClients,       setAllClients]       = useState<Client[]>([]);

  const [editForm, setEditForm] = useState({
    bank:'', ae:'', paymentFor:'', paymentDescription:'', notes:'', checkNo:'', checkDate:'',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/checks/${checkId}`);
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Not found'); setLoading(false); return; }

      const check: Check    = json.check;
      const events: CheckEvent[] = json.events ?? [];
      const data = json.data ?? {};

      const client = (data.CLIENTS ?? []).find((c: Client) => c.code === check.client) ?? null;
      setAllChecks(data.CHECKS ?? []);
      setAllClients(data.CLIENTS ?? []);

      setPd({ check, events, client, branches: data.BRANCHES ?? [], banks: data.BANKS ?? [] });
      setEditForm({
        bank:               check.bank               ?? '',
        ae:                 check.ae                 ?? '',
        paymentFor:         check.paymentFor         ?? '',
        paymentDescription: check.paymentDescription ?? '',
        notes:              check.notes              ?? '',
        checkNo:            check.checkNo            ?? '',
        checkDate:          check.checkDate          ?? '',
      });
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [checkId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showEdit && !activeForm) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, showEdit, activeForm]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res  = await fetch(`/api/checks/${checkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank:               editForm.bank               || null,
        ae:                 editForm.ae                 || null,
        paymentFor:         editForm.paymentFor         || null,
        paymentDescription: editForm.paymentDescription || '',
        notes:              editForm.notes              || '',
        checkNo:            editForm.checkNo            || null,
        checkDate:          editForm.checkDate          || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      showToast('Check updated', 'success');
      setShowEdit(false);
      setTimeout(() => { fetchData(); onSaved(); }, 0);
    } else {
      showToast(json.error ?? 'Update failed', 'error');
    }
  }

  function handleDelete() {
    setConfirmState({
      title: 'Delete Check',
      message: 'Delete this check and all its events? This cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmState(null);
        setDeleting(true);
        const res  = await fetch(`/api/checks/${checkId}`, { method: 'DELETE' });
        const json = await res.json();
        setDeleting(false);
        if (json.ok) {
          showToast('Check deleted', 'success');
          onClose();
          onSaved();
        } else {
          showToast(json.error ?? 'Delete failed', 'error');
        }
      },
    });
  }

  async function submitRequestDelete() {
    const reason = requestDeleteReason.trim();
    if (!reason) return;
    setShowRequestDeleteModal(false);
    const res = await fetch(`/api/checks/${checkId}/request-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (json.ok) showToast('Delete request sent to Admin', 'success');
    else showToast(json.error ?? 'Failed to send request', 'error');
  }

  async function handleSaveEditEvent() {
    if (!editingEvent) return;
    setSavingEventEdit(true);
    const res = await fetch(`/api/checks/${checkId}/events`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId:   editingEvent.id,
        eventDate: editingEvent.eventDate,
        moveDate:  editingEvent.moveDate,
        reason:    editingEvent.reason,
        amount:    editingEvent.amount,
        notes:     editingEvent.notes,
        method:    editingEvent.method,
        reference: editingEvent.reference,
        editedBy:  userName,
      }),
    });
    const json = await res.json();
    setSavingEventEdit(false);
    if (json.ok) {
      showToast('Event updated', 'success');
      setEditingEvent(null);
      fetchData(); onSaved();
    } else {
      showToast(json.error ?? 'Update failed', 'error');
    }
  }

  async function handleDeleteEvent(ev: CheckEvent) {
    const isAdmin = canDeleteCheck(perms);
    if (isAdmin) {
      setConfirmState({
        title: 'Delete Event',
        message: `Delete this ${EVENT_LABELS[ev.type] ?? ev.type} event? This cannot be undone.`,
        confirmText: 'Delete',
        onConfirm: async () => {
          setConfirmState(null);
          const res = await fetch(`/api/checks/${checkId}/events`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: ev.id }),
          });
          const json = await res.json();
          if (json.ok) {
            showToast('Event deleted', 'success');
            setPd(p => p ? { ...p, events: p.events.filter(e => e.id !== ev.id) } : p);
            setTimeout(() => { fetchData(); onSaved(); }, 0);
          } else {
            showToast(json.error ?? 'Delete failed', 'error');
          }
        },
      });
    } else {
      setDeleteEventTarget(ev);
      setDeleteEventReason('');
      setShowDeleteEventModal(true);
    }
  }

  async function submitDeleteEventRequest() {
    if (!deleteEventTarget || !deleteEventReason.trim()) return;
    setShowDeleteEventModal(false);
    const res = await fetch(`/api/checks/${checkId}/request-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: `[EVENT] ${EVENT_LABELS[deleteEventTarget.type] ?? deleteEventTarget.type} — ${deleteEventReason.trim()}`,
        eventId: deleteEventTarget.id,
        targetType: 'event',
      }),
    });
    const json = await res.json();
    if (json.ok) showToast('Event delete request sent to Admin', 'success');
    else showToast(json.error ?? 'Failed to send request', 'error');
    setDeleteEventTarget(null);
  }

  async function handleMovePartial() {
    if (!movingEvent || !moveTargetId) return;
    setMovingInProgress(true);
    try {
      const res = await fetch(`/api/checks/${checkId}/move-partial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: movingEvent.id, targetCheckId: moveTargetId }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast(`Partial ₱${(movingEvent.amount ?? 0).toLocaleString('en-PH',{minimumFractionDigits:2})} moved successfully`, 'success');
        setMovingEvent(null); setMoveSearch(''); setMoveTargetId('');
        fetchData(); onSaved();
      } else {
        showToast(json.error ?? 'Move failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setMovingInProgress(false);
    }
  }

  if (typeof document === 'undefined') return null;

  const content = (() => {
    if (loading) return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="flex items-center gap-3"><div className="h-5 bg-gray-200 rounded w-2/3"/><div className="h-5 bg-gray-200 rounded-full w-16"/></div>
        <div className="h-3 bg-gray-100 rounded w-1/2"/>
        <div className="grid grid-cols-3 gap-3"><div className="h-20 bg-slate-100 rounded-xl"/><div className="h-20 bg-amber-50 rounded-xl"/><div className="h-20 bg-blue-50 rounded-xl"/></div>
        <div className="space-y-3 pt-4">{[...Array(4)].map((_,i)=><div key={i} className="h-3 bg-gray-100 rounded"/>)}</div>
      </div>
    );
    if (error) return <div className="p-6 text-red-600 text-sm text-center">Error: {error}</div>;
    if (!pd)   return null;

    const { check, events, client, branches, banks } = pd;
    const branchLabel = branches.find(b => b.id === check.branch)?.name ?? check.branch;
    const sortedEvs   = [...events].sort(compareEvents);
    const { status }  = computeCheckStatus(check, sortedEvs);

    const totalPartialPaid = Math.round(
      events.filter(e => ['PARTIAL_PAYMENT','REPLACEMENT','SETTLED_PAID'].includes(e.type))
        .reduce((s, e) => s + (e.amount ?? 0), 0) * 100) / 100;
    const currentBalance = Math.max(0, Math.round((check.originalAmount - totalPartialPaid) * 100) / 100);

    const userCanEdit   = readOnly ? false : canEdit(perms);
    const userCanDelete = readOnly ? false : canDeleteCheck(perms);

    const inp    = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400';
    const lbl    = 'block text-sm font-medium text-gray-700 mb-1';
    const selCls = inp + ' appearance-none pr-9 cursor-pointer';

    const QUICK_ACTIONS: { type: EventType; label: string; cls: string; methodOptions?: string[] }[] = [
      { type:'HOLD_REQUEST',    label:'+ Hold Request',    cls:'bg-blue-600 hover:bg-blue-700 text-white' },
      { type:'RETURN',          label:'+ Log Return',      cls:'bg-red-600 hover:bg-red-700 text-white' },
      { type:'PARTIAL_PAYMENT', label:'+ Partial Payment', cls:'bg-green-600 hover:bg-green-700 text-white' },
      { type:'DEPOSITED',       label:'Mark Deposited',    cls:'bg-sky-500 hover:bg-sky-600 text-white border border-sky-500' },
      { type:'DEPOSIT_CLEARED', label:'Mark Cleared',      cls:'bg-teal-500 hover:bg-teal-600 text-white border border-teal-500' },
      { type:'SETTLED_PAID',    label:'Settled Paid',      cls:'bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-500', methodOptions:['CASH','BANK TRANSFER (BTB)','GCASH','MAYA','CREDIT MEMO','OTHER'] },
      { type:'REPLACEMENT',     label:'Mark Replaced',     cls:'bg-lime-600 hover:bg-lime-700 text-white border border-lime-600',         methodOptions:['REPLACEMENT CHECK','OTHER'] },
      { type:'ALTERATION',      label:'Alteration',        cls:'bg-orange-500 hover:bg-orange-600 text-white border border-orange-500' },
      { type:'LEGAL',           label:'Legal',             cls:'bg-purple-600 hover:bg-purple-700 text-white border border-purple-600' },
      { type:'RECONSTRUCT',     label:'Reconstruct',       cls:'bg-indigo-500 hover:bg-indigo-600 text-white border border-indigo-500' },
      { type:'CANCELLATION',    label:'Cancel / Write-off',cls:'bg-gray-500 hover:bg-gray-600 text-white border border-gray-500' },
    ];

    return (
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{client?.name ?? check.client}</h1>
              <StatusBadge status={status} />
              {check.subsidiary && (
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wider">{check.subsidiary}</span>
              )}
              {check.paymentFor && (
                <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 rounded px-1.5 py-0.5 uppercase tracking-wider">{check.paymentFor}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-medium">
              {branchLabel} · AE {check.ae ?? '—'} · {check.bank} {check.checkNo} · {fmtDate(check.checkDate)} · Aging {
                (() => {
                  if (!check.checkDate) return '—';
                  const holds = sortedEvs.filter(e => e.type === 'HOLD_REQUEST' && e.moveDate);
                  const nextDeposit = holds.length ? holds[holds.length-1].moveDate : null;
                  const today = new Date().toISOString().slice(0, 10);
                  const ref = nextDeposit ?? today;
                  return Math.floor((new Date(ref).getTime() - new Date(check.checkDate).getTime()) / 86400000);
                })()
              }d
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Encoded by: <strong>{displayUser(check.createdBy)}</strong>
              {check.createdAt ? ` · ${fmtDateTime(check.createdAt)}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 text-xl font-semibold leading-none select-none shrink-0 ml-4">×</button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Balance Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Original amount</div>
              <div className="font-bold text-base text-gray-900">{fmtPHP(check.originalAmount)}</div>
            </div>
            <div className="p-3.5 bg-amber-50/50 border border-amber-100/50 rounded-xl">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Total partial paid</div>
              <div className="font-bold text-base text-amber-800">{fmtPHP(totalPartialPaid)}</div>
            </div>
            <div className="p-3.5 bg-blue-50/50 border border-blue-100/50 rounded-xl">
              <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Current balance</div>
              <div className="font-bold text-base text-blue-800">{fmtPHP(currentBalance)}</div>
            </div>
          </div>

          {/* Description & Notes */}
          {(check.paymentDescription || check.notes) && (
            <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-1.5">
              {check.paymentDescription && (
                <p className="text-xs text-gray-700"><strong className="text-gray-900">Payment description:</strong> {check.paymentDescription}</p>
              )}
              {check.notes && (
                <p className="text-xs italic text-gray-600 flex items-start gap-1"><span className="shrink-0">📝</span> {check.notes}</p>
              )}
            </div>
          )}

          {/* Edit / Delete + Quick-Action Buttons */}
          {userCanEdit && (
            <div className="space-y-3">
              <div className="flex gap-2 border-b border-gray-100 pb-3">
                <button onClick={() => setShowEdit(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm">
                  ✎ Edit Check
                </button>
                {userCanDelete ? (
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 shadow-sm ml-auto disabled:opacity-50">
                    {deleting ? 'Deleting…' : '🗑 Delete'}
                  </button>
                ) : (
                  <button onClick={() => { setRequestDeleteReason(''); setShowRequestDeleteModal(true); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 shadow-sm ml-auto">
                    📨 Request Delete
                  </button>
                )}
              </div>
              {!activeForm && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((a, i) => (
                    <button key={i} onClick={() => { setActiveForm(a.type); setActiveMethodOptions(a.methodOptions); }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm ${a.cls}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Event Form */}
          {activeForm && (
            <EventForm
              checkId={check.id}
              userEmail={userEmail}
              userName={userName}
              defaultType={activeForm}
              currentBalance={currentBalance}
              methodOptions={activeMethodOptions}
              onSaved={(ev) => {
                setActiveForm(null); setActiveMethodOptions(undefined);
                if (ev) setPd(p => p ? { ...p, events: [...p.events, ev] } : p);
                setTimeout(() => { fetchData(); onSaved(); }, 0);
              }}
              onCancel={() => { setActiveForm(null); setActiveMethodOptions(undefined); }}
            />
          )}

          {/* Event Timeline */}
          <div className="space-y-4">
            <h2 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
              Event timeline ({sortedEvs.length})
            </h2>
            {sortedEvs.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No events recorded yet.</p>
            ) : (
              <div className="relative pl-5 space-y-4">
                {sortedEvs.map((ev, idx) => {
                  const dotColor = EVENT_DOT_BG[ev.type] ?? '#9ca3af';
                  const isLast   = idx === sortedEvs.length - 1;
                  const desc     = eventDesc(ev);
                  const isEditing = editingEvent?.id === ev.id;
                  return (
                    <div key={ev.id} className="relative">
                      <span className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                        style={{ background: dotColor, boxShadow:`0 0 0 2px ${dotColor}33` }} />
                      {!isLast && <span className="absolute -left-[16px] top-4.5 bottom-[-16px] w-0.5 bg-gray-100" />}
                      <div className="text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{EVENT_LABELS[ev.type] ?? ev.type}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{fmtDate(ev.eventDate)}</span>
                          {ev.amount != null && <span className="font-mono text-xs text-gray-900 font-bold">{fmtPHP(ev.amount)}</span>}
                          {userCanEdit && !isEditing && (
                            <span className="ml-auto flex gap-1.5 shrink-0">
                              <button onClick={() => setEditingEvent({ ...ev })} className="text-[10px] font-semibold text-blue-600 hover:underline">Edit</button>
                              <button onClick={() => handleDeleteEvent(ev)} className="text-[10px] font-semibold text-red-500 hover:underline">Delete</button>
                            </span>
                          )}
                        </div>
                        {isEditing && editingEvent ? (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Event Date</label>
                                <input type="date" value={editingEvent.eventDate??''} onChange={e=>setEditingEvent({...editingEvent,eventDate:e.target.value})} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                              </div>
                              {ev.type === 'HOLD_REQUEST' && (
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Move Date</label>
                                  <input type="date" value={editingEvent.moveDate??''} onChange={e=>setEditingEvent({...editingEvent,moveDate:e.target.value})} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                                </div>
                              )}
                              {ev.reason != null && (
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Reason</label>
                                  <input value={editingEvent.reason??''} onChange={e=>setEditingEvent({...editingEvent,reason:e.target.value})} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                                </div>
                              )}
                              {ev.amount != null && (
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Amount</label>
                                  <input type="number" step="0.01" value={editingEvent.amount??''} onChange={e=>setEditingEvent({...editingEvent,amount:parseFloat(e.target.value)||undefined})} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Notes</label>
                              <input value={editingEvent.notes??''} onChange={e=>setEditingEvent({...editingEvent,notes:e.target.value})} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" placeholder="Notes..." />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingEvent(null)} className="text-[10px] font-semibold px-3 py-1 rounded-lg border border-gray-200 bg-white text-gray-600">Cancel</button>
                              <button onClick={handleSaveEditEvent} disabled={savingEventEdit} className="text-[10px] font-bold px-3 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-50">
                                {savingEventEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {desc && <div className="text-gray-600 mt-0.5" dangerouslySetInnerHTML={{ __html: desc.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>') }} />}
                            {ev.notes && <div className="italic text-gray-500 mt-0.5">📝 {ev.notes}</div>}
                          </>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">
                          Recorded by: <strong>{displayUser(ev.recordedBy)}</strong>
                          {ev.recordedAt ? ` · ${fmtDateTime(ev.recordedAt)}` : ''}
                        </div>
                        {/* Move button — only for PARTIAL_PAYMENT with positive amount */}
                        {userCanEdit && ev.type === 'PARTIAL_PAYMENT' && (ev.amount ?? 0) > 0 && !ev.reason?.startsWith('Moved partial') && !ev.reason?.startsWith('Received partial') && (
                          <button onClick={() => { setMovingEvent(ev); setMoveSearch(''); setMoveTargetId(''); }}
                            className="mt-1.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline">
                            ↗ Move to another check
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Move Partial Payment Modal */}
        {movingEvent && createPortal(
          <div className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMovingEvent(null)}>
            <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Move Partial Payment</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Moving <strong>{fmtPHP(movingEvent.amount ?? 0)}</strong> to another check</p>
                </div>
                <button onClick={() => setMovingEvent(null)} className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-lg leading-none">×</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Search target check (by check no. or client)</label>
                  <input autoFocus value={moveSearch} onChange={e => { setMoveSearch(e.target.value); setMoveTargetId(''); }}
                    placeholder="Type check no. or client code…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                {moveSearch.trim().length >= 2 && (() => {
                  const q = moveSearch.trim().toUpperCase();
                  const results = allChecks.filter(c => {
                    if (c.id === checkId) return false;
                    const clientName = allClients.find(cl => cl.code === c.client)?.name ?? '';
                    return c.checkNo.toUpperCase().includes(q) || c.client.toUpperCase().includes(q) || clientName.toUpperCase().includes(q);
                  }).slice(0, 8);
                  if (!results.length) return <p className="text-xs text-gray-400 italic text-center py-2">No checks found</p>;
                  return (
                    <ul className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 max-h-48 overflow-y-auto">
                      {results.map(c => {
                        const clientName = allClients.find(cl => cl.code === c.client)?.name ?? c.client;
                        const isSelected = moveTargetId === c.id;
                        return (
                          <li key={c.id}>
                            <button onClick={() => setMoveTargetId(c.id)}
                              className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-gray-700'}`}>
                              <div className="font-semibold">{c.checkNo} — {clientName}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">{c.client} · {c.bank} · {fmtPHP(c.originalAmount)}</div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setMovingEvent(null)} className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
                  <button onClick={handleMovePartial} disabled={!moveTargetId || movingInProgress}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
                    {movingInProgress ? 'Moving…' : `Move ${fmtPHP(movingEvent.amount ?? 0)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Check Modal */}
        {showEdit && createPortal(
          <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6 md:p-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.22)] w-full max-w-lg my-auto">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-gray-950">Edit Check</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">{check.bank} {check.checkNo}</p>
                </div>
                <button onClick={() => setShowEdit(false)} className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 text-lg leading-none">×</button>
              </div>
              <form onSubmit={handleEdit} noValidate className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Check #</label>
                    <input value={editForm.checkNo} onChange={e => setEditForm(f=>({...f,checkNo:e.target.value}))} className={inp} placeholder="Check number" />
                  </div>
                  <div>
                    <label className={lbl}>Check Date</label>
                    <input type="date" value={editForm.checkDate} onChange={e => setEditForm(f=>({...f,checkDate:e.target.value}))} className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Bank</label>
                    <SelectField value={editForm.bank} onChange={e=>setEditForm(f=>({...f,bank:e.target.value}))} cls={selCls}
                      onFocus={()=>setIsBankFocused(true)} onBlur={()=>setIsBankFocused(false)}>
                      <option value="">— Select —</option>
                      {banks.map(b=>(
                        <option key={b.code} value={b.code}>
                          {(!isBankFocused && editForm.bank===b.code) ? b.code : b.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className={lbl}>AE</label>
                    <input value={editForm.ae} onChange={e=>setEditForm(f=>({...f,ae:e.target.value}))} className={inp} placeholder="AE code" />
                  </div>
                  <div>
                    <label className={lbl}>Payment For</label>
                    <SelectField value={editForm.paymentFor} onChange={e=>setEditForm(f=>({...f,paymentFor:e.target.value}))} cls={selCls}>
                      <option value="">— Select —</option>
                      {PAYMENT_FOR_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
                    </SelectField>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Payment Description</label>
                  <input value={editForm.paymentDescription} onChange={e=>setEditForm(f=>({...f,paymentDescription:e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Notes</label>
                  <textarea value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} rows={2} className={inp} />
                </div>
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-900 disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  })();

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6 md:p-10 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-[20px] shadow-[0_25px_60px_rgba(15,23,42,0.18)] w-full max-w-3xl my-auto overflow-hidden">
        {content}
      </div>
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmText={confirmState?.confirmText ?? 'Confirm'}
        danger
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
      {/* Request Delete Modal */}
      {showRequestDeleteModal && createPortal(
        <div style={{ position:'fixed',inset:0,zIndex:100001,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}
          onClick={() => setShowRequestDeleteModal(false)}>
          <div style={{ background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:420 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div>
                <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:'#111827' }}>📨 Request Delete</h3>
                <p style={{ margin:'4px 0 0',fontSize:12,color:'#6b7280' }}>State the reason — Admin will review before deleting.</p>
              </div>
              <button onClick={() => setShowRequestDeleteModal(false)} style={{ background:'#f1f5f9',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:18,color:'#6b7280',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'16px 24px' }}>
              <label style={{ display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:6 }}>Reason <span style={{ color:'#ef4444' }}>*</span></label>
              <textarea autoFocus value={requestDeleteReason} onChange={e => setRequestDeleteReason(e.target.value)}
                placeholder="e.g. Duplicate entry, wrong check number…" rows={3}
                style={{ width:'100%',boxSizing:'border-box',border:'1px solid #d1d5db',borderRadius:10,padding:'9px 12px',fontSize:13,resize:'vertical',fontFamily:'inherit',color:'#1f2937',outline:'none',lineHeight:1.6 }}
                onKeyDown={e => { if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) submitRequestDelete(); }} />
              <p style={{ fontSize:11,color:'#9ca3af',marginTop:4 }}>Ctrl+Enter to submit</p>
            </div>
            <div style={{ padding:'12px 24px 16px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',gap:10 }}>
              <button onClick={() => setShowRequestDeleteModal(false)} style={{ padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',color:'#374151' }}>Cancel</button>
              <button onClick={submitRequestDelete} disabled={!requestDeleteReason.trim()}
                style={{ padding:'8px 18px',borderRadius:8,fontSize:13,fontWeight:700,border:'none',background:requestDeleteReason.trim()?'#b45309':'#fcd34d',color:requestDeleteReason.trim()?'#fff':'#92400e',cursor:requestDeleteReason.trim()?'pointer':'not-allowed' }}>
                Send Request
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Event Delete Request Modal */}
      {showDeleteEventModal && createPortal(
        <div style={{ position:'fixed',inset:0,zIndex:100001,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}
          onClick={() => setShowDeleteEventModal(false)}>
          <div style={{ background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:420 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div>
                <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:'#111827' }}>📨 Request Event Delete</h3>
                <p style={{ margin:'4px 0 0',fontSize:12,color:'#6b7280' }}>
                  {deleteEventTarget ? `${EVENT_LABELS[deleteEventTarget.type]??deleteEventTarget.type} — ${fmtDate(deleteEventTarget.eventDate)}` : ''}
                </p>
              </div>
              <button onClick={() => setShowDeleteEventModal(false)} style={{ background:'#f1f5f9',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:18,color:'#6b7280',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:'16px 24px' }}>
              <label style={{ display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:6 }}>Reason <span style={{ color:'#ef4444' }}>*</span></label>
              <textarea autoFocus value={deleteEventReason} onChange={e => setDeleteEventReason(e.target.value)}
                placeholder="e.g. Wrong date entered, duplicate event…" rows={3}
                style={{ width:'100%',boxSizing:'border-box',border:'1px solid #d1d5db',borderRadius:10,padding:'9px 12px',fontSize:13,resize:'vertical',fontFamily:'inherit',color:'#1f2937',outline:'none',lineHeight:1.6 }}
                onKeyDown={e => { if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) submitDeleteEventRequest(); }} />
              <p style={{ fontSize:11,color:'#9ca3af',marginTop:4 }}>Ctrl+Enter to submit</p>
            </div>
            <div style={{ padding:'12px 24px 16px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',gap:10 }}>
              <button onClick={() => setShowDeleteEventModal(false)} style={{ padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',color:'#374151' }}>Cancel</button>
              <button onClick={submitDeleteEventRequest} disabled={!deleteEventReason.trim()}
                style={{ padding:'8px 18px',borderRadius:8,fontSize:13,fontWeight:700,border:'none',background:deleteEventReason.trim()?'#b45309':'#fcd34d',color:deleteEventReason.trim()?'#fff':'#92400e',cursor:deleteEventReason.trim()?'pointer':'not-allowed' }}>
                Send Request
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}
