"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SchedulerSidebarProps {
  isAdmin?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV = [
  {
    href: "/scheduler",
    label: "Schedule",
    section: "VIEWS",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    href: "/scheduler/reports",
    label: "Reports",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    href: "/scheduler/overview",
    label: "Overview",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    adminOnly: false,
  },
  {
    href: "/scheduler/admin",
    label: "Admin Tools",
    section: "SETTINGS",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    adminOnly: true,
  },
];

export function SchedulerSidebar({ isAdmin = false, isOpen = false, onClose }: SchedulerSidebarProps) {
  const pathname = usePathname();

  const filteredNav = NAV.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Mobile close button only — no title banner */}
      {onClose && (
        <div className="p-3 border-b border-slate-800 flex justify-end lg:hidden">
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {filteredNav.map((item) => {
          const isActive =
            item.href === "/scheduler"
              ? pathname === "/scheduler"
              : pathname.startsWith(item.href);
          return (
            <div key={item.href}>
              {item.section && (
                <div className="px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {item.section}
                </div>
              )}
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm font-bold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <svg
                  width="16" height="16" fill="none" stroke="currentColor"
                  strokeWidth={isActive ? "2.5" : "2"} viewBox="0 0 24 24"
                  className={isActive ? "text-white" : "text-slate-400"}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Back to portal */}
      <div className="p-3 border-t border-slate-800">
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white rounded-lg border border-slate-700/60 transition-colors"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Portal Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-800 min-h-[calc(100vh-52px)] sticky top-[52px]">
        {content}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
