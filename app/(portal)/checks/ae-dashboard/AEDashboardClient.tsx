'use client';
/**
 * AE Dashboard — overview for Team Leaders of their assigned Account
 * Executives and each AE's pending checks. Ported from the original
 * esprint-check-monitoring/app/ae-dashboard/page.tsx.
 */
import { useRouter } from 'next/navigation';
import { fmtPHP } from '@/modules/checks/lib/format';

export interface AESummary {
  aeCode: string;
  subsidiaries: string[];
  branches: string[];
  totalChecks: number;
  pendingCount: number;
  pendingAmount: number;
  overdueCount: number;
}

export function AEDashboardClient({ summaries }: { summaries: AESummary[] }) {
  const router = useRouter();

  const totalPending = summaries.reduce((s, a) => s + a.pendingCount, 0);
  const totalPendingAmt = summaries.reduce((s, a) => s + a.pendingAmount, 0);
  const totalOverdue = summaries.reduce((s, a) => s + a.overdueCount, 0);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">AE Dashboard</h1>
          <p className="text-sm text-gray-500">
            Overview of your assigned Account Executives and their pending checks.
          </p>
        </div>
        <button
          onClick={() => router.push('/checks/reports/clients')}
          className="px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-800 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
          Client Report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Assigned AEs</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{summaries.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Total Pending</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{totalPending}</div>
          <div className="text-xs text-gray-500 mt-0.5">{fmtPHP(totalPendingAmt)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Overdue</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{totalOverdue}</div>
        </div>
      </div>

      {/* Per-AE cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700">Account Executives</h2>
        {summaries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-gray-400 italic">
            No AEs assigned to your account.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaries.map((ae) => (
              <div
                key={ae.aeCode}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/checks/reports/clients?ae=${encodeURIComponent(ae.aeCode)}`)}
              >
                {/* AE Code header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {ae.aeCode.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{ae.aeCode}</div>
                      <div className="text-[10px] text-gray-400">Account Executive</div>
                    </div>
                  </div>
                  {ae.overdueCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                      {ae.overdueCount} overdue
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Subsidiary</span>
                    <span className="font-semibold text-gray-800">{ae.subsidiaries.join(', ') || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Branch</span>
                    <span className="font-semibold text-gray-800">{ae.branches.join(', ') || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Pending Checks</span>
                    <span className={`font-bold ${ae.pendingCount > 0 ? 'text-amber-700' : 'text-green-600'}`}>
                      {ae.pendingCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Pending Amount</span>
                    <span className="font-semibold text-gray-800">{fmtPHP(ae.pendingAmount)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{ae.totalChecks} total checks</span>
                  <span className="text-[10px] font-semibold text-blue-600">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
