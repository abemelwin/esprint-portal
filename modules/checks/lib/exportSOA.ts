/**
 * exportSOA.ts — Generates Statement of Account (SOA) Excel files.
 * Direct port from esprint-check-monitoring/lib/exportSOA.ts.
 * Uses JSZip to modify cell values in the XLSX template while preserving
 * all formatting, images, and print layout.
 *
 * Templates served from /public/templates/.
 */
import JSZip from 'jszip';

export interface SOACheck {
  id: string;
  client: string;
  clientName: string;
  bank: string | null;
  checkNo: string;
  checkDate: string | null;
  originalAmount: number;
  balance: number;
  totalPaid: number;
  status: string;
  reason: string | null;
  branchName: string;
  paymentDetails?: string;
}

export interface SOAOptions {
  checks: SOACheck[];
  preparedBy: string;
  department?: string;
  template?: 'ES' | 'APSI';
}

export async function generateSOA({
  checks, preparedBy, department = 'Accounts Receivable', template = 'ES',
}: SOAOptions) {
  if (!checks.length) return;

  // Group by client
  const grouped = new Map<string, SOACheck[]>();
  for (const c of checks) {
    const key = (c.clientName || c.client).trim().toUpperCase();
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  }

  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const templateFile = template === 'APSI' ? '/templates/APSI_SOA_TEMPLATE.xlsx' : '/templates/SOA_TEMPLATE.xlsx';

  const res = await fetch(templateFile);
  const templateBuf = await res.arrayBuffer();

  for (const [clientKey, clientChecks] of grouped) {
    const zip = await JSZip.loadAsync(templateBuf);

    let ssXml  = await zip.file('xl/sharedStrings.xml')!.async('text');
    let sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('text');

    const displayName  = clientChecks[0]?.clientName || clientKey;
    const fullClientName = displayName.toUpperCase();
    const dateStr      = `As of ${today}`;

    const siRegex = /<si><t[^>]*>(.*?)<\/t><\/si>/g;
    const matches = [...ssXml.matchAll(siRegex)];
    if (matches.length >= 3) {
      ssXml = ssXml.replace(matches[0][0], `<si><t>${escapeXml(fullClientName)}</t></si>`);
      ssXml = ssXml.replace(matches[2][0], `<si><t>${escapeXml(dateStr)}</t></si>`);
    }

    let totalAmount = 0, totalPartial = 0, totalBalance = 0;

    // Clear rows 15–24
    for (let r = 15; r <= 24; r++) {
      const rowRegex = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?<\\/row>`);
      sheetXml = sheetXml.replace(rowRegex, buildDataRow(r, null));
    }

    // Fill data rows
    for (let i = 0; i < Math.min(clientChecks.length, 10); i++) {
      const c = clientChecks[i];
      const r = 15 + i;
      const date = c.checkDate
        ? new Date(c.checkDate).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'numeric' })
        : '';
      const checkDetails = `${c.bank ?? ''} ${c.checkNo}`.trim();
      const partial = c.totalPaid > 0 ? c.totalPaid.toFixed(2) : '-';
      const statusText = c.reason || c.status || '';
      const payDetails = c.paymentDetails || '';

      totalAmount  += c.originalAmount;
      totalPartial += c.totalPaid;
      totalBalance += c.balance;

      const rowXml = buildDataRow(r, { date, checkDetails, amount: c.originalAmount, partial, balance: c.balance, status: statusText, paymentDetails: payDetails });
      const emptyRowRx = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?<\\/row>`);
      sheetXml = sheetXml.replace(emptyRowRx, rowXml);
    }

    // Total row (row 26)
    const totalRowRx = /<row r="26"[^>]*>[\s\S]*?<\/row>/;
    sheetXml = sheetXml.replace(totalRowRx, buildTotalRow(26, totalAmount, totalPartial > 0 ? totalPartial.toFixed(2) : '-', totalBalance));

    // Prepared by (row 42)
    const row42Rx = /<row r="42"[^>]*>[\s\S]*?<\/row>/;
    sheetXml = sheetXml.replace(row42Rx, `<row r="42" spans="1:8"><c r="A42" s="5" t="str"><v>${escapeXml(preparedBy)}</v></c></row>`);

    zip.remove('xl/calcChain.xml');
    zip.file('xl/sharedStrings.xml', ssXml);
    zip.file('xl/worksheets/sheet1.xml', sheetXml);

    const outBuf = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(outBuf);
    const a = document.createElement('a');
    a.href = url;
    const safeName = clientKey.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '_');
    a.download = `SOA_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function escapeXml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function buildDataRow(r: number, data: { date:string; checkDetails:string; amount:number; partial:string; balance:number; status:string; paymentDetails:string } | null): string {
  if (!data) return `<row r="${r}" spans="1:8"><c r="B${r}" s="18"/><c r="C${r}" s="18"/><c r="D${r}" s="18"/><c r="E${r}" s="18"/><c r="F${r}" s="18"/><c r="G${r}" s="18"/><c r="H${r}" s="18"/></row>`;
  const partialCell = data.partial === '-'
    ? `<c r="E${r}" s="18" t="str"><v>-</v></c>`
    : `<c r="E${r}" s="19"><v>${data.partial}</v></c>`;
  return `<row r="${r}" spans="1:8"><c r="B${r}" s="18" t="str"><v>${escapeXml(data.date)}</v></c><c r="C${r}" s="18" t="str"><v>${escapeXml(data.checkDetails)}</v></c><c r="D${r}" s="19"><v>${data.amount}</v></c>${partialCell}<c r="F${r}" s="19"><v>${data.balance}</v></c><c r="G${r}" s="18" t="str"><v>${escapeXml(data.status)}</v></c><c r="H${r}" s="18" t="str"><v>${escapeXml(data.paymentDetails)}</v></c></row>`;
}

function buildTotalRow(r: number, amount: number, partial: string, balance: number): string {
  const partialCell = partial === '-'
    ? `<c r="E${r}" s="18" t="str"><v>-</v></c>`
    : `<c r="E${r}" s="19"><v>${partial}</v></c>`;
  return `<row r="${r}" spans="1:8"><c r="B${r}" s="18"/><c r="C${r}" s="18" t="str"><v>Total</v></c><c r="D${r}" s="19"><v>${amount}</v></c>${partialCell}<c r="F${r}" s="19"><v>${balance}</v></c><c r="G${r}" s="18"/><c r="H${r}" s="18"/></row>`;
}
