'use client';
/**
 * Toast notification system.
 * Direct port from esprint-check-monitoring/components/Toast.tsx.
 */
import { createContext, useCallback, useContext, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warn' | 'info';

interface ToastItem {
  id:       string;
  type:     ToastType;
  title:    string;
  message?: string;
  leaving:  boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, string> = {
  success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️',
};

const BORDER_CLASSES: Record<ToastType, string> = {
  success: 'border-l-emerald-500 bg-emerald-50/20',
  error:   'border-l-rose-500 bg-rose-50/20',
  warn:    'border-l-amber-500 bg-amber-50/20',
  info:    'border-l-blue-500 bg-blue-50/20',
};

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Success', error: 'Error', warn: 'Warning', info: 'Info',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 220);
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'success',
    title = '',
    duration = 4000,
  ) => {
    const id = 'toast-' + Date.now() + Math.random();
    setToasts(t => [...t, { id, type, title: title || DEFAULT_TITLES[type], message, leaving: false }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 bg-white/95 backdrop-blur-md rounded-xl p-4
              shadow-[0_10px_30px_-5px_rgba(15,23,42,0.18)] border border-slate-200/80 border-l-4 ${BORDER_CLASSES[t.type]}
              ${t.leaving ? 'opacity-0 translate-y-1 transition-all duration-200' : 'opacity-100 transition-all duration-200'}`}
          >
            <span className="text-lg leading-none mt-0.5 shrink-0">{ICONS[t.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">{t.title}</div>
              {t.message && <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{t.message}</div>}
            </div>
            <button onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-700 text-base font-semibold leading-none shrink-0 p-1 rounded-md transition-colors">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
