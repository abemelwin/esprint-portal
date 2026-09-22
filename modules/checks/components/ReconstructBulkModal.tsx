'use client';
/**
 * ReconstructBulkModal — bulk reconstruct (file upload → preview → submit)
 * and bulk schedule payment.
 *
 * Ported from esprint-check-monitoring/components/ReconstructBulkModal.tsx.
 * Data-layer change: calls POST /api/checks/reconstruct-bulk (RDS route).
 * UI, file-parsing logic, and behaviour identical to the original.
 */
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

export interface SelectedCheck {
  id:             string;
  client:         string;
  bank:           string | null;
  checkNo:        string;
  checkDate:      string | null;
  originalAmount: number;
  clientName:     string;
  branch:         string;
  subsidiary:     string | null;
  ae:             string | null;
  paymentFor:     string | null;
  status:         string;
}

interface FileRow {
  bank:            string;
  checkNo:         string;
  checkDate:       string;
  originalAmount:  number;
  nextDeposit?:    string;
}

interface ScheduleRow {
  scheduleDate:         string;
  monthlyAmortization:  number;
  amount:               number;
  paymentDetails:       string;
}

interface Props {
  selectedChecks: SelectedCheck[];
  userEmail:      string;
  userName:       string;
  onClose:        () => void;
  onSuccess:      (result: { replaced: number; created: number }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normaliseDate(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) {
    const parts = s.split(/[\/\-]/);
    const m = parts[0].padStart(2, '0');
    const d = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    return `${y}-${m}-${d}`;
  }
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(s)) {
    const MO: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const [dd, mon, yy] = s.split('-');
    return `${yy}-${MO[mon.toLowerCase()]??'01'}-${dd.padStart(2,'0')}`;
  }
  return s;
}

function parseReconstructFile(text: string): { rows: FileRow[]; error: string } {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows:[], error:'File appears empty.' };
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  function split(line: string): string[] {
    if (delimiter === '\t') return line.split('\t').map(s=>s.trim());
    const result: string[] = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur=''; } else cur+=ch;
    }
    result.push(cur.trim()); return result;
  }
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length,6); i++) { if (/check|bank|date|amount/i.test(lines[i])) { headerIdx=i; break; } }
  const headers = split(lines[headerIdx]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,''));
  function findCol(...names: string[]): number {
    for (const n of names) { const e=headers.findIndex(h=>h===n); if(e!==-1)return e; }
    for (const n of names) { const p=headers.findIndex(h=>h.includes(n)); if(p!==-1)return p; }
    return -1;
  }
  const colCombined = findCol('checknumber','checknum','checkno');
  const colCheck    = colCombined!==-1?colCombined:headers.findIndex(h=>h.includes('check')&&!h.includes('date'));
  const colBankSep  = findCol('bank');
  const colDate     = findCol('checkdate','chkdate','date');
  const colAmt      = (()=>{ for(const n of['originalamount','original','amount','amt']){const idx=headers.findIndex(h=>h.includes(n)&&!h.includes('balance'));if(idx!==-1)return idx;} return -1; })();
  const colNextDep  = findCol('nextdeposit','nextdep','deposit');
  if (colCheck===-1 && colBankSep===-1) return { rows:[], error:'Cannot find "CHECK Number" or "Bank" column.' };
  const rows: FileRow[] = [];
  for (let i = headerIdx+1; i < lines.length; i++) {
    const cells = split(lines[i]); if (cells.every(c=>!c)) continue;
    let bank='', checkNo='';
    if (colCheck!==-1) {
      const raw=(cells[colCheck]??'').trim();
      const h=raw.indexOf('-');
      if (h>0&&h<=5&&/^[A-Za-z]+$/.test(raw.slice(0,h))) { bank=raw.slice(0,h).toUpperCase(); checkNo=raw.slice(h+1); } else checkNo=raw;
    }
    if (colBankSep!==-1&&(cells[colBankSep]??'').trim()) bank=(cells[colBankSep]??'').trim().toUpperCase();
    if (!checkNo) continue;
    const checkDate      = normaliseDate((colDate>=0?(cells[colDate]??''):'').trim());
    const originalAmount = parseFloat(((colAmt>=0?(cells[colAmt]??''):'')).trim().replace(/[₱$,\s]/g,''))||0;
    const nextDeposit    = colNextDep>=0&&(cells[colNextDep]??'').trim() ? normaliseDate((cells[colNextDep]??'').trim()) : undefined;
    rows.push({ bank, checkNo, checkDate, originalAmount, nextDeposit });
  }
  if (!rows.length) return { rows:[], error:'No valid rows found.' };
  return { rows, error:'' };
}

