'use client';
/**
 * useStickyScrollbar — floating horizontal scrollbar + drag-to-scroll.
 * Direct port from esprint-check-monitoring/hooks/useStickyScrollbar.ts.
 */
import { useEffect, useRef, useCallback } from 'react';

export function useStickyScrollbar(containerRef: React.RefObject<HTMLDivElement | null>) {
  const cleanupRef = useRef<(() => void) | null>(null);

  const setup = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    if (cleanupRef.current) return true;

    function getScrollParent(el: HTMLElement): HTMLElement | Window {
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        const style = window.getComputedStyle(node);
        const overflow = style.overflow + style.overflowY;
        if (/auto|scroll/.test(overflow) && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return window;
    }

    const bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;overflow-x:scroll;overflow-y:hidden;z-index:45;height:14px;background:rgba(241,245,249,0.96);backdrop-filter:blur(6px);border-top:1px solid #cbd5e1;box-shadow:0 -4px 12px rgba(15,23,42,0.12);border-radius:6px 6px 0 0;display:none;';
    const inner = document.createElement('div');
    inner.style.height = '1px';
    bar.appendChild(inner);
    document.body.appendChild(bar);

    let syncing = false;

    function sync() {
      if (!container || !bar || !inner) return;
      const rect = container.getBoundingClientRect();
      const needsScroll = container.scrollWidth > container.clientWidth + 2;
      const scrollParent = getScrollParent(container);
      const viewportBottom = scrollParent === window ? window.innerHeight : (scrollParent as HTMLElement).getBoundingClientRect().bottom;
      const nativeScrollbarVisible = rect.bottom <= viewportBottom;
      if (!needsScroll || nativeScrollbarVisible || rect.top > viewportBottom || rect.bottom < 40) { bar.style.display = 'none'; return; }
      bar.style.display = 'block';
      bar.style.left = `${Math.max(0, rect.left)}px`;
      bar.style.width = `${Math.min(rect.width, window.innerWidth - Math.max(0, rect.left))}px`;
      inner.style.width = `${container.scrollWidth}px`;
      if (!syncing) { syncing = true; bar.scrollLeft = container.scrollLeft; syncing = false; }
    }

    function onBarScroll() { if (syncing || !container) return; syncing = true; container.scrollLeft = bar.scrollLeft; syncing = false; }
    function onContainerScroll() { if (syncing || !bar || !container) return; syncing = true; bar.scrollLeft = container.scrollLeft; syncing = false; }

    bar.addEventListener('scroll', onBarScroll, { passive: true });
    container.addEventListener('scroll', onContainerScroll, { passive: true });
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });

    const scrollParent = getScrollParent(container);
    const scrollParentEl = scrollParent !== window ? scrollParent as HTMLElement : null;
    if (scrollParentEl) scrollParentEl.addEventListener('scroll', sync, { passive: true });

    const ro = new ResizeObserver(sync);
    ro.observe(container);
    if (container.firstElementChild) ro.observe(container.firstElementChild);
    sync();
    const t1 = setTimeout(sync, 150);
    const t2 = setTimeout(sync, 500);

    let isDown = false, startX = 0, scrollLeftStart = 0, hasDragged = false;
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0 || !container) return;
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('input,button,select,textarea,a,label') || target.style.cursor === 'col-resize' || target.closest('[style*="col-resize"]')) return;
      isDown = true; hasDragged = false; startX = e.clientX; scrollLeftStart = container.scrollLeft;
    }
    function onMouseMove(e: MouseEvent) {
      if (!isDown || !container) return;
      const dx = e.clientX - startX;
      if (!hasDragged && Math.abs(dx) > 4) { hasDragged = true; container.style.cursor = 'grabbing'; container.style.userSelect = 'none'; }
      if (hasDragged) container.scrollLeft = scrollLeftStart - dx;
    }
    function onMouseUp() {
      if (!isDown) return; isDown = false;
      if (container) { container.style.cursor = ''; container.style.userSelect = ''; }
      if (hasDragged) {
        const captureClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', captureClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', captureClick, { capture: true }), 120);
      }
    }
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);

    cleanupRef.current = () => {
      bar.removeEventListener('scroll', onBarScroll);
      container.removeEventListener('scroll', onContainerScroll);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      if (scrollParentEl) scrollParentEl.removeEventListener('scroll', sync);
      clearTimeout(t1); clearTimeout(t2);
      ro.disconnect(); bar.remove(); cleanupRef.current = null;
    };
    return true;
  }, [containerRef]);

  useEffect(() => {
    if (setup()) return () => cleanupRef.current?.();
    const observer = new MutationObserver(() => { if (containerRef.current && setup()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cleanupRef.current?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
