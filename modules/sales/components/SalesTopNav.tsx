"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SalesTopNavProps {
  userName?: string;
  userRole?: string;
  isAdmin: boolean;
  canCreateQuotes?: boolean;
  useCalculator?: boolean;
}

export function SalesTopNav({
  isAdmin,
  canCreateQuotes = true,
  useCalculator = true,
}: SalesTopNavProps) {
  const pathname = usePathname();

  const isQuoteGen  = pathname.startsWith("/sales/quote-builder");
  const isCalc      = pathname.startsWith("/sales/calculator");
  const isCatalog   = pathname.startsWith("/sales/catalog") && !pathname.startsWith("/sales/admin");
  const isEditor    = pathname.startsWith("/sales/admin");

  return (
    <nav className="h-[40px] bg-white border-b-2 border-[#c0392b] flex items-center px-3 sm:px-4 select-none shadow-[0_1px_6px_rgba(0,0,0,0.10)] sticky top-[52px] z-20">
      <div className="flex items-center gap-3 w-full">
        <span className="text-[13px] font-bold text-[#c0392b] tracking-wide shrink-0 hidden sm:inline-block">
          ESPMI
        </span>
        <ul className="flex items-center gap-1 list-none m-0 p-0 flex-1 flex-nowrap overflow-x-auto">
          {canCreateQuotes && (
            <li className="flex shrink-0">
              <Link href="/sales/quote-builder"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isQuoteGen ? "text-[#c0392b] bg-[#fff2f0]" : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}>
                Quote Generator
              </Link>
            </li>
          )}

          {useCalculator && (
            <li className="flex shrink-0">
              <Link href="/sales/calculator"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isCalc ? "text-[#c0392b] bg-[#fff2f0]" : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}>
                Calculator
              </Link>
            </li>
          )}

          <li className="flex shrink-0">
            <Link href="/sales/catalog"
              className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                isCatalog ? "text-[#c0392b] bg-[#fff2f0]" : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
              }`}>
              Product Info
            </Link>
          </li>

          {isAdmin && (
            <li className="flex shrink-0">
              <Link href="/sales/admin"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isEditor ? "text-[#c0392b] bg-[#fff2f0]" : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}>
                Catalog Editor
              </Link>
            </li>
          )}

          {isAdmin && (
            <li className="flex shrink-0">
              <Link href="/sales/users"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  pathname.startsWith("/sales/users") ? "text-[#c0392b] bg-[#fff2f0]" : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}>
                Users & Access
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
