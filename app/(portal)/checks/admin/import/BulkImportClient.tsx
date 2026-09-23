'use client';
/**
 * BulkImportClient — mass-import checks from Excel/CSV.
 * Ported from esprint-check-monitoring/app/admin/import/page.tsx.
 * Parses files with xlsx (client-side), previews, then POSTs to /api/bulk-import.
 */
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/checks/components/Toast';

const COL_ALIASES: Record<string, string[]> = {
  BRANCH:              ['BRANCH','BRANCHID','BRANCH_ID'],
  CLIENT_NAME:         ['CLIENTNAME','CLIENT NAME','CLIENT','CLIENTNM'],
  AE:                  ['AE','ACCOUNTEXECUTIVE','ACCOUNT EXECUTIVE'],
  BANK:                ['BANK'],
  CHECK_NUMBER:        ['CHECKNUMBER','CHECKNO','CHECK NUMBER','CHECK NO','CHECK NO.','CHEQUENUMBER','CHECK#'],
  CHECK_DATE:          ['CHECKDATE','CHECK DATE','CHEQUEDATE','CHEQUE DATE'],
  CHECK_AMOUNT:        ['CHECKAMOUNT','CHECK AMOUNT','AMOUNT','PAYMENTAMOUNT','ORIGINALAMOUNT','ORIGINAL AMOUNT','ORIGINALP','ORIGINALPHP'],
  HOLD_RETURN_DATE:    ['HOLDRETURNDATE','HOLD/RETURN DATE','HOLDDATE','RETURNDATE','HOLD DATE','RETURN DATE'],
  RETURN_REASON:       ['RETURNREASON','RETURN REASON','REASON'],
  REQUEST_DATE:        ['REQUESTDATE','REQUEST DATE','MOVEDATE','MOVE DATE','REDEPOSITDATE','REDEPOSIT DATE','MOVEDATEREQUEST','NEXTDEPOSIT','NEXT DEPOSIT'],
  ACTUAL_DEPOSIT_DATE: ['ACTUALDEPOSITDATE','ACTUAL DEPOSIT DATE','DEPOSITDATE','DEPOSIT DATE'],
  NOTES:               ['NOTES','REMARKS'],
  SUBSIDIARY:          ['SUBSIDIARY','SUBS'],
  PAYMENT_FOR:         ['PAYMENTFOR','PAYMENT FOR'],
  STATUS:              ['STATUS'],
  TOTAL_PAID:          ['TOTALPAID','TOTAL PAID','TOTALPAIDAMOUNT'],
  PAYMENT_DESCRIPTION: ['PAYMENTDESCRIPTION','PAYMENT DESCRIPTION','DESCRIPTION','PAYMENTDESC','PAYMENTDE'],
};

