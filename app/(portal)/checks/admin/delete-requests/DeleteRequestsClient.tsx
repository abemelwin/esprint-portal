'use client';
/**
 * DeleteRequestsClient — admin workflow for approving/rejecting
 * user-submitted delete requests (for checks or events).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/checks/components/Toast';
import { fmtDate } from '@/modules/checks/lib/format';
import type { DeleteRequestItem } from './page';

export function DeleteRequestsClient({ initialRows }: { initialRows: DeleteRequestItem[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [rows,   setRows]   = useState(initialRows);
  const [acting, setActing] = useState<string | null>(null);

  async function handle(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      const res  = await fetch('/api/checks/delete-requests', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ requestId:id, action }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed');
      showToast(action === 'approve' ? 'Request approved — check/event deleted.' : 'Request rejected.', action === 'approve' ? 'success' : 'warn');
      // Update status locally so feedback is instant
      setRows(p => p.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
      router.refresh();
    } catch (err) {
      showToast((err as Error).message ?? 'Error', 'error');
    } finally {
      setActing(null);
    }
  }

  const pending  = rows.filter(r => r.status === 'pending');
  const resolved = rows.filter(r => r.status !== 'pending');

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Delete Requests</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Users without delete permission can request deletion here. Admins approve or reject.
        </p>
      </div>

      {/* Pending */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-8 text-center text-gray-400 italic text-sm">
            No pending delete requests 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.targetType === 'event' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                        {r.targetType === 'event' ? '🗒 Event' : '🗑 Check'}
                      </span>
                      {r.bank && r.checkNo && (
                        <span className="font-mono text-sm font-semibold text-gray-800">{r.bank} {r.checkNo}</span>
                      )}
                      {r.client && <span className="text-xs text-gray-500">{r.client}</span>}
                    </div>
                    <p className="text-sm text-gray-700">
                      <strong className="text-gray-900">Reason:</strong> {r.reason}
                    </p>
                    <p className="text-xs text-gray-500">
                      Requested by <strong>{r.requestedByName}</strong> ({r.requestedBy}) · {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handle(r.id, 'reject')}
                      disabled={acting === r.id}
                      className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {acting === r.id ? '…' : '✕ Reject'}
                    </button>
                    <button
                      onClick={() => handle(r.id, 'approve')}
                      disabled={acting === r.id}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {acting === r.id ? 'Processing…' : '✓ Approve & Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500">Recent resolved ({resolved.length})</h2>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="report w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Type</th>
                  <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Check</th>
                  <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Reason</th>
                  <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Requested By</th>
                  <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Status</th>
                  <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map(r => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5">{r.targetType === 'event' ? '🗒 Event' : '🗑 Check'}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{r.bank} {r.checkNo}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.requestedByName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
