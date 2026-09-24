"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { SalesSidebar } from "./sales-sidebar";
import { initialsOf } from "@/lib/utils";

interface SalesShellProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  children: React.ReactNode;
}

export function SalesShell({
  userName,
  userRole,
  isAdmin,
  children,
}: SalesShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <PortalNav
        userName={userName}
        userRole={userRole}
        userInitials={initialsOf(userName)}
        currentModule="Sales Portal"
        onToggleMobileSidebar={() => setMobileOpen((o) => !o)}
        isMobileSidebarOpen={mobileOpen}
      />

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <SalesSidebar
          isAdmin={isAdmin}
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
