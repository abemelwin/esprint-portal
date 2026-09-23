import * as XLSX from 'xlsx';

export interface ReconExportCheck {
  bank: string | null;
  checkNo: string;
  checkDate: string | null;
  originalAmount: number;
  nextDeposit?: string | null;
}

export interface ReconClientGroup {
  name: string;
  branch: string;
  subsidiary: string | null;
  ae: string | null;
  replaced:    ReconExportCheck[];
  replacement: ReconExportCheck[];
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US');
}

export function exportReconstructExcel(groups: ReconClientGroup[], filename?: string) {
  const wb = XLSX.utils.book_new();

  for (const group of groups) {
    const rows: (string | number)[][] = [];

    rows.push([`CLIENT: ${group.name}`, '', '', '', '', '', '', '', '', '']);
    rows.push([
      group.subsidiary ?? '', group.branch, `AE: ${group.ae ?? ''}`,
      '', '', '', '', '', '', '',
    ]);
    rows.push([]);

    rows.push([
      'RECONSTRUCT BALANCE', '', '', '',
      '',
      'RECONSTRUCT PAYMENT', '', '', '', '',
    ]);

    rows.push([
      'CHECK Number', 'DATE', 'ORIGINAL AMOUNT', '',
      '',
      'CHECK Number', 'CHECK DATE', 'ORIGINAL AMOUNT', 'BALANCE', 'NEXT DEPOSIT',
    ]);

    const maxRows = Math.max(group.replaced.length, group.replacement.length);
    for (let i = 0; i < maxRows; i++) {
      const rep  = group.replaced[i];
      const repmt = group.replacement[i];
      rows.push([
        rep  ? `${rep.bank ?? ''}-${rep.checkNo}`       : '',
        rep  ? fmtDate(rep.checkDate)                    : '',
        rep  ? rep.originalAmount                        : '',
        '',
        '',
        repmt ? `${repmt.bank ?? ''}-${repmt.checkNo}`  : '',
        repmt ? fmtDate(repmt.checkDate)                 : '',
        repmt ? repmt.originalAmount                     : '',
        repmt ? repmt.originalAmount                     : '',
        repmt ? fmtDate(repmt.nextDeposit)               : '',
      ]);
    }

    const totalReplaced     = group.replaced.reduce((s, c) => s + c.originalAmount, 0);
    const totalReplacement  = group.replacement.reduce((s, c) => s + c.originalAmount, 0);
    rows.push([
      'Total', '', totalReplaced,
      '', '',
      'Total', '', totalReplacement, '', '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 2  },
      { wch: 2  },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
    ];

    ws['!merges'] = [
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
      { s: { r: 3, c: 5 }, e: { r: 3, c: 9 } },
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    ];

    const sheetName = group.name.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (groups.length > 1) {
    const summaryRows: (string | number)[][] = [
      ['CLIENT', 'SUBSIDIARY', 'BRANCH', 'AE', 'REPLACED COUNT', 'REPLACED TOTAL', 'REPLACEMENT COUNT', 'REPLACEMENT TOTAL'],
    ];
    for (const g of groups) {
      summaryRows.push([
        g.name,
        g.subsidiary ?? '',
        g.branch,
        g.ae ?? '',
        g.replaced.length,
        g.replaced.reduce((s, c) => s + c.originalAmount, 0),
        g.replacement.length,
        g.replacement.reduce((s, c) => s + c.originalAmount, 0),
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(summaryRows);
    ws['!cols'] = [
      { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  const today = new Date().toISOString().slice(0, 10);
  const name = filename ?? `Reconstruct_Report_${today}.xlsx`;
  XLSX.writeFile(wb, name);
}
