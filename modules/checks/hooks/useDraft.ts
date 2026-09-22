'use client';
/**
 * useDraft — auto-saves form state to localStorage every 2 seconds.
 * Direct port from esprint-check-monitoring/hooks/useDraft.ts.
 */
import { useEffect, useRef, useCallback } from 'react';

const DRAFT_PREFIX = 'esprint_draft_';
const AUTOSAVE_MS  = 2000;

export function useDraft<T extends object>(
  key: string,
  form: T,
  setForm: (f: T) => void,
) {
  const storageKey = `${DRAFT_PREFIX}${key}`;

  function loadRaw(): T | null {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }

  function isEmpty(f: T) {
    return Object.values(f).every(v => v === '' || v == null);
  }

  const saveDraft = useCallback(() => {
    if (isEmpty(form)) return;
    try { localStorage.setItem(storageKey, JSON.stringify(form)); } catch {}
  }, [form, storageKey]);

  useEffect(() => {
    const t = setInterval(saveDraft, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [saveDraft]);

  useEffect(() => {
    return () => {
      if (!isEmpty(form)) {
        try { localStorage.setItem(storageKey, JSON.stringify(form)); } catch {}
      }
    };
  }, [form, storageKey]);

  const hasDraft = (() => {
    const d = loadRaw();
    return !!d && !isEmpty(d);
  })();

  const restoreDraft = useCallback(() => {
    const d = loadRaw();
    if (d) setForm(d);
  }, [storageKey, setForm]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  return { hasDraft, restoreDraft, clearDraft };
}
