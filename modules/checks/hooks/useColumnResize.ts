'use client';
/**
 * useColumnResize — native <th> width resizing with localStorage persistence.
 * Direct port from esprint-check-monitoring/hooks/useColumnResize.ts.
 */
import { useRef, useCallback, useEffect } from 'react';

export function getColumnMinWidth(headerText: string, index: number): number {
  const clean = (headerText || '').replace(/[↑↓▲▼]/g, '').trim().toUpperCase();
  if (index === 0 && (!clean || clean.length <= 2)) return 46;
  if (clean.includes('SUBSIDIARY')) return 115;
  if (clean.includes('BRANCH')) return 105;
  if (clean.includes('CLIENT')) return 260;
  if (clean.includes('AE')) return 140;
  if (clean.includes('BANK') || clean.includes('CHECK #')) return 165;
  if (clean.includes('CHECK DATE') || clean.includes('DATE')) return 115;
  if (clean.includes('ORIGINAL')) return 135;
  if (clean.includes('BALANCE')) return 135;
  if (clean.includes('NEXT DEPOSIT') || clean.includes('DEPOSIT')) return 125;
  if (clean.includes('AGING')) return 85;
  if (clean.includes('STATUS')) return 130;
  if (clean.includes('REASON')) return 160;
  if (clean.includes('NOTES')) return 90;
  if (clean.includes('PAYMENT FOR')) return 130;
  if (clean.includes('PAYMENT DE')) return 220;
  return 120;
}

export function useColumnResize(
  tableRef: React.RefObject<HTMLTableElement | null>,
  storageKey = 'col-widths',
) {
  const applyWidths = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const ths = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    if (!ths.length) return;
    let saved: number[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) saved = p; }
    } catch {}
    ths.forEach((th, i) => {
      const text = th.innerText || th.textContent || '';
      const minW = getColumnMinWidth(text, i);
      th.style.minWidth = `${minW}px`;
      if (saved[i] && saved[i] >= 20) th.style.width = `${Math.max(saved[i], minW)}px`;
    });
  }, [tableRef, storageKey]);

  useEffect(() => { applyWidths(); }, [applyWidths]);

  const saveWidths = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const ths = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    try {
      const widths = ths.map(th => { const w = parseInt(th.style.width || `${th.getBoundingClientRect().width}`, 10); return isNaN(w) ? 0 : w; });
      if (widths.length && widths.every(w => w > 0)) localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {}
  }, [tableRef, storageKey]);

  const dragging = useRef<{ th: HTMLElement; startX: number; startWidth: number; rafId: number | null; lastX: number } | null>(null);

  const startResize = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    const table = tableRef.current;
    if (!table) return;
    const ths = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    const th = ths[colIndex];
    if (!th) return;
    const startWidth = Math.round(th.getBoundingClientRect().width) || 80;
    dragging.current = { th, startX: e.clientX, startWidth, rafId: null, lastX: e.clientX };

    const onMouseMove = (ev: MouseEvent) => {
      const d = dragging.current;
      if (!d) return;
      d.lastX = ev.clientX;
      if (d.rafId !== null) return;
      d.rafId = requestAnimationFrame(() => {
        if (!dragging.current) return;
        const { th: targetTh, startX, startWidth: sw, lastX } = dragging.current;
        const newW = Math.max(40, sw + (lastX - startX));
        targetTh.style.width = `${newW}px`;
        targetTh.style.minWidth = `${newW}px`;
        dragging.current.rafId = null;
      });
    };
    const onMouseUp = () => {
      const d = dragging.current;
      if (d?.rafId !== null) cancelAnimationFrame(d!.rafId!);
      dragging.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveWidths();
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [tableRef, saveWidths]);

  const syncCols = useCallback(() => { applyWidths(); }, [applyWidths]);
  const resetCols = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
    const table = tableRef.current;
    if (!table) return;
    const ths = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    ths.forEach((th, i) => {
      const text = th.innerText || th.textContent || '';
      th.style.width = '';
      th.style.minWidth = `${getColumnMinWidth(text, i)}px`;
    });
  }, [tableRef, storageKey]);

  return { startResize, syncCols, resetCols };
}
