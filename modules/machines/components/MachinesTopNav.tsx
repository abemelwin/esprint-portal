"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface MachinesTopNavProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  onAddMachine?: () => void;
  onExportCSV?: () => void;
  onImport?: () => void;
  onBackup?: () => void;
}

export function MachinesTopNav({
  userName,
  userRole,
  isAdmin,
  onAddMachine,
  onExportCSV,
  onImport,
  onBackup,
}: MachinesTopNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-[52px] bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 sticky top-0 z-40 select-none shadow-sm">
      {/* Left: ES Logo + Title + Subtitle + Portal Home link */}
      <div className="flex items-center gap-2.5">
        {/* ES Print Logo */}
        <Link href="/dashboard" title="Back to Portal Home" className="shrink-0 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.jpg"
            alt="ES Print Logo"
            width={36}
            height={36}
            className="rounded-full object-cover shadow-sm border border-slate-200"
          />
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <Link href="/machines" className="text-[13px] font-extrabold text-slate-900 leading-tight hover:text-blue-600 transition-colors">
              Machine Monitoring System
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 transition-colors"
              title="Return to Business Operations Portal Home"
            >
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Portal Home</span>
            </Link>
          </div>
          <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 hidden sm:block">
            ES Print Group of Companies · inventory · incoming · reservations · deliveries
          </p>
        </div>
      </div>

      {/* Right: User + Action Buttons */}
      <div className="flex items-center gap-1.5 text-xs">
        {/* User badge */}
        <span className="hidden md:block text-[11.5px] font-semibold text-slate-700 mr-1">
          {userName} <span className="font-normal text-slate-400">· {userRole}</span>
        </span>

        {/* Access (admin only) */}
        {isAdmin && (
          <Link
            href="/machines/admin"
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Access</span>
          </Link>
        )}

        {/* Import */}
        <button
          onClick={onImport}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Import</span>
        </button>

        {/* Backup */}
        <button
          onClick={onBackup}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="hidden sm:inline">Backup</span>
        </button>

        {/* CSV */}
        <button
          onClick={onExportCSV}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>CSV</span>
        </button>

        {/* Bell / Notifications */}
        <button
          className="flex items-center justify-center w-7 h-7 bg-white border border-slate-200 hover:bg-slate-50 rounded text-slate-600 shadow-2xs transition-colors cursor-pointer"
          title="Notifications"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* + Add Machine */}
        <button
          onClick={onAddMachine}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <span>+ Add Machine</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
