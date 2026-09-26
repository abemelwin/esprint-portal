"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

interface MachinesSubNavProps {
  isAdmin?: boolean;
  onAddMachine?: () => void;
  onImport?: () => void;
  onBackup?: () => void;
  onExportCSV?: () => void;
}

export function MachinesSubNav({
  isAdmin = true,
  onAddMachine,
  onImport,
  onBackup,
  onExportCSV,
}: MachinesSubNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const isMachines = pathname === "/machines" || pathname === "/machines/";
  const isStock = pathname.startsWith("/machines/stock");
  const isTba = pathname.startsWith("/machines/tba");
  const isAdminPage = pathname.startsWith("/machines/admin");

  // Close settings panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleAction(actionFn?: () => void) {
    if (actionFn) {
      actionFn();
    }
    setSettingsOpen(false);
  }

  function handleGoAccess() {
    setSettingsOpen(false);
    router.push("/machines/admin");
  }

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
      active
        ? "bg-white border border-slate-200 shadow-xs font-bold text-slate-900"
        : "text-slate-500 hover:bg-white hover:text-slate-900"
    }`;

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-0 max-w-[1800px] mx-auto w-full relative">
      <div className="flex items-center gap-2">
        <Link href="/machines" className={tabClass(isMachines)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <span>Machines</span>
        </Link>

        <Link href="/machines/stock" className={tabClass(isStock)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Stock Levels</span>
        </Link>

        <Link href="/machines/tba" className={tabClass(isTba)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>TBA List</span>
        </Link>

        {/* ⚙ Settings Tab (Placed next to TBA List) */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className={tabClass(settingsOpen || isAdminPage)}
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>

          {/* Dropdown Panel */}
          {settingsOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleGoAccess}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer border-b border-slate-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Access Control</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleAction(onImport || (() => window.dispatchEvent(new CustomEvent("machines:import"))))}
                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer border-b border-slate-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Import Data</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction(onBackup || (() => window.dispatchEvent(new CustomEvent("machines:backup"))))}
                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer border-b border-slate-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Backup</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction(onExportCSV || (() => window.dispatchEvent(new CustomEvent("machines:export-csv"))))}
                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: + Add Machine Button */}
      {onAddMachine && (
        <button
          type="button"
          onClick={onAddMachine}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Machine</span>
        </button>
      )}
    </div>
  );
}
