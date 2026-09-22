'use client';
/**
 * DeletedChecksClient — lists soft-deleted checks with a Recover button.
 * Calls POST /api/checks/recover then router.refresh().
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/checks/components/Toast';
import { fmtPHP, fmtDate } from '@/modules/checks/lib/format';

interface DeletedItem {
  id:             string;
  checkId:        string;
  client:         string;
  bank:           string;
  checkNo:        string;
  checkDate:      string;
  originalAmount: number;
  deletedByName:  string;
  deletedAt:      string;
}

export function DeletedChecksClient({ items: initial }: { items: DeletedItem[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [items,     setItems]     = useState(initial);
  const [recovering,setRecovering]= useState<string | null>(null);
  const [search,    setSearch]    = useState('');

  async function recover(id: string) {
    setRecovering(id);
    try {
      const res  = await fetch('/api/checks/recover', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ deletedRowId:id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Recovery failed');
      showToast('Check restored successfully', 'success');
      setItems(p => p.filter(x => x.id !== id));
      router.refresh();
    } catch (err) {
      showToast((err as Error).message ?? 'Recovery failed', 'error');
    } finally {
      setRecovering(null);
    }
  }

  const filtered = items.filter(r =>
    !search ||
    r.client.toLowerCase().includes(search.toLowerCase()) ||
    r.checkNo.toLowerCase().includes(search.toLowerCase()) ||
    r.bank.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Deleted Checks</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Archive of soft-deleted checks ({items.length} records). Recovering restores the check and all its events.
        </p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search client, check #, bank…"
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white w-full max-w-sm focus:outline-none focus:border-blue-600"
      />

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="report w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Client</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Bank / Check #</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Check Date</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px] text-right">Amount</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Deleted By</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Deleted At</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-800 font-medium">{r.client}</td>
                <td className="px-4 py-2.5 font-mono text-gray-700">{r.bank} {r.checkNo}</td>
                <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.checkDate)}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtPHP(r.originalAmount)}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.deletedByName}</td>
                <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.deletedAt)}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => recover(r.id)}
                    disabled={recovering === r.id}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {recovering === r.id ? 'Restoring…' : '↩ Recover'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 italic">
                {items.length === 0 ? 'No deleted checks' : 'No matches for your search'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
