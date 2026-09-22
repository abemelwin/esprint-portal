'use client';
/**
 * EventForm — records a new event on a check (hold, return, partial,
 * settle, reconstruct, etc.)
 *
 * Ported from esprint-check-monitoring/components/EventForm.tsx.
 * Data-layer change: calls POST /api/checks/[id]/events instead of
 * Supabase addEvent. All UI, validation, and behaviour identical.
 */
import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { RETURN_REASONS, PAYMENT_METHODS, todayISO } from '../lib/format';
import { sanitizeDeep } from '../lib/sanitize';
import { useDraft } from '../hooks/useDraft';
import type { EventType, CheckEvent } from '../lib/database.types';
import SelectField from './SelectField';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'HOLD_REQUEST',    label: 'Hold Request' },
  { value: 'RETURN',          label: 'Return' },
  { value: 'PARTIAL_PAYMENT', label: 'Partial Payment' },
  { value: 'SETTLED_PAID',    label: 'Settled Paid' },
  { value: 'DEPOSITED',       label: 'Deposited' },
  { value: 'DEPOSIT_CLEARED', label: 'Deposit Cleared' },
  { value: 'REPLACEMENT',     label: 'Replacement' },
  { value: 'CANCELLATION',    label: 'Cancellation' },
  { value: 'ALTERATION',      label: 'Alteration' },
  { value: 'LEGAL',           label: 'Legal Action' },
  { value: 'RECONSTRUCT',     label: 'Reconstruct' },
  { value: 'BAD_ACCOUNT',     label: 'Bad Account' },
];

const CANCELLATION_REASONS = ['PAID IN FULL','REPLACED','AGREEMENT CANCELLED','DOUBLE ENTRY','BLACKLIST','OTHER'];
const LEGAL_TYPES = ['DEMAND LETTER','FILED IN COURT','BARANGAY MEDIATION','NBI COMPLAINT','OTHER'];

const TITLES: Record<EventType, string> = {
  HOLD_REQUEST:    'New Hold Request',
  RETURN:          'Log Returned Check',
  PARTIAL_PAYMENT: 'Record Partial Payment',
  SETTLED_PAID:    'Record Settled Paid',
  DEPOSIT_CLEARED: 'Mark Check as Cleared',
  DEPOSITED:       'Mark Check as Deposited',
  ALTERATION:      'Flag — Alteration',
  LEGAL:           'Send to Legal',
  RECONSTRUCT:     'Mark for Reconstruct',
  REPLACEMENT:     'Mark as Replaced',
  CANCELLATION:    'Write-off / Blacklist',
  BAD_ACCOUNT:     'Flag — Bad Account',
  NOTE:            'Add Note',
};

interface Props {
  checkId:         string;
  userEmail:       string;
  userName?:       string;
  defaultType?:    EventType;
  currentBalance?: number;
  methodOptions?:  string[];
  onSaved:         (ev?: CheckEvent) => void;
  onCancel:        () => void;
}

