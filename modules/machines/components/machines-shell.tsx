"use client";

import { PortalNav } from "@/components/portal-nav";
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
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <PortalNav
        userName={userName}
        userRole={userRole}
        userInitials={initialsOf(userName)}
        currentModule="Machine Monitoring"
      />

      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
