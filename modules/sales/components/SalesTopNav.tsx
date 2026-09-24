"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface SalesTopNavProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
}

export function SalesTopNav({ userName, userRole, isAdmin }: SalesTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isQuoteGen = pathname === "/sales" || pathname.startsWith("/sales/quote-builder");
  const isCalc = pathname.startsWith("/sales/calculator");
  const isCatalog = pathname.startsWith("/sales/catalog") && !pathname.startsWith("/sales/admin");
  const isClosingDocs = pathname.startsWith("/sales/closing-docs");
  const isEditor = pathname.startsWith("/sales/admin");

  return (
    <header className="h-[46px] bg-white border-b-2 border-red-500 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40 select-none shadow-2xs">
      {/* Left: Brand & Nav Tabs */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Brand */}
        <Link href="/dashboard" title="Back to Portal Home" className="flex items-center gap-1.5 no-underline hover:opacity-90 transition-opacity">
          <span className="text-base font-black text-red-600 tracking-tight">ESPMI</span>
        </Link>

        {/* Prominent Portal Home Breadcrumb / Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md px-2 py-0.5 transition-colors"
          title="Return to Business Operations Portal Home"
        >
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden xs:inline">Portal Home</span>
        </Link>

        {/* Navigation Tabs (matching exact screenshot 1) */}
        <nav className="flex items-center gap-1.5 overflow-x-auto">
          <Link
            href="/sales/quote-builder"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
              isQuoteGen
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Quote Generator
          </Link>

          <Link
            href="/sales/calculator"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
              isCalc
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Calculator
          </Link>

          <Link
            href="/sales/catalog"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
              isCatalog
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Product Info
          </Link>

          <Link
            href="/sales/closing-docs"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
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
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
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

      {/* Right User & Links */}
      <div className="flex items-center gap-2.5 text-xs">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 font-bold text-slate-700 hover:text-red-600 transition-colors"
          title="Return to Portal Home"
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="hidden sm:inline">Portal Home</span>
        </Link>
        <span className="text-slate-300">·</span>

        <span className="font-semibold text-slate-700 hidden md:inline">{userName}</span>
        <span className="text-slate-300 hidden md:inline">·</span>

        <button
          onClick={handleLogout}
          className="text-red-600 hover:text-red-800 font-bold cursor-pointer transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}


