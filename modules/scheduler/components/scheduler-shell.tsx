"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { SchedulerSidebar } from "./scheduler-sidebar";
import { initialsOf } from "@/lib/utils";

interface SchedulerShellProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  children: React.ReactNode;
}

export function SchedulerShell({ userName, userRole, isAdmin, children }: SchedulerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f8fafc]">
      {/* Top navigation */}
      <PortalNav
        userName={userName}
        userRole={userRole}
        userInitials={initialsOf(userName)}
        currentModule="Support Scheduler"
        onToggleMobileSidebar={() => setMobileOpen((o) => !o)}
        isMobileSidebarOpen={mobileOpen}
      />

      {/* Body */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50 lg:z-10
            transform transition-transform duration-200 ease-in-out
            ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            flex flex-col h-full bg-[#0b1329] shadow-xl lg:shadow-none
          `}
        >
          <SchedulerSidebar
            isAdmin={isAdmin}
            onClose={() => setMobileOpen(false)}
          />
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto p-3 sm:p-4 md:p-6 lg:px-7 lg:py-6 bg-[#f8fafc]">
          {children}
        </main>
      </div>
    </div>
  );
}
