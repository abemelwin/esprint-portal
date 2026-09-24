"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MachinesSubNav() {
  const pathname = usePathname();

  const isMachines = pathname === "/machines" || pathname === "/machines/";
  const isStock = pathname.startsWith("/machines/stock");
  const isTba = pathname.startsWith("/machines/tba");

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors ${
      active
        ? "bg-white border border-slate-200 shadow-xs font-bold text-slate-900"
        : "text-slate-500 hover:bg-white hover:text-slate-900"
    }`;

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 pt-4 pb-0 max-w-[1800px] mx-auto w-full">
      <Link href="/machines" className={tabClass(isMachines)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        <span>Machines</span>
      </Link>

      <Link href="/machines/stock" className={tabClass(isStock)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Stock Levels</span>
      </Link>

      <Link href="/machines/tba" className={tabClass(isTba)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span>TBA List</span>
      </Link>
    </div>
  );
}
