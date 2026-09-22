'use client';
/**
 * SelectField — cross-browser custom styled <select>.
 * Direct port from esprint-check-monitoring/components/SelectField.tsx.
 */
import type { ReactNode } from 'react';

interface Props {
  value:     string;
  onChange:  (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children:  ReactNode;
  cls?:      string;
  disabled?: boolean;
  onFocus?:  () => void;
  onBlur?:   () => void;
}

const BASE = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all appearance-none cursor-pointer pr-9';

export default function SelectField({ value, onChange, children, cls, disabled, onFocus, onBlur }: Props) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cls ?? BASE}
        style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </div>
  );
}
