"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface SalesTopNavProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
}

export function SalesTopNav({ userName, isAdmin }: SalesTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isQuoteGen = pathname === "/sales" || pathname.startsWith("/sales/quote-builder");
  const isCalc = pathname.startsWith("/sales/calculator");
  const isCatalog = pathname.startsWith("/sales/catalog") && !pathname.startsWith("/sales/admin");
  const isClosingDocs = pathname.startsWith("/sales/closing-docs");
  const isEditor = pathname.startsWith("/sales/admin");

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-50 h-[40px] bg-white border-b-2 border-[#c0392b] shadow-[0_1px_6px_rgba(0,0,0,0.10)] select-none">
      <div className="flex items-center h-full w-full px-3 gap-3.5">
        {/* Brand */}
        <div className="shrink-0">
          <Link
            href="/sales/quote-builder"
            className="text-[13px] font-bold text-[#c0392b] hover:text-[#a93226] no-underline whitespace-nowrap"
          >
            ESPMI
          </Link>
        </div>

        {/* Nav Links */}
        <div className="flex items-center flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1 list-none m-0 p-0 flex-1 flex-nowrap">
            <li className="flex shrink-0">
              <Link
                href="/sales/quote-builder"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isQuoteGen
                    ? "text-[#c0392b] bg-[#fff2f0]"
                    : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}
              >
                Quote Generator
              </Link>
            </li>

            <li className="flex shrink-0">
              <Link
                href="/sales/calculator"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isCalc
                    ? "text-[#c0392b] bg-[#fff2f0]"
                    : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}
              >
                Calculator
              </Link>
            </li>

            <li className="flex shrink-0">
              <Link
                href="/sales/catalog"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isCatalog
                    ? "text-[#c0392b] bg-[#fff2f0]"
                    : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}
              >
                Product Info
              </Link>
            </li>

            <li className="flex shrink-0">
              <Link
                href="/sales/closing-docs"
                className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                  isClosingDocs
                    ? "text-[#c0392b] bg-[#fff2f0]"
                    : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                }`}
              >
                Closing Docs
              </Link>
            </li>

            {isAdmin && (
              <li className="flex shrink-0">
                <Link
                  href="/sales/admin"
                  className={`flex items-center px-3 py-1.5 text-[12px] font-bold rounded-[5px] whitespace-nowrap tracking-[0.3px] transition-colors leading-none no-underline ${
                    isEditor
                      ? "text-[#c0392b] bg-[#fff2f0]"
                      : "text-[#999] hover:text-[#c0392b] hover:bg-[#fff2f0]"
                  }`}
                >
                  Catalog Editor
                </Link>
              </li>
            )}
          </ul>

          {/* User info & Portal Home & Logout */}
          <div className="flex items-center gap-2 ml-auto shrink-0 text-[11px] text-[#888]">
            <span className="text-[11px] text-[#666] font-normal max-w-[200px] truncate hidden sm:inline">
              {userName || "Eileen Sokua"}
            </span>
            <span className="text-[#ccc] text-[11px] hidden sm:inline">·</span>
            <Link
              href="/dashboard"
              className="text-[11px] font-semibold text-[#c0392b] hover:underline no-underline"
            >
              ◂ Portal Home
            </Link>
            <span className="text-[#ccc] text-[11px]">·</span>
            <button
              onClick={handleLogout}
              className="text-[11px] font-semibold text-[#c0392b] hover:underline bg-transparent border-0 p-0 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
