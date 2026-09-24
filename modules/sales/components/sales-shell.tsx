"use client";

import { PortalNav } from "@/components/portal-nav";
import { SalesTopNav } from "./SalesTopNav";
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
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <PortalNav
        userName={userName}
        userRole={userRole}
        userInitials={initialsOf(userName)}
        currentModule="Sales Portal"
      />

      <SalesTopNav
        userName={userName}
        userRole={userRole}
        isAdmin={isAdmin}
      />

      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
