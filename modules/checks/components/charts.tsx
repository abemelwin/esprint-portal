"use client";

import { useState, useMemo } from "react";
import { fmtPHP } from "../lib/format";
import type { StatusSlice, BranchRow } from "../lib/summary";

/** Donut chart — ported verbatim from the original dashboard. */
export function DonutChart({ data }: { data: StatusSlice[] }) {
  const totalCount = data.reduce((s, i) => s + i.count, 0);
  const totalAmount = data.reduce((s, i) => s + i.amount, 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const radius = 70;
  const strokeWidth = 24;
  const size = 180;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const slices = data.map((item, idx) => {
    const percentage = totalCount ? item.count / totalCount : 0;
    const dashArray = `${percentage * circumference} ${circumference}`;
    const dashOffset = currentOffset;
    currentOffset -= percentage * circumference;
    return { ...item, dashArray, dashOffset, index: idx };
  });

  const activeItem = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 p-2 w-full">
      <div className="relative w-[180px] h-[180px] shrink-0 mx-auto">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#f8fafc" strokeWidth={strokeWidth} />
          {slices.map((slice) => (
            <circle
              key={slice.label}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={slice.index === hoveredIdx ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={slice.dashArray}
              strokeDashoffset={slice.dashOffset}
              className="transition-all duration-300 cursor-pointer"
              onMouseEnter={() => setHoveredIdx(slice.index)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ filter: slice.index === hoveredIdx ? "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" : "none" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none select-none">
          {activeItem ? (
            <>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase leading-none">{activeItem.label}</span>
              <span className="text-xl font-extrabold text-slate-800 mt-1 leading-none">{activeItem.count}</span>
              <span className="text-[10px] font-semibold text-slate-500 mt-1.5 leading-none truncate max-w-[120px]">{fmtPHP(activeItem.amount)}</span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase leading-none">TOTAL CHECKS</span>
              <span className="text-2xl font-black text-slate-800 mt-1 leading-none">{totalCount}</span>
              <span className="text-[10px] font-bold text-slate-500 mt-1.5 leading-none truncate max-w-[120px]">{fmtPHP(totalAmount)}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 w-full">
        {slices.map((slice) => (
          <div
            key={slice.label}
            className={`flex items-center justify-between p-2 rounded-xl border transition-all ${slice.index === hoveredIdx ? "bg-slate-50 border-slate-200" : "bg-transparent border-transparent"}`}
            onMouseEnter={() => setHoveredIdx(slice.index)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-xs font-bold text-slate-700">{slice.label}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-800 block leading-tight">{slice.count} check{slice.count !== 1 ? "s" : ""}</span>
              <span className="text-[10px] font-semibold text-slate-400 font-mono">{fmtPHP(slice.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Branch bar chart — ported verbatim from the original dashboard. */
export function BranchBarChart({ data }: { data: BranchRow[] }) {
  const branchBalances = useMemo(() => {
    return data
      .map((b) => ({ name: b.name, balance: b.heldAmt + b.retAmt }))
      .filter((b) => b.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [data]);

  const maxBalance = branchBalances.length > 0 ? branchBalances[0].balance : 1;

  return (
    <div className="p-2 space-y-4 w-full">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Top Branches by Outstanding Balance</div>
      <div className="space-y-3.5">
        {branchBalances.map((b) => {
          const widthPct = (b.balance / maxBalance) * 100;
          return (
            <div key={b.name} className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>{b.name}</span>
                <span className="font-mono text-slate-700">{fmtPHP(b.balance)}</span>
              </div>
              <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
        {branchBalances.length === 0 && (
          <div className="text-xs text-slate-400 italic text-center py-8">No branch balance data available</div>
        )}
      </div>
    </div>
  );
}
