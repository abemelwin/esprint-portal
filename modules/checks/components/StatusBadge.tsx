'use client';
import type { CheckStatus } from '@/modules/checks/lib/database.types';

interface BadgeConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const BADGE_MAP: Record<string, BadgeConfig> = {
  'HELD': {
    bg: 'bg-blue-50/90',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
  },
  'RETURNED': {
    bg: 'bg-rose-50/90',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
  },
  'CLEARED': {
    bg: 'bg-emerald-50/90',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  'DEPOSITED': {
    bg: 'bg-teal-50/90',
    text: 'text-teal-700',
    border: 'border-teal-200/80',
    dot: 'bg-teal-500',
  },
  'REPLACED': {
    bg: 'bg-emerald-50/90',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  'SETTLED (PAID)': {
    bg: 'bg-teal-50/90',
    text: 'text-teal-800',
    border: 'border-teal-300/80',
    dot: 'bg-teal-600',
  },
  'PARTIAL': {
    bg: 'bg-amber-50/90',
    text: 'text-amber-800',
    border: 'border-amber-300/80',
    dot: 'bg-amber-500',
  },
  'ALTERATION': {
    bg: 'bg-orange-50/90',
    text: 'text-orange-800',
    border: 'border-orange-200/80',
    dot: 'bg-orange-500',
  },
  'LEGAL': {
    bg: 'bg-purple-50/90',
    text: 'text-purple-800',
    border: 'border-purple-200/80',
    dot: 'bg-purple-500',
  },
  'RECONSTRUCT': {
    bg: 'bg-indigo-50/90',
    text: 'text-indigo-800',
    border: 'border-indigo-200/80',
    dot: 'bg-indigo-500',
  },
  'RECON REPLACED': {
    bg: 'bg-violet-100/90',
    text: 'text-violet-900',
    border: 'border-violet-300/80',
    dot: 'bg-violet-600',
  },
  'RECON REPLACEMENT': {
    bg: 'bg-violet-50/90',
    text: 'text-violet-800',
    border: 'border-violet-200/80',
    dot: 'bg-violet-500',
  },
  'OPEN': {
    bg: 'bg-slate-100/90',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    dot: 'bg-slate-400',
  },
  'CANCELLED': {
    bg: 'bg-slate-100/90',
    text: 'text-slate-600',
    border: 'border-slate-300/80',
    dot: 'bg-slate-400',
  },
  'BAD ACCOUNT': {
    bg: 'bg-rose-50/90',
    text: 'text-rose-800',
    border: 'border-rose-300/80',
    dot: 'bg-rose-600',
  },
  'BSP MEMO': {
    bg: 'bg-orange-50/90',
    text: 'text-orange-800',
    border: 'border-orange-200/80',
    dot: 'bg-orange-500',
  },
  'BSP MEMO XX': {
    bg: 'bg-orange-50/90',
    text: 'text-orange-800',
    border: 'border-orange-200/80',
    dot: 'bg-orange-500',
  },
};

const LABEL_MAP: Record<string, string> = {
  'SETTLED (PAID)': 'SETTLED (PAID)',
  'CANCELLED':      'Write-off / Blacklist',
  'BSP MEMO':       'ALTERATION',
  'BSP MEMO XX':    'ALTERATION',
};

interface Props {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: Props) {
  const config = BADGE_MAP[status] ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };
  const label = LABEL_MAP[status] ?? status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border shadow-xs whitespace-nowrap transition-all duration-150 ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{label}</span>
    </span>
  );
}
