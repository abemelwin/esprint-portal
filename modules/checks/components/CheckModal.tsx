'use client';
/**
 * CheckModal — New Check / Edit Check form.
 *
 * Ported from esprint-check-monitoring/components/CheckModal.tsx.
 * Data-layer change: calls POST /api/checks (RDS) instead of the
 * Supabase `addCheck` server action. All UI and validation are
 * identical to the original.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './Toast';
import { PAYMENT_FOR_OPTIONS } from '../lib/format';
import { sanitizeDeep } from '../lib/sanitize';
import { useDraft } from '../hooks/useDraft';
import SelectField from './SelectField';
import type { AppData, Check } from '../lib/database.types';

interface Props {
  data:            AppData;
  userEmail:       string;
  /** Provide a check to open in edit mode; omit for New Check. */
  editCheck?:      Check | null;
  onClose:         () => void;
  /** Called after a successful save — caller should router.refresh(). */
  onSaved:         () => void;
  onCheckCreated?: (check: Check) => void;
}

const EMPTY = {
  clientCode: '', clientInput: '', branch: '', subsidiary: '',
  ae: '', bank: '', checkNo: '', checkDate: '',
  originalAmount: '', paymentFor: '', paymentDescription: '', notes: '',
};

type FormState = typeof EMPTY;

