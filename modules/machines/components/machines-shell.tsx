"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { MachinesSidebar } from "./machines-sidebar";
import { initialsOf } from "@/lib/utils";

interface MachinesShellProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  children: React.ReactNode;
}

export function MachinesShell({
  userName,
  userRole,
  isAdmin,
  children,
}: MachinesShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Top Navigation */}
      <PortalNav
        userName={userName}
        userRole={userRole}
        userInitials={initialsOf(userName)}
        currentModule="Machine Monitoring"
        onToggleMobileSidebar={() => setMobileOpen((o) => !o)}
        isMobileSidebarOpen={mobileOpen}
      />

      {/* Main Body */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <MachinesSidebar
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