const normKey = (k: string) => String(k ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function findValue(row: Record<string, unknown>, key: string): unknown {
  const aliases = COL_ALIASES[key] ?? [];
  for (const k of Object.keys(row)) { if (aliases.includes(normKey(k))) return row[k]; }
  return null;
}

function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (day >= 1 && day <= 12 && month >= 1 && month <= 31) return `${year}-${String(day).padStart(2,'0')}-${String(month).padStart(2,'0')}`;
  }
  const d2 = new Date(s);
  if (isNaN(d2.getTime())) return null;
  return `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;
}

function parseCheckNumber(raw: string): { bank: string | null; checkNo: string } {
  const s = String(raw ?? '').trim();
  const m = s.match(/^([A-Z]+[\w]*)\s+[\-\s]*([0-9]+)/i);
  if (m) return { bank: m[1].toUpperCase(), checkNo: m[2] };
  return { bank: null, checkNo: s };
}

interface ParsedRow {
  _row: number; branch: string; clientName: string; ae: string | null; bank: string;
  checkNo: string; checkDate: string | null; amount: number | null; totalPaid: number | null;
  holdReturnDate: string | null; returnReason: string | null; requestDate: string | null;
  actualDepositDate: string | null; notes: string; subsidiary: string | null;
  paymentFor: string | null; paymentDescription: string | null; statusHint: string | null;
  errors: string[];
}
interface FileEntry { id: number; file: File }
interface ParseResult { valid: ParsedRow[]; errors: ParsedRow[]; total: number }

function validateRows(rows: Record<string, unknown>[], branches: {id:string;name:string}[]): ParseResult {
  const valid: ParsedRow[] = [], errors: ParsedRow[] = [];
  rows.forEach((row, i) => {
    const branchRaw  = String(findValue(row, 'BRANCH') ?? '').trim();
    const clientName = String(findValue(row, 'CLIENT_NAME') ?? '').trim();
    const checkRaw   = String(findValue(row, 'CHECK_NUMBER') ?? '').trim();
    const checkDate  = parseDate(findValue(row, 'CHECK_DATE'));
    const amount     = parseFloat(String(findValue(row, 'CHECK_AMOUNT') ?? '').replace(/[₱,\s]/g, ''));
    const errs: string[] = [];
    if (!branchRaw)   errs.push('missing BRANCH');
    if (!clientName)  errs.push('missing CLIENT NAME');
    if (!checkRaw)    errs.push('missing CHECK NUMBER');
    if (!checkDate)   errs.push('invalid CHECK DATE');
    if (isNaN(amount)) errs.push('invalid CHECK AMOUNT');
    const branch = branches.find(b =>
      b.id.toUpperCase() === branchRaw.toUpperCase() || b.name.toUpperCase() === branchRaw.toUpperCase() ||
      b.name.toUpperCase().startsWith(branchRaw.toUpperCase()) || branchRaw.toUpperCase().startsWith(b.name.toUpperCase()) ||
      branchRaw.toUpperCase().startsWith(b.id.toUpperCase())
    );
    if (!branch && branchRaw) errs.push(`unknown branch "${branchRaw}"`);
    const bankFromCol = String(findValue(row, 'BANK') ?? '').trim().toUpperCase() || null;
    const { bank: bankFromNo, checkNo } = parseCheckNumber(checkRaw);
    const bank = bankFromNo || bankFromCol || '?';
    const totalPaidRaw = findValue(row, 'TOTAL_PAID');
    const totalPaid = totalPaidRaw != null && totalPaidRaw !== '' ? parseFloat(String(totalPaidRaw).replace(/[₱,\s]/g, '')) : null;
    const parsed: ParsedRow = {
      _row: i + 2, branch: branch?.id ?? branchRaw, clientName,
      ae: String(findValue(row, 'AE') ?? '').trim() || null, bank,
      checkNo: checkNo || checkRaw, checkDate, amount: isNaN(amount) ? null : amount,
      totalPaid: (totalPaid != null && !isNaN(totalPaid)) ? totalPaid : null,
      holdReturnDate: parseDate(findValue(row, 'HOLD_RETURN_DATE')),
      returnReason: String(findValue(row, 'RETURN_REASON') ?? '').trim() || null,
      requestDate: parseDate(findValue(row, 'REQUEST_DATE')),
      actualDepositDate: parseDate(findValue(row, 'ACTUAL_DEPOSIT_DATE')),
      notes: String(findValue(row, 'NOTES') ?? '').trim(),
      subsidiary: String(findValue(row, 'SUBSIDIARY') ?? '').trim() || null,
      paymentFor: String(findValue(row, 'PAYMENT_FOR') ?? '').trim() || null,
      paymentDescription: String(findValue(row, 'PAYMENT_DESCRIPTION') ?? '').trim() || null,
      statusHint: String(findValue(row, 'STATUS') ?? '').trim().toUpperCase() || null,
      errors: errs,
    };
    if (errs.length) errors.push(parsed); else valid.push(parsed);
  });
  return { valid, errors, total: rows.length };
}

export function BulkImportClient({ branches }: { branches: {id:string;name:string}[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles]       = useState<FileEntry[]>([]);
  const [parsed, setParsed]     = useState<ParseResult | null>(null);
  const [parsing, setParsing]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState<{checks:number;events:number;newClients:number;skipped:number;updated:number} | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [updateMode, setUpdateMode] = useState(false);
  const fileSeqRef = useRef(0);

  const reparse = useCallback(async (entries: FileEntry[]) => {
    if (!entries.length) { setParsed(null); return; }
    setParsing(true);
    try {
      const XLSX = await import('xlsx');
      let allRows: Record<string, unknown>[] = [];
      for (const { file } of entries) {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { cellDates: true });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null });
        allRows = allRows.concat(rows);
      }
      setParsed(validateRows(allRows, branches));
    } catch (err) {
      showToast('Failed to parse file: ' + ((err as Error)?.message ?? 'Unknown'), 'error');
      setParsed(null);
    } finally { setParsing(false); }
  }, [branches, showToast]);

  function addFiles(newFiles: File[]) {
    const accepted = newFiles.filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!accepted.length) return;
    setFiles(prev => {
      const next = [...prev, ...accepted.map(file => ({ id: fileSeqRef.current++, file }))];
      reparse(next);
      return next;
    });
    setResult(null);
  }
  function removeFile(id: number) {
    setFiles(prev => { const next = prev.filter(e => e.id !== id); if (next.length) reparse(next); else setParsed(null); return next; });
  }

  async function handleImport() {
    if (!parsed?.valid.length) return;
    setImporting(true);
    try {
      const res  = await fetch('/api/bulk-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed.valid, updateMode }),
      });
      const json = await res.json();
      if (json.ok) { setResult(json); setFiles([]); setParsed(null); showToast('Import complete!', 'success'); }
      else showToast(json.error ?? 'Import failed', 'error');
    } catch { showToast('Network error — please try again', 'error'); }
    finally { setImporting(false); }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const hdrs = ['BRANCH','CLIENT NAME','AE','BANK','CHECK NUMBER','CHECK DATE','CHECK AMOUNT','HOLD / RETURN DATE','RETURN REASON','REQUEST DATE','ACTUAL DEPOSIT DATE','NOTES','SUBSIDIARY','PAYMENT FOR'];
    const ex = ['CEB','SAMPLE CLIENT','CD','PSB','PSB 69126','2026-06-23','23750','2026-06-23','DAIF','2026-07-07','','','APSI','Machine'];
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ex]);
    ws['!cols'] = hdrs.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Checks Import');
    XLSX.writeFile(wb, 'ESPrint_Import_Template.xlsx');
  }

  const fmtSize = (n: number) => n > 1024*1024 ? (n/1024/1024).toFixed(1)+' MB' : Math.round(n/1024)+' KB';

  return (
    <div className="animate-fade-in space-y-5 max-w-4xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => router.push('/checks/all')} className="text-sm text-blue-700 hover:text-blue-900 font-medium mb-1 inline-flex items-center gap-1">← Back to All Checks</button>
          <h1 className="text-xl font-bold text-gray-900">Import Checks from Excel</h1>
          <p className="text-sm text-gray-500">Upload one or more .xlsx / .xls / .csv files</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50">↓ Download Template</button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden">
        <button type="button" className="w-full flex items-center gap-2 px-5 py-3 text-left" onClick={() => setHintOpen(o => !o)}>
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Expected column names</span>
          <span className="text-blue-400 text-xs ml-auto">{hintOpen ? '▲' : '▼'}</span>
        </button>
        {hintOpen && (
          <div className="px-5 pb-4 text-xs text-blue-900 space-y-1.5 border-t border-blue-200">
            <p className="font-mono font-semibold leading-relaxed">BRANCH · CLIENT NAME · AE · BANK · CHECK NUMBER · CHECK DATE · CHECK AMOUNT · HOLD / RETURN DATE · RETURN REASON · REQUEST DATE · ACTUAL DEPOSIT DATE · NOTES · SUBSIDIARY · PAYMENT FOR</p>
            <p className="text-blue-700"><strong>Required:</strong> BRANCH, CLIENT NAME, CHECK NUMBER, CHECK DATE, CHECK AMOUNT. Headers case-insensitive. Unknown clients auto-created. Existing checks (same branch + bank + check #) are skipped.</p>
          </div>
        )}
      </div>

      <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'}`}>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <div className="text-4xl mb-2">☁️</div>
        <p className="text-sm font-semibold text-gray-700">Click to browse or drag &amp; drop files here</p>
        <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv · multiple files supported</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Selected files <span className="bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-[10px]">{files.length}</span></p>
          <div className="flex flex-wrap gap-2">
            {files.map(({ id, file }) => (
              <span key={id} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-sm max-w-xs">
                <span>{/\.csv$/i.test(file.name) ? '📄' : '📊'}</span>
                <span className="truncate font-medium max-w-[150px]" title={file.name}>{file.name}</span>
                <span className="text-gray-400 text-[10px]">{fmtSize(file.size)}</span>
                <button type="button" onClick={e => { e.stopPropagation(); removeFile(id); }} className="text-gray-300 hover:text-red-500 text-base leading-none ml-1">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {parsing && <div className="flex items-center gap-2 text-sm text-gray-500 py-3">Parsing {files.length} file{files.length !== 1 ? 's' : ''}…</div>}

      {!parsing && parsed && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {parsed.valid.length > 0 && <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-3 py-0.5 text-xs font-bold text-green-700">✓ {parsed.valid.length} valid</span>}
              {parsed.errors.length > 0 && <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-full px-3 py-0.5 text-xs font-bold text-red-600">✕ {parsed.errors.length} error{parsed.errors.length !== 1 ? 's' : ''}</span>}
              <span className="text-xs text-gray-400">{parsed.total} total row{parsed.total !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setUpdateMode(v => !v)} className={`relative w-9 h-5 rounded-full transition-colors ${updateMode ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${updateMode ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-xs font-semibold text-gray-600">{updateMode ? <span className="text-amber-700">Update existing checks</span> : 'Insert new only'}</span>
              </label>
              {parsed.valid.length > 0 && (
                <button onClick={handleImport} disabled={importing}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 ${updateMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#1e3a8a] hover:bg-blue-700'}`}>
                  {importing ? 'Importing…' : updateMode ? `↻ Update ${parsed.valid.length} rows` : `↑ Import ${parsed.valid.length} valid rows`}
                </button>
              )}
            </div>
          </div>

          {parsed.errors.length > 0 && (
            <details className="border-b border-slate-100">
              <summary className="px-5 py-2.5 text-xs font-semibold text-red-600 cursor-pointer hover:bg-red-50">⚠️ Show {parsed.errors.length} error row{parsed.errors.length !== 1 ? 's' : ''}</summary>
              <div className="divide-y divide-red-50">
                {parsed.errors.slice(0, 40).map((r, i) => (
                  <div key={i} className="px-5 py-2 text-xs bg-red-50/50"><span className="font-bold text-red-600">Row {r._row}</span><span className="text-gray-500 mx-1.5">—</span><span className="text-gray-700">{r.errors.join(' · ')}</span></div>
                ))}
                {parsed.errors.length > 40 && <div className="px-5 py-2 text-xs text-gray-400">…and {parsed.errors.length - 40} more</div>}
              </div>
            </details>
          )}

          {parsed.valid.length > 0 && (
            <div className="overflow-x-auto">
              <p className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide border-b border-slate-100">Preview — first {Math.min(50, parsed.valid.length)} of {parsed.valid.length}</p>
              <table className="report w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#','Branch','Client','AE','Bank / Check #','Date','Amount','Actions'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsed.valid.slice(0, 50).map((r, i) => {
                    const acts: string[] = ['+ Check'];
                    if (r.returnReason) acts.push(`Return: ${r.returnReason}`);
                    else if (r.holdReturnDate || r.requestDate) acts.push('Hold req');
                    if (r.actualDepositDate) acts.push('Cleared');
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30">
                        <td className="px-3 py-2 text-gray-400">{r._row}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{r.branch}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={r.clientName}>{r.clientName}</td>
                        <td className="px-3 py-2 text-gray-500">{r.ae ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-800">{r.bank} {r.checkNo}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.checkDate ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-800">{r.amount != null ? '₱' + r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {acts.map((a, ai) => (
                              <span key={ai} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${a === '+ Check' ? 'bg-blue-100 text-blue-700' : a.startsWith('Return') ? 'bg-red-100 text-red-700' : a === 'Hold req' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{a}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-2"><span className="text-green-600 text-lg">✅</span><span className="text-sm font-semibold text-green-800">Import complete!</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: 'Checks added', value: result.checks, cls: 'text-blue-700' },
              { label: 'Updated', value: result.updated, cls: 'text-amber-700' },
              { label: 'Events created', value: result.events, cls: 'text-indigo-700' },
              { label: 'New clients', value: result.newClients, cls: 'text-teal-700' },
              { label: 'Duplicates skipped', value: result.skipped, cls: 'text-gray-500' },
            ].filter(s => s.value > 0).map(s => (
              <div key={s.label} className="bg-white rounded-xl p-3 border border-white/80 text-center">
                <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/checks/all')} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#1e3a8a] hover:bg-blue-700">→ View All Checks</button>
        </div>
      )}
    </div>
  );
}