export default function EventForm({
  checkId, userEmail, userName, defaultType, currentBalance = 0, methodOptions, onSaved, onCancel,
}: Props) {
  const { showToast } = useToast();
  const [type,       setType]       = useState<EventType>(defaultType ?? 'HOLD_REQUEST');
  const [eventDate,  setEventDate]  = useState(todayISO());
  const [moveDate,   setMoveDate]   = useState('');
  const [redepDate,  setRedepDate]  = useState('');
  const [reason,     setReason]     = useState('');
  const [method,     setMethod]     = useState('');
  const [reference,  setReference]  = useState('');
  const [amount,     setAmount]     = useState(
    currentBalance > 0
      ? currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''
  );
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const draftForm = { type, eventDate, moveDate, redepDate, reason, method, reference, amount, notes };
  const setDraftForm = (f: typeof draftForm) => {
    setType(f.type as EventType); setEventDate(f.eventDate); setMoveDate(f.moveDate);
    setRedepDate(f.redepDate); setReason(f.reason); setMethod(f.method);
    setReference(f.reference); setAmount(f.amount); setNotes(f.notes);
  };
  const draftKey = `event-form-${checkId}${defaultType ? `-${defaultType}` : ''}`;
  const { hasDraft, restoreDraft, clearDraft } = useDraft(draftKey, draftForm, setDraftForm);

  useEffect(() => {
    if (hasDraft) setShowDraftBanner(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTypeChange(t: EventType) {
    setType(t); setReason(''); setMethod(''); setMoveDate('');
    if (['PARTIAL_PAYMENT','SETTLED_PAID','REPLACEMENT','DEPOSIT_CLEARED','DEPOSITED','RETURN'].includes(t)) {
      setAmount(currentBalance > 0
        ? currentBalance.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
        : '');
    }
  }

  const showMoveDate     = type === 'HOLD_REQUEST';
  const showRedepDate    = type === 'RETURN';
  const showReturnReason = type === 'RETURN';
  const showCancelReason = type === 'CANCELLATION';
  const showLegalType    = type === 'LEGAL';
  const showMethod       = type === 'PARTIAL_PAYMENT' || type === 'SETTLED_PAID' || type === 'REPLACEMENT';
  const showAmount       = ['PARTIAL_PAYMENT','SETTLED_PAID','REPLACEMENT','DEPOSIT_CLEARED','DEPOSITED','RETURN'].includes(type);
  const showReference    = ['PARTIAL_PAYMENT','SETTLED_PAID','REPLACEMENT','DEPOSITED','DEPOSIT_CLEARED','LEGAL','RECONSTRUCT'].includes(type);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setAmount(parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0]);
  }
  function handleAmountFocus(e: React.FocusEvent<HTMLInputElement>) {
    const num = parseFloat(e.target.value.replace(/,/g, ''));
    setAmount((!isNaN(num) && num !== 0) ? String(num) : '');
  }
  function handleAmountBlur(e: React.FocusEvent<HTMLInputElement>) {
    const num = parseFloat(e.target.value.replace(/,/g, ''));
    setAmount(!isNaN(num)
      ? num.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
      : '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (['PARTIAL_PAYMENT','SETTLED_PAID','REPLACEMENT'].includes(type)) {
      const enteredAmt = amount ? parseFloat(amount.replace(/,/g, '')) : 0;
      if (isNaN(enteredAmt) || enteredAmt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      if (enteredAmt > currentBalance) {
        showToast(
          `Amount (₱${enteredAmt.toLocaleString('en-PH',{minimumFractionDigits:2})}) exceeds the current balance (₱${currentBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}).`,
          'error'
        );
        return;
      }
    }

    const recordedBy = userName || userEmail;
    const payload = sanitizeDeep({
      type,
      eventDate:  eventDate  || null,
      moveDate:   moveDate   || null,
      reason:     reason     || null,
      method:     method     || null,
      reference:  reference  || null,
      amount:     amount ? parseFloat(amount.replace(/,/g, '')) : undefined,
      notes:      notes || '',
      recordedBy,
    });

    setSaving(true);
    try {
      // Main event
      const res  = await fetch(`/api/checks/${checkId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(json.error ?? 'Failed to save event', 'error');
        setSaving(false);
        return;
      }

      // RETURN + redeposit date → auto-create follow-up HOLD_REQUEST
      if (type === 'RETURN' && redepDate) {
        await fetch(`/api/checks/${checkId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizeDeep({
            type: 'HOLD_REQUEST',
            eventDate:  eventDate || null,
            moveDate:   redepDate,
            reason:     `Redeposit after return — ${reason || ''}`.trim(),
            notes:      '',
            recordedBy,
          })),
        });
      }

      showToast('Event saved successfully.', 'success');
      clearDraft();
      onSaved(json.event as CheckEvent | undefined);
    } catch {
      showToast('Network error — please try again', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inp    = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400';
  const lbl    = 'block text-sm font-medium text-gray-700 mb-1';
  const selCls = inp + ' appearance-none pr-9 cursor-pointer';

  return (
    <div className="bg-white border border-slate-200 rounded-[28px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">{TITLES[type]}</h2>
          {currentBalance > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Current balance: {new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(currentBalance)}
            </p>
          )}
        </div>
        <button type="button" onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 text-lg leading-none">×</button>
      </div>

      {/* Draft restore banner */}
      {showDraftBanner && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs mb-4">
          <span className="text-amber-800 font-semibold">📝 You have an unsaved draft. Restore it?</span>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => { restoreDraft(); setShowDraftBanner(false); }}
              className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600">Restore</button>
            <button type="button" onClick={() => { clearDraft(); setShowDraftBanner(false); }}
              className="px-3 py-1 rounded-lg border border-amber-300 text-amber-700 font-semibold hover:bg-amber-100">Discard</button>
          </div>
        </div>
      )}

      {/* Type selector (shown only when no defaultType) */}
      {!defaultType && (
        <div className="mb-4">
          <label className={lbl}>Event Type <span className="text-red-500">*</span></label>
          <SelectField value={type} onChange={e => handleTypeChange(e.target.value as EventType)} cls={selCls}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectField>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Event Date */}
        <div>
          <label className={lbl}>
            {type==='HOLD_REQUEST'?'Request date':type==='RETURN'?'Return / deposit date':
             type==='PARTIAL_PAYMENT'?'Payment date':type==='DEPOSIT_CLEARED'?'Cleared date':
             type==='DEPOSITED'?'Deposit date':type==='ALTERATION'?'Flagged date':
             type==='LEGAL'?'Sent to legal on':type==='RECONSTRUCT'?'Reconstruct date':
             type==='CANCELLATION'?'Cancellation date':'Replacement date'} *
          </label>
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className={inp} required />
        </div>

        {showMoveDate && (
          <div>
            <label className={lbl}>New deposit / move date</label>
            <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} className={inp} />
          </div>
        )}

        {showReturnReason && (
          <div>
            <label className={lbl}>Reason *</label>
            <SelectField value={reason} onChange={e => setReason(e.target.value)} cls={selCls}>
              <option value="">— Select reason —</option>
              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </SelectField>
          </div>
        )}

        {type === 'RETURN' && (
          <div>
            <label className={lbl}>Returned amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
              <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={inp+' pl-6'} placeholder="0.00" />
            </div>
          </div>
        )}

        {showRedepDate && (
          <div className="col-span-2">
            <label className={lbl}>Redeposit date <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="date" value={redepDate} onChange={e => setRedepDate(e.target.value)} className={inp} />
            <p className="text-xs text-gray-400 mt-1">If set, a follow-up hold request is auto-logged for this date.</p>
          </div>
        )}

        {showCancelReason && (
          <div>
            <label className={lbl}>Reason *</label>
            <SelectField value={reason} onChange={e => setReason(e.target.value)} cls={selCls}>
              <option value="">— Select reason —</option>
              {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </SelectField>
          </div>
        )}

        {showLegalType && (
          <div>
            <label className={lbl}>Legal action type *</label>
            <SelectField value={reason} onChange={e => setReason(e.target.value)} cls={selCls}>
              <option value="">— Select type —</option>
              {LEGAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </SelectField>
          </div>
        )}
        {type === 'LEGAL' && (
          <div>
            <label className={lbl}>Case ref / handler</label>
            <input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} className={inp}
              placeholder="e.g. ATTY. CRUZ / CASE 2026-CV-014" style={{ textTransform:'uppercase' }} />
          </div>
        )}

        {type === 'ALTERATION' && (
          <div>
            <label className={lbl}>Alteration detail</label>
            <input value={reason} onChange={e => setReason(e.target.value.toUpperCase())} className={inp}
              placeholder="E.G. DATE ALTERED, AMOUNT MISMATCH" style={{ textTransform:'uppercase' }} />
          </div>
        )}

        {type === 'RECONSTRUCT' && (
          <>
            <div>
              <label className={lbl}>Reconstruct ref</label>
              <input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} className={inp}
                placeholder="RECONSTRUCT PLAN REF" style={{ textTransform:'uppercase' }} />
            </div>
            <div>
              <label className={lbl}>Next deposit date</label>
              <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Plan summary</label>
              <input value={reason} onChange={e => setReason(e.target.value.toUpperCase())} className={inp}
                placeholder="MONTHLY TRANCHE × N, ETC." style={{ textTransform:'uppercase' }} />
            </div>
          </>
        )}

        {type === 'BAD_ACCOUNT' && (
          <div>
            <label className={lbl}>Reason / Remarks</label>
            <input value={reason} onChange={e => setReason(e.target.value.toUpperCase())} className={inp}
              placeholder="e.g. NON-RESPONSIVE, DEMAND LETTER SENT" style={{ textTransform:'uppercase' }} />
          </div>
        )}

        {showMethod && (
          <div>
            <label className={lbl}>
              {type==='REPLACEMENT'?'Replacement method':type==='SETTLED_PAID'?'Payment method *':'Method *'}
            </label>
            <SelectField value={method} onChange={e => setMethod(e.target.value)} cls={selCls}>
              <option value="">— Select method —</option>
              {(methodOptions || PAYMENT_METHODS).map(m => <option key={m} value={m}>{m}</option>)}
            </SelectField>
          </div>
        )}

        {showAmount && type !== 'RETURN' && (
          <div>
            <label className={lbl}>
              {type==='REPLACEMENT'?'Amount':type==='PARTIAL_PAYMENT'?'Amount *':'Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
              <input type="text" inputMode="decimal" value={amount}
                onChange={handleAmountChange} onFocus={handleAmountFocus} onBlur={handleAmountBlur}
                className={inp+' pl-6'} placeholder="0.00" />
            </div>
            {type === 'PARTIAL_PAYMENT' && currentBalance > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Current balance: ₱{currentBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}
              </p>
            )}
          </div>
        )}

        {showReference && type !== 'LEGAL' && type !== 'RECONSTRUCT' && (
          <div>
            <label className={lbl}>
              {type==='REPLACEMENT'?'Reference (new check #, OR, etc.)':
               type==='PARTIAL_PAYMENT'?'Reference / OR No.':'Reference / slip no.'}
            </label>
            <input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} className={inp}
              placeholder={type==='PARTIAL_PAYMENT'?'OR-44218 / BTB-BDO-7782…':'BANK DEPOSIT SLIP / OR NO.'}
              style={{ textTransform:'uppercase' }} />
          </div>
        )}

        <div className="col-span-2">
          <label className={lbl}>{type === 'RETURN' ? 'Update' : 'Notes'}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value.toUpperCase())} rows={2} className={inp}
            style={{ textTransform:'uppercase' }}
            placeholder={type==='RETURN'?'E.G. CLIENT PROMISED TO REPLACE BY JULY 10…':'ANY ADDITIONAL NOTES…'} />
          {type === 'RETURN' && (
            <p className="text-xs text-gray-400 mt-1">This will appear as the latest update in the All Checks table.</p>
          )}
        </div>

        <div className="col-span-1 md:col-span-2 flex flex-wrap justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-800 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save event'}
          </button>
        </div>
      </form>
    </div>
  );
}
