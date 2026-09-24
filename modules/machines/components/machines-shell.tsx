"use client";

import { MachinesTopNav } from "./MachinesTopNav";

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
      <MachinesTopNav
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