function parseScheduleFile(text: string): { rows: ScheduleRow[]; error: string } {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows:[], error:'File appears empty.' };
  const delimiter = lines[0].includes('\t')?'\t':',';
  const split = (line: string) => delimiter==='\t'?line.split('\t').map(s=>s.trim()):line.split(',').map(s=>s.trim());
  const headers = split(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,''));
  const colDate    = headers.findIndex(h=>h.includes('date'));
  const colPayAmt  = headers.findIndex(h=>h.includes('paymentamount'));
  const colAmt     = colPayAmt!==-1?colPayAmt:headers.findIndex(h=>h.includes('amount')||h.includes('amt'));
  const colDetails = headers.findIndex(h=>h.includes('paymentdetail')||h.includes('detail')||h.includes('method')||h.includes('remark'));
  const colMA      = headers.findIndex(h=>h==='ma'||h.includes('monthlyamort')||h.includes('amortization'));
  if (colDate===-1||colAmt===-1) return { rows:[], error:'Need at least "Date" and "Payment Amount" (or "Amount") columns.' };
  const rows: ScheduleRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const rawDate = (cells[colDate]??'').trim();
    const rawAmt  = (cells[colAmt]??'').trim();
    if (!rawDate && !rawAmt) continue;
    const amount = parseFloat(rawAmt.replace(/[₱$,\s]/g,''))||0;
    const scheduleDate  = normaliseDate(rawDate);
    const paymentDetails = colDetails>=0?(cells[colDetails]??'').trim():'';
    const monthlyAmortization = colMA>=0?parseFloat(((cells[colMA]??'').trim()).replace(/[₱$,\s]/g,''))||0:0;
    rows.push({ scheduleDate, monthlyAmortization, amount, paymentDetails });
  }
  if (!rows.length) return { rows:[], error:'No valid rows found.' };
  return { rows, error:'' };
}

