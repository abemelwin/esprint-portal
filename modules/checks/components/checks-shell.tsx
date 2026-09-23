"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { ChecksSidebar } from "./checks-sidebar";
import { initialsOf } from "@/lib/utils";

interface ChecksShellProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  isAE: boolean;
  isAEAccess: boolean;
  isTL: boolean;
  children: React.ReactNode;
}

export function ChecksShell({
  userName,
  userRole,
  isAdmin,
  isAE,
  isAEAccess,
  isTL,
  children,
}: ChecksShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close mobile drawer when navigating to a new page
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#eef4fb]">
      {/* Top Navigation */}
      <PortalNav
        userName={userName}
        userRole={userRole}
        userInitials={initialsOf(userName)}
        currentModule="Check Monitoring"
        onToggleMobileSidebar={() => setMobileOpen((o) => !o)}
        isMobileSidebarOpen={mobileOpen}
      />

      {/* Main Body with Sidebar + Responsive Content */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Mobile Backdrop Overlay (< 1024px) */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* Sidebar: Desktop fixed/collapsed + Mobile slideover drawer */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50 lg:z-10
            transform transition-transform duration-200 ease-in-out
            ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            flex flex-col h-full bg-[#0b1329] shadow-xl lg:shadow-none
          `}
        >
          <ChecksSidebar
            userName={userName}
            userRole={userRole}
            isAdmin={isAdmin}
            isAE={isAE}
            isAEAccess={isAEAccess}
            isTL={isTL}
            onItemClick={() => setMobileOpen(false)}
          />
        </aside>

        {/* Page Content Container with responsive device padding */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto p-3 sm:p-4.5 md:p-6 lg:px-7 lg:py-6 bg-[#eef4fb]">
          {children}
        </main>
      </div>
    </div>
  );
}
