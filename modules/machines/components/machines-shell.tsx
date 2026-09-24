"use client";

import { MachinesTopNav } from "./MachinesTopNav";
import { MachinesSubNav } from "./MachinesSubNav";

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
  function handleAddMachine() {
    window.dispatchEvent(new CustomEvent("machines:open-add"));
  }

  function handleExportCSV() {
    window.dispatchEvent(new CustomEvent("machines:export-csv"));
  }

  function handleBackup() {
    window.dispatchEvent(new CustomEvent("machines:backup"));
  }

  function handleImport() {
    window.dispatchEvent(new CustomEvent("machines:import"));
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <MachinesTopNav
        userName={userName}
        userRole={userRole}
        isAdmin={isAdmin}
        onAddMachine={handleAddMachine}
        onExportCSV={handleExportCSV}
        onBackup={handleBackup}
        onImport={handleImport}
      />

      <MachinesSubNav />

      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