function fmtAmt(n: number) { return '₱'+n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDt(d: string|null|undefined) {
  if (!d) return '—';
  const dt = new Date(d+'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
}
const S = {
  th: { padding:'8px 10px',fontWeight:700,color:'#6b7280',whiteSpace:'nowrap' } as React.CSSProperties,
  td: { padding:'7px 10px',whiteSpace:'nowrap' } as React.CSSProperties,
};

const BLOCKED = ['RECON REPLACED','RECON REPLACEMENT','CLEARED','DEPOSITED','SETTLED (PAID)','REPLACED','CANCELLED'];
const PAYMENT_FOR_OPTS = ['MACHINE','CONS','PARTS','OTHERS','RECONSTRUCT BALANCE'];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReconstructBulkModal({ selectedChecks, userEmail, userName, onClose, onSuccess }: Props) {
  const [mode,       setMode]       = useState<'reconstruct'|'schedule'>('reconstruct');
  const [step,       setStep]       = useState<'upload'|'preview'|'submitting'|'done'>('upload');
  const [fileRows,   setFileRows]   = useState<FileRow[]>([]);
  const [schedRows,  setSchedRows]  = useState<ScheduleRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const [paymentFor, setPaymentFor] = useState('');
  const [paymentDesc,setPaymentDesc]= useState('');
  const [submitError,setSubmitError]= useState('');
  const [result,     setResult]     = useState<{replaced:number;created:number}|null>(null);
  const [schedResult,setSchedResult]= useState<{applied:number;events:number}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceCheck = selectedChecks[0] ?? null;

  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv','tsv','txt','xlsx','xls'].includes(ext)) {
      setParseError('Please upload a .xlsx, .xls, .csv, .tsv, or .txt file.'); return;
    }
    const parse = (text: string) => {
      if (mode === 'schedule') {
        const { rows, error } = parseScheduleFile(text);
        if (error) { setParseError(error); return; }
        setParseError(''); setSchedRows(rows); setStep('preview');
      } else {
        const { rows, error } = parseReconstructFile(text);
        if (error) { setParseError(error); return; }
        setParseError(''); setFileRows(rows); setStep('preview');
      }
    };
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = e => {
        try { const wb=XLSX.read(e.target?.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; parse(XLSX.utils.sheet_to_csv(ws,{FS:'\t'})); }
        catch { setParseError('Could not read Excel file.'); }
      };
      reader.onerror = () => setParseError('Error reading file.'); reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = e => parse(e.target?.result as string);
      reader.onerror = () => setParseError('Error reading file.'); reader.readAsText(file);
    }
  }, [mode]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) { const f=e.target.files?.[0]; if(f)processFile(f); e.target.value=''; }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f)processFile(f); }

  async function handleSubmit() {
    setStep('submitting'); setSubmitError('');
    try {
      if (mode === 'schedule') {
        const res  = await fetch('/api/checks/reconstruct-schedule', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ clientCode:sourceCheck?.client??'', rows:schedRows, appliedBy:userEmail }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? 'Server error');
        setSchedResult({ applied:json.applied, events:json.events }); setStep('done');
        onSuccess({ replaced:0, created:0 });
      } else {
        const res  = await fetch('/api/checks/reconstruct-bulk', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            selectedIds:      selectedChecks.map(c=>c.id),
            fileRows:         fileRows.map(r=>({ bank:r.bank, checkNo:r.checkNo, checkDate:r.checkDate, originalAmount:r.originalAmount, nextDeposit:r.nextDeposit??null })),
            paymentFor,
            paymentDesc:      paymentDesc.trim(),
            sourceCheckId:    sourceCheck?.id ?? selectedChecks[0]?.id,
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? 'Server error');
        setResult({ replaced:json.replaced, created:json.created }); setStep('done');
        onSuccess({ replaced:json.replaced, created:json.created });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error'); setStep('preview');
    }
  }

  const hasBlocked          = selectedChecks.some(c => BLOCKED.includes(c.status));
  const canSubmitReconstruct = !hasBlocked && paymentFor.trim() !== '' && paymentDesc.trim() !== '';
  const canSubmitSchedule   = schedRows.length > 0;

  if (typeof document === 'undefined') return null;

  const MODAL = (
    <div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={step!=='submitting'?onClose:undefined}>
      <div style={{background:'#fff',borderRadius:16,boxShadow:'0 24px 64px rgba(0,0,0,0.25)',width:'100%',maxWidth:step==='preview'?980:560,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:'18px 24px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <h2 style={{margin:0,fontSize:16,fontWeight:700,color:'#111827'}}>{mode==='schedule'?'📅 Bulk Schedule Payment':'🔄 Bulk Reconstruct'}</h2>
            <p style={{margin:'3px 0 0',fontSize:12,color:'#6b7280'}}>{selectedChecks.length} check{selectedChecks.length!==1?'s':''} selected{sourceCheck&&` · ${sourceCheck.clientName} · ${sourceCheck.branch}`}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {step==='upload' && (
              <button type="button" onClick={()=>{setMode(m=>m==='reconstruct'?'schedule':'reconstruct');setParseError('');setFileRows([]);setSchedRows([]);setStep('upload');}}
                style={{fontSize:11,fontWeight:600,padding:'5px 10px',borderRadius:8,border:'1px solid #e0e7ff',background:mode==='schedule'?'#4f46e5':'#eff6ff',color:mode==='schedule'?'#fff':'#4f46e5',cursor:'pointer',whiteSpace:'nowrap'}}>
                {mode==='schedule'?'↩ Switch to Reconstruct':'📅 Switch to Schedule Payment'}
              </button>
            )}
            {step!=='submitting' && <button onClick={onClose} style={{background:'#f1f5f9',border:'none',borderRadius:'50%',width:30,height:30,cursor:'pointer',fontSize:18,color:'#6b7280',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>

          {/* UPLOAD */}
          {step==='upload' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {mode==='schedule' ? (
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#15803d',lineHeight:1.6}}>
                  <strong>What will happen:</strong><br/>
                  • Upload file with <strong>Date, Amount, Payment Details</strong><br/>
                  • Auto-applies each row → <strong>PARTIAL_PAYMENT</strong> or <strong>SETTLED_PAID</strong> events<br/>
                  • Balance decreases per check (oldest check first, overflow to next)
                </div>
              ) : (
                <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#1e40af',lineHeight:1.6}}>
                  <strong>What will happen:</strong><br/>
                  • <strong>{selectedChecks.length} selected checks</strong> → status becomes <span style={{background:'#ddd6fe',color:'#4c1d95',padding:'1px 6px',borderRadius:4,fontWeight:700}}>RECON REPLACED</span> (Closed)<br/>
                  • <strong>File rows</strong> → new checks created with same Client/Branch/AE, payment for = <em>Reconstruct Balance</em>, status = <span style={{background:'#ede9fe',color:'#5b21b6',padding:'1px 6px',borderRadius:4,fontWeight:700}}>RECON REPLACEMENT</span>
                </div>
              )}

              {/* Drop zone */}
              <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
                style={{border:`2px dashed ${dragOver?'#3b82f6':'#d1d5db'}`,borderRadius:12,padding:'36px 24px',textAlign:'center',cursor:'pointer',background:dragOver?'#eff6ff':'#f9fafb',transition:'all 0.15s'}}>
                <div style={{fontSize:32,marginBottom:8}}>📂</div>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:dragOver?'#1d4ed8':'#374151'}}>{dragOver?'Drop file here':'Click to browse or drag & drop'}</p>
                <p style={{margin:'4px 0 0',fontSize:11,color:'#9ca3af'}}>Supported: .xlsx, .xls, .csv, .tsv, .txt</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" style={{display:'none'}} onChange={handlePick}/>
              {parseError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>⚠ {parseError}</div>}

              {/* Format hint */}
              <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px'}}>
                <p style={{margin:'0 0 6px',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>{mode==='schedule'?'Expected file format (Schedule Payment)':'Expected file format'}</p>
                {mode==='schedule' ? (
                  <code style={{fontSize:11,color:'#374151',lineHeight:1.8,display:'block',whiteSpace:'pre-wrap'}}>{`DATE\tM/A\tPAYMENT AMOUNT\tPAYMENT DETAILS\n4/8/2026\t16026.46\t16026.46\tCASH\n5/8/2026\t16026.46\t16026.46\tBTB-BDO 4296`}</code>
                ) : (
                  <>
                    <p style={{margin:'0 0 4px',fontSize:11,color:'#6b7280'}}>CHECK Number column accepts combined format <code style={{background:'#e2e8f0',padding:'0 4px',borderRadius:3}}>BDO-629481</code>.</p>
                    <code style={{fontSize:11,color:'#374151',lineHeight:1.8,display:'block',whiteSpace:'pre-wrap'}}>{`CHECK Number\tDATE\tORIGINAL AMOUNT\tNEXT DEPOSIT\nBDO-629481\t8/30/26\t86,728.00\t8/30/26\nBDO-629482\t9/30/26\t86,728.00\t9/30/26`}</code>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {step==='preview' && (
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              {mode==='schedule' ? (
                <>
                  <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 16px'}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#15803d',marginBottom:4}}>📅 {schedRows.length} payment rows — auto-apply to <strong>{sourceCheck?.clientName}</strong> checks</div>
                    <div style={{fontSize:12,color:'#166534'}}>Oldest check mababawasan muna. Overflow → next check.</div>
                  </div>
                  <div style={{overflowX:'auto',border:'1px solid #e2e8f0',borderRadius:8}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead><tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                        <th style={{...S.th,textAlign:'center'}}>#</th>
                        <th style={S.th}>Date</th>
                        <th style={{...S.th,textAlign:'right'}}>M/A</th>
                        <th style={{...S.th,textAlign:'right'}}>Payment Amount</th>
                        <th style={S.th}>Payment Details</th>
                      </tr></thead>
                      <tbody>{schedRows.map((r,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{...S.td,textAlign:'center',color:'#9ca3af'}}>{i+1}</td>
                          <td style={{...S.td,color:'#374151'}}>{r.scheduleDate||'—'}</td>
                          <td style={{...S.td,textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#1d4ed8'}}>{r.monthlyAmortization?fmtAmt(r.monthlyAmortization):'—'}</td>
                          <td style={{...S.td,textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#15803d'}}>{fmtAmt(r.amount)}</td>
                          <td style={{...S.td,color:'#6b7280'}}>{r.paymentDetails||'—'}</td>
                        </tr>
                      ))}</tbody>
                      <tfoot><tr style={{background:'#f8fafc',borderTop:'2px solid #e2e8f0'}}>
                        <td colSpan={2} style={{...S.td,fontWeight:700}}>Total</td>
                        <td style={{...S.td,textAlign:'right',fontFamily:'monospace',fontWeight:700,color:'#1d4ed8'}}>{fmtAmt(schedRows.reduce((s,r)=>s+r.monthlyAmortization,0))}</td>
                        <td style={{...S.td,textAlign:'right',fontFamily:'monospace',fontWeight:700,color:'#15803d'}}>{fmtAmt(schedRows.reduce((s,r)=>s+r.amount,0))}</td>
                        <td/>
                      </tr></tfoot>
                    </table>
                  </div>
                  {submitError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>⚠ {submitError}</div>}
                </>
              ) : (
                <>
                  {/* Summary cards */}
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:160,background:'#fdf4ff',border:'1px solid #e9d5ff',borderRadius:10,padding:'12px 16px'}}>
                      <div style={{fontSize:26,fontWeight:800,color:'#6d28d9'}}>{selectedChecks.length}</div>
                      <div style={{fontSize:12,color:'#5b21b6',fontWeight:600}}>Existing checks → RECON REPLACED</div>
                    </div>
                    <div style={{flex:1,minWidth:160,background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:10,padding:'12px 16px'}}>
                      <div style={{fontSize:26,fontWeight:800,color:'#7c3aed'}}>{fileRows.length}</div>
                      <div style={{fontSize:12,color:'#5b21b6',fontWeight:600}}>New checks → RECON REPLACEMENT</div>
                    </div>
                    {sourceCheck && (
                      <div style={{flex:2,minWidth:220,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 16px'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#15803d',marginBottom:4,textTransform:'uppercase'}}>Copied to new checks</div>
                        <div style={{fontSize:12,color:'#166534'}}>
                          <strong>Client:</strong> {sourceCheck.clientName}<br/>
                          <strong>Branch:</strong> {sourceCheck.branch}{sourceCheck.subsidiary&&<> · <strong>Subsi:</strong> {sourceCheck.subsidiary}</>}{sourceCheck.ae&&<> · <strong>AE:</strong> {sourceCheck.ae}</>}<br/>
                          <strong>Payment For:</strong> {paymentFor||<span style={{color:'#dc2626'}}>⚠ required</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment For */}
                  <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                      <label style={{fontSize:13,fontWeight:700,color:'#92400e'}}>Payment For <span style={{color:'#dc2626'}}>*</span></label>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {PAYMENT_FOR_OPTS.map(opt=>(
                          <button key={opt} type="button" onClick={()=>setPaymentFor(opt)}
                            style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,border:`2px solid ${paymentFor===opt?'#7c3aed':'#e5e7eb'}`,background:paymentFor===opt?'#ede9fe':'#fff',color:paymentFor===opt?'#5b21b6':'#374151',cursor:'pointer'}}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:700,color:'#92400e',display:'block',marginBottom:4}}>Payment Description <span style={{color:'#dc2626'}}>*</span></label>
                      <input type="text" value={paymentDesc} onChange={e=>setPaymentDesc(e.target.value)} placeholder="e.g. Reconstruct balance for Nov-Dec 2025 checks"
                        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'8px 12px',fontSize:13,background:'#fff',outline:'none'}}/>
                    </div>
                  </div>

                  {/* Selected checks (RECON REPLACED) */}
                  <div>
                    <p style={{margin:'0 0 8px',fontSize:12,fontWeight:700,color:'#6d28d9'}}><span style={{background:'#ede9fe',color:'#5b21b6',borderRadius:999,padding:'2px 10px',fontSize:11}}>RECON REPLACED</span>{' '}These checks will be closed</p>
                    <div style={{overflowX:'auto',border:'1px solid #e2e8f0',borderRadius:8,maxHeight:200}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead style={{position:'sticky',top:0}}><tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                          <th style={{...S.th,textAlign:'left'}}>Client</th><th style={{...S.th,textAlign:'left'}}>Bank / Check#</th><th style={{...S.th,textAlign:'left'}}>Date</th><th style={{...S.th,textAlign:'right'}}>Original ₱</th>
                        </tr></thead>
                        <tbody>{selectedChecks.map(c=>(
                          <tr key={c.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                            <td style={{...S.td,color:'#374151'}}>{c.clientName}</td>
                            <td style={{...S.td,fontFamily:'monospace',color:'#6b7280'}}>{c.bank} {c.checkNo}</td>
                            <td style={{...S.td,color:'#6b7280'}}>{fmtDt(c.checkDate)}</td>
                            <td style={{...S.td,textAlign:'right',fontFamily:'monospace',color:'#6b7280'}}>{fmtAmt(c.originalAmount)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>

                  {/* File rows (RECON REPLACEMENT) */}
                  {fileRows.length>0 && (
                    <div>
                      <p style={{margin:'0 0 8px',fontSize:12,fontWeight:700,color:'#7c3aed'}}><span style={{background:'#ddd6fe',color:'#4c1d95',borderRadius:999,padding:'2px 10px',fontSize:11}}>RECON REPLACEMENT</span>{' '}New checks from file</p>
                      <div style={{overflowX:'auto',border:'1px solid #e2e8f0',borderRadius:8,maxHeight:240}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                          <thead style={{position:'sticky',top:0}}><tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                            <th style={{...S.th,textAlign:'center'}}>#</th><th style={S.th}>Bank/Check#</th><th style={S.th}>Date</th><th style={{...S.th,textAlign:'right'}}>Amount</th><th style={S.th}>Next Deposit</th><th style={S.th}>Client</th>
                          </tr></thead>
                          <tbody>{fileRows.map((r,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'#fdfcff':'#fff'}}>
                              <td style={{...S.td,textAlign:'center',color:'#9ca3af'}}>{i+1}</td>
                              <td style={{...S.td,fontFamily:'monospace',fontWeight:600,color:'#5b21b6'}}>{r.bank} {r.checkNo}</td>
                              <td style={{...S.td,color:'#374151'}}>{fmtDt(r.checkDate)}</td>
                              <td style={{...S.td,textAlign:'right',fontFamily:'monospace',fontWeight:600}}>{fmtAmt(r.originalAmount)}</td>
                              <td style={{...S.td,color:'#6b7280'}}>{r.nextDeposit?fmtDt(r.nextDeposit):'—'}</td>
                              <td style={{...S.td,color:'#15803d'}}>{sourceCheck?.clientName??'—'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {hasBlocked && (
                    <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#dc2626'}}>
                      ⛔ <strong>{selectedChecks.filter(c=>BLOCKED.includes(c.status)).length} check(s) cannot be reconstructed</strong> — remove them from selection.
                    </div>
                  )}
                  {submitError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>⚠ {submitError}</div>}
                </>
              )}
            </div>
          )}

          {/* SUBMITTING */}
          {step==='submitting' && (
            <div style={{textAlign:'center',padding:'48px 0'}}>
              <div style={{fontSize:36,marginBottom:12}}>⏳</div>
              <p style={{margin:0,fontSize:14,fontWeight:600,color:'#374151'}}>Processing…</p>
            </div>
          )}

          {/* DONE */}
          {step==='done' && (
            <div style={{textAlign:'center',padding:'36px 0'}}>
              <div style={{fontSize:42,marginBottom:14}}>✅</div>
              <h3 style={{margin:'0 0 10px',fontSize:16,fontWeight:700,color:'#15803d'}}>Done!</h3>
              {schedResult ? (
                <div style={{display:'inline-block',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 20px',fontSize:13,color:'#374151'}}>
                  <strong>{schedResult.applied}</strong> schedule rows applied · <strong>{schedResult.events}</strong> payment events created
                </div>
              ) : result ? (
                <div style={{display:'inline-flex',flexDirection:'column',gap:6,textAlign:'left',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 20px'}}>
                  <p style={{margin:0,fontSize:13,color:'#374151'}}><span style={{background:'#ddd6fe',color:'#4c1d95',padding:'1px 8px',borderRadius:4,fontWeight:700}}>RECON REPLACED</span>{' '}<strong>{result.replaced}</strong> checks closed</p>
                  <p style={{margin:0,fontSize:13,color:'#374151'}}><span style={{background:'#ede9fe',color:'#5b21b6',padding:'1px 8px',borderRadius:4,fontWeight:700}}>RECON REPLACEMENT</span>{' '}<strong>{result.created}</strong> new checks created</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        {step!=='submitting' && step!=='done' && (
          <div style={{padding:'14px 24px',borderTop:'1px solid #f1f5f9',display:'flex',gap:10,justifyContent:'flex-end',flexShrink:0}}>
            {step==='preview' && (
              <button onClick={()=>{setStep('upload');setFileRows([]);setSchedRows([]);setParseError('');}}
                style={{padding:'9px 18px',borderRadius:8,fontSize:13,fontWeight:600,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',color:'#374151'}}>← Back</button>
            )}
            <button onClick={onClose} style={{padding:'9px 18px',borderRadius:8,fontSize:13,fontWeight:600,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',color:'#374151'}}>Cancel</button>
            {step==='preview' && (mode==='schedule' ? (
              <button onClick={handleSubmit} disabled={!canSubmitSchedule}
                style={{padding:'9px 24px',borderRadius:8,fontSize:13,fontWeight:700,background:canSubmitSchedule?'#15803d':'#9ca3af',color:'#fff',border:'none',cursor:canSubmitSchedule?'pointer':'not-allowed'}}>
                📅 Apply {schedRows.length} Rows
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canSubmitReconstruct}
                style={{padding:'9px 24px',borderRadius:8,fontSize:13,fontWeight:700,background:canSubmitReconstruct?'#6d28d9':'#9ca3af',color:'#fff',border:'none',cursor:canSubmitReconstruct?'pointer':'not-allowed'}}>
                🔄 Confirm ({selectedChecks.length} replaced · {fileRows.length} created)
              </button>
            ))}
          </div>
        )}
        {step==='done' && (
          <div style={{padding:'14px 24px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',flexShrink:0}}>
            <button onClick={onClose} style={{padding:'9px 24px',borderRadius:8,fontSize:13,fontWeight:700,background:'#15803d',color:'#fff',border:'none',cursor:'pointer'}}>Close</button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(MODAL, document.body);
}
