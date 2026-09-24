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
    <header className="h-[46px] bg-white border-b-2 border-red-500 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40 select-none shadow-2xs">
      {/* Left: Brand & Nav Tabs */}
      <div className="flex items-center gap-6">
        {/* Brand */}
        <Link href="/sales" className="flex items-center gap-1.5 no-underline">
          <span className="text-base font-black text-red-600 tracking-tight">ESPMI</span>
        </Link>

        {/* Navigation Tabs (matching exact screenshot 1) */}
        <nav className="flex items-center gap-1.5">
          <Link
            href="/sales/quote-builder"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              isQuoteGen
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Quote Generator
          </Link>

          <Link
            href="/sales/calculator"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              isCalc
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Calculator
          </Link>

          <Link
            href="/sales/catalog"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              isCatalog
                ? "bg-[#fee2e2] text-red-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            Product Info
          </Link>

          <Link
            href="/sales/closing-docs"
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
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
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
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
          className="text-slate-400 hover:text-slate-700 font-medium hidden md:inline transition-colors"
        >
          Portal
        </Link>
        <span className="text-slate-300 hidden md:inline">·</span>

        <span className="font-semibold text-slate-700">{userName}</span>
        <span className="text-slate-300">·</span>

        <Link
          href="/dashboard"
          className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer transition-colors"
        >
          Change Password
        </Link>
        <span className="text-slate-300">·</span>

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