export default function CheckModal({ data, userEmail, editCheck, onClose, onSaved, onCheckCreated }: Props) {
  const { showToast } = useToast();
  const isEdit = !!editCheck;

  // Initialise form from editCheck when in edit mode
  function initForm(): FormState {
    if (!editCheck) return { ...EMPTY };
    const clientName = data.CLIENTS.find(c => c.code === editCheck.client)?.name ?? editCheck.client;
    return {
      clientCode:         editCheck.client,
      clientInput:        clientName,
      branch:             editCheck.branch ?? '',
      subsidiary:         editCheck.subsidiary ?? '',
      ae:                 editCheck.ae ?? '',
      bank:               editCheck.bank ?? '',
      checkNo:            editCheck.checkNo ?? '',
      checkDate:          editCheck.checkDate ?? '',
      originalAmount:     editCheck.originalAmount
        ? editCheck.originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '',
      paymentFor:         editCheck.paymentFor ?? '',
      paymentDescription: editCheck.paymentDescription ?? '',
      notes:              editCheck.notes ?? '',
    };
  }

  const [form, setForm]           = useState<FormState>(initForm);
  const [saving, setSaving]       = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState<typeof data.CLIENTS>([]);
  const [showSuggestions, setShowSuggestions]     = useState(false);
  const clientRef   = useRef<HTMLDivElement>(null);
  const [isBankFocused, setIsBankFocused]         = useState(false);
  const [showDraftBanner, setShowDraftBanner]     = useState(false);
  const [showConfirm, setShowConfirm]             = useState(false);

  // Draft auto-save (new check only — don't overwrite with edit form)
  const draftKey = isEdit ? `check-edit-${editCheck!.id}` : 'check-modal';
  const { hasDraft, restoreDraft, clearDraft } = useDraft(draftKey, form, setForm);

  useEffect(() => {
    if (!isEdit && hasDraft) setShowDraftBanner(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subsidiary → branch map
  const subBranchMap: Record<string, string[]> = {};
  for (const b of data.BRANCHES) {
    if (b.subsidiary) (subBranchMap[b.subsidiary] ??= []).push(b.id);
  }

  // Filter client suggestions
  useEffect(() => {
    const q = form.clientInput.trim().toLowerCase();
    if (!q) { setClientSuggestions([]); return; }
    setClientSuggestions(
      data.CLIENTS.filter(c =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      ).slice(0, 8)
    );
  }, [form.clientInput, data.CLIENTS]);

  // Auto-filter branch when subsidiary changes
  useEffect(() => {
    if (!form.subsidiary) return;
    const allowed = subBranchMap[form.subsidiary] ?? [];
    if (allowed.length === 1) setForm(f => ({ ...f, branch: allowed[0] }));
    else if (!allowed.includes(form.branch)) setForm(f => ({ ...f, branch: '' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.subsidiary]);

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectClient(cl: typeof data.CLIENTS[0]) {
    const branch = data.BRANCHES.find(b => b.id === cl.branch);
    setForm(f => ({
      ...f,
      clientCode:  cl.code,
      clientInput: cl.name,
      branch:      cl.branch ?? '',
      subsidiary:  branch?.subsidiary ?? '',
      ae:          cl.ae ?? '',
    }));
    setShowSuggestions(false);
  }

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setForm(f => ({ ...f, originalAmount: parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0] }));
  }

  function handleAmountFocus(e: React.FocusEvent<HTMLInputElement>) {
    const num = parseFloat(e.target.value.replace(/,/g, ''));
    setForm(f => ({ ...f, originalAmount: (!isNaN(num) && num !== 0) ? String(num) : '' }));
  }

  function handleAmountBlur(e: React.FocusEvent<HTMLInputElement>) {
    const num = parseFloat(e.target.value.replace(/,/g, ''));
    setForm(f => ({
      ...f,
      originalAmount: !isNaN(num)
        ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let resolvedClientCode = form.clientCode;
    if (!resolvedClientCode && form.clientInput.trim()) {
      const exact = data.CLIENTS.find(c =>
        c.name.trim().toLowerCase() === form.clientInput.trim().toLowerCase()
      );
      if (exact) { resolvedClientCode = exact.code; setForm(f => ({ ...f, clientCode: exact.code })); }
    }

    if (!resolvedClientCode)   { showToast('Please select a client from the dropdown', 'error'); return; }
    if (!form.checkNo.trim())  { showToast('Check number is required', 'error'); return; }
    const amt = parseFloat(form.originalAmount.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!form.bank)            { showToast('Bank is required', 'error'); return; }
    if (!form.checkDate)       { showToast('Check date is required', 'error'); return; }
    if (!form.paymentFor)      { showToast('Payment For is required', 'error'); return; }

    // Duplicate detection (new check only)
    if (!isEdit) {
      const isDuplicate = data.CHECKS.some(c =>
        c.branch === (form.branch || null) &&
        (c.bank ?? '').toUpperCase() === (form.bank ?? '').toUpperCase() &&
        c.checkNo.trim().toLowerCase() === form.checkNo.trim().toLowerCase()
      );
      if (isDuplicate) {
        showToast(`A check with ${form.bank} ${form.checkNo.trim()} in this branch already exists.`, 'error');
        return;
      }
    }

    setShowConfirm(true);
  }

  async function doSave() {
    setShowConfirm(false);
    const amt = parseFloat(form.originalAmount.replace(/,/g, ''));

    const payload = sanitizeDeep({
      ...(isEdit ? { id: editCheck!.id } : {}),
      client:             form.clientCode,
      branch:             form.branch            || null,
      subsidiary:         form.subsidiary        || null,
      ae:                 form.ae                || null,
      bank:               form.bank              || null,
      checkNo:            form.checkNo.trim(),
      checkDate:          form.checkDate         || null,
      originalAmount:     amt,
      paymentFor:         form.paymentFor        || null,
      paymentDescription: form.paymentDescription,
      notes:              form.notes,
      finalStatus:        null,
      replacementOf:      null,
    });

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/checks/${editCheck!.id}` : '/api/checks',
        {
          method:  isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error ?? 'Save failed', 'error');
      } else {
        showToast(isEdit ? 'Check updated' : 'Check saved successfully', 'success');
        clearDraft();
        if (!isEdit && json.check && onCheckCreated) {
          onCheckCreated(json.check);
        }
        onSaved();
        onClose();
      }
    } catch {
      showToast('Network error — please try again', 'error');
    } finally {
      setSaving(false);
    }
  }

  const visibleBranches = form.subsidiary
    ? data.BRANCHES.filter(b => (subBranchMap[form.subsidiary] ?? []).includes(b.id))
    : data.BRANCHES;

  const inp    = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400';
  const selCls = inp + ' appearance-none pr-9 cursor-pointer';
  const lbl    = 'block text-sm font-medium text-gray-700 mb-1';

  return createPortal(
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(15,23,42,0.45)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 16px 32px', pointerEvents: 'none' }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.06)', width: '100%', maxWidth: 560, marginBottom: 32, pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{isEdit ? 'Edit Check' : 'New Check'}</h2>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">

            {/* Draft restore banner */}
            {showDraftBanner && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs">
                <span className="text-amber-800 font-semibold">📝 You have an unsaved draft. Restore it?</span>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => { restoreDraft(); setShowDraftBanner(false); }}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600">Restore</button>
                  <button type="button" onClick={() => { clearDraft(); setShowDraftBanner(false); }}
                    className="px-3 py-1 rounded-lg border border-amber-300 text-amber-700 font-semibold hover:bg-amber-100">Discard</button>
                </div>
              </div>
            )}

            {/* Row 1: Subsidiary + Branch */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Subsidiary <span className="text-red-500">*</span></label>
                <SelectField value={form.subsidiary} onChange={set('subsidiary')} cls={selCls}>
                  <option value="">— select —</option>
                  {data.SUBSIDIARIES.map(s => <option key={s} value={s}>{s}</option>)}
                </SelectField>
              </div>
              <div>
                <label className={lbl}>Branch <span className="text-red-500">*</span></label>
                <SelectField value={form.branch} onChange={set('branch')} cls={selCls}>
                  <option value="">— select —</option>
                  {visibleBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SelectField>
              </div>
            </div>

            {/* Row 2: Client typeahead */}
            <div ref={clientRef} className="relative">
              <label className={lbl}>Client <span className="text-red-500">*</span> <span className="text-gray-400 font-normal text-xs">(Type to search)</span></label>
              <input
                type="text"
                value={form.clientInput}
                onChange={e => { setForm(f => ({ ...f, clientInput: e.target.value, clientCode: '' })); setShowSuggestions(true); }}
                onFocus={() => form.clientInput && setShowSuggestions(true)}
                className={inp}
                placeholder="Start typing a client name…"
                autoComplete="off"
              />
              {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {clientSuggestions.map(cl => (
                    <button key={cl.code} type="button" onMouseDown={() => selectClient(cl)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">{cl.name}</span>
                      <span className="text-xs text-gray-400 font-mono shrink-0">{cl.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 3: AE + Payment For */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>AE <span className="text-gray-400 font-normal text-xs">(searchable)</span></label>
                <input list="modal-ae-list" value={form.ae} onChange={set('ae')} className={inp} placeholder="type to search…" autoComplete="off" />
                <datalist id="modal-ae-list">
                  {data.AE_LIST.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div>
                <label className={lbl}>Payment For <span className="text-red-500">*</span></label>
                <SelectField
                  value={form.paymentFor} onChange={set('paymentFor')}
                  cls={form.paymentFor?.toLowerCase() === 'others'
                    ? selCls.replace('border-gray-300', 'border-amber-400') + ' bg-amber-50 text-amber-800 font-semibold'
                    : selCls}
                >
                  <option value="">— select —</option>
                  {PAYMENT_FOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </SelectField>
                {form.paymentFor?.toLowerCase() === 'others' && (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">⚠ Please specify in Payment Description</p>
                )}
              </div>
            </div>

            {/* Row 4: Bank + Check Number */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Bank <span className="text-red-500">*</span></label>
                <SelectField value={form.bank} onChange={set('bank')} cls={selCls}
                  onFocus={() => setIsBankFocused(true)} onBlur={() => setIsBankFocused(false)}>
                  <option value="">— select —</option>
                  {data.BANKS.map(b => (
                    <option key={b.code} value={b.code}>
                      {(!isBankFocused && form.bank === b.code) ? b.code : b.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <label className={lbl}>Check Number <span className="text-red-500">*</span></label>
                <input type="text" value={form.checkNo} onChange={set('checkNo')} className={inp} placeholder="e.g. 0001234" />
              </div>
            </div>

            {/* Row 5: Check Date */}
            <div>
              <label className={lbl}>Check Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.checkDate} onChange={set('checkDate')} className={inp} />
            </div>

            {/* Row 6: Amount */}
            <div>
              <label className={lbl}>Check Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₱</span>
                <input type="text" inputMode="decimal" value={form.originalAmount}
                  onChange={handleAmountChange} onFocus={handleAmountFocus} onBlur={handleAmountBlur}
                  className={inp + ' pl-7'} placeholder="0.00" />
              </div>
            </div>

            {/* Row 7: Payment Description */}
            <div>
              <label className={lbl}>Payment Description</label>
              <input type="text" value={form.paymentDescription} onChange={set('paymentDescription')}
                className={inp} placeholder="e.g. Monthly amortization for HOMER machine" />
            </div>

            {/* Row 8: Notes */}
            <div>
              <label className={lbl}>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2}
                className={inp} placeholder="Any additional notes…" />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-800 disabled:opacity-60">
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Check'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Confirm Check Details</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Please verify the information below before saving.</p>
            </div>
            <div style={{ padding: '16px 24px' }} className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Client</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{form.clientInput}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">AE</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{form.ae || '—'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Subsidiary</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{form.subsidiary || '—'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Branch</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{(data.BRANCHES.find(b => b.id === form.branch)?.name ?? form.branch) || '—'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Bank / Check #</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{form.bank} {form.checkNo}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Check Date</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{form.checkDate || '—'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Amount</span>
                  <p className="font-bold text-blue-700 mt-0.5">₱{form.originalAmount}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Payment For</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{form.paymentFor || '—'}</p>
                </div>
              </div>
              {form.paymentDescription && (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Description</span>
                  <p className="text-gray-700 mt-0.5">{form.paymentDescription}</p>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 24px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
                ← Go Back
              </button>
              <button onClick={doSave}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700">
                ✓ Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
