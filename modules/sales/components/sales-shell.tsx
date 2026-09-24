"use client";

import { SalesTopNav } from "./SalesTopNav";

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
    <div className="flex flex-col min-h-screen bg-[#fff]">
      <SalesTopNav
        userName={userName}
        userRole={userRole}
        isAdmin={isAdmin}
      />

      <main className="flex-1 w-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
