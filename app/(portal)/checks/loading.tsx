/**
 * Loading UI — Next.js shows this automatically while the checks
 * dashboard server component fetches data from RDS. Prevents the
 * "nothing happens on click" feeling.
 */
export default function ChecksLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + spinner */}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-slate-400">Loading check data...</p>
        </div>
      </div>

      {/* 6 skeleton stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-28">
            <div className="h-3 bg-slate-200 rounded w-2/3 mb-3 animate-pulse" />
            <div className="h-7 bg-slate-200 rounded w-1/2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* 2 skeleton chart cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-56">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4 animate-pulse" />
            <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
