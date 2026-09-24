"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SalesTopNavProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
}

export function SalesTopNav({ isAdmin }: SalesTopNavProps) {
  const pathname = usePathname();

  const isQuoteGen = pathname === "/sales" || pathname.startsWith("/sales/quote-builder");
  const isCalc = pathname.startsWith("/sales/calculator");
  const isCatalog = pathname.startsWith("/sales/catalog") && !pathname.startsWith("/sales/admin");
  const isClosingDocs = pathname.startsWith("/sales/closing-docs");
  const isEditor = pathname.startsWith("/sales/admin");

  return (
    <div className="h-[44px] bg-white border-b border-red-200 flex items-center justify-between px-4 sm:px-6 sticky top-[52px] z-30 select-none shadow-2xs">
      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1.5 overflow-x-auto">
        <Link
          href="/sales/quote-builder"
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            isQuoteGen
              ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
              : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
          }`}
        >
          Quote Generator
        </Link>

        <Link
          href="/sales/calculator"
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            isCalc
              ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
              : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
          }`}
        >
          Calculator
        </Link>

        <Link
          href="/sales/catalog"
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            isCatalog
              ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
              : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
          }`}
        >
          Product Info
        </Link>

        <Link
          href="/sales/closing-docs"
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            isClosingDocs
              ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
              : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
          }`}
        >
          Closing Docs
        </Link>

        {isAdmin && (
          <Link
            href="/sales/admin"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              isEditor
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Catalog Editor
          </Link>
        )}
      </nav>
    </div>
  );
}
