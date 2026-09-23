/**
 * ReportLoading — shared skeleton for all report pages.
 * Next.js shows this automatically while the server component fetches data.
 */
export default function ReportLoading() {
  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="space-y-1.5">
          <div className="h-5 bg-slate-200 rounded w-40 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded w-64 animate-pulse" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" style={{ width: `${80 + i * 20}px` }} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="bg-[#1e3a8a] flex gap-4 px-4 py-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 bg-blue-300/40 rounded flex-1 animate-pulse" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="flex gap-4 px-4 py-3 border-b border-slate-100">
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                className="h-3 bg-slate-100 rounded animate-pulse"
                style={{ flex: 1, opacity: 1 - row * 0.08 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
