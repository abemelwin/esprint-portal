"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface MachinesTopNavProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  onAddMachine?: () => void;
  onExportCSV?: () => void;
}

export function MachinesTopNav({
  userName,
  userRole,
  isAdmin,
  onAddMachine,
  onExportCSV,
}: MachinesTopNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40 select-none shadow-2xs">
      {/* Left: ES Logo + Title + Subtitle */}
      <div className="flex items-center gap-3">
        {/* Red Circular ES Logo */}
        <Link href="/machines" className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-xs">
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 25H48C50 25 51 27 49 29L44 37H23V45H42C44 45 45 47 43 49L38 57H23V65H48C50 65 51 67 49 69L44 77H13C9 77 7 74 7 70V32C7 28 9 25 15 25Z"
                fill="white"
              />
              <path
                d="M58 34C58 28 62 25 68 25H90C96 25 100 28 100 34V38C100 42 97 45 92 47L75 51C71 52 69 53 69 55V58C69 60 71 62 75 62H90V54H100V66C100 72 96 76 90 76H68C62 76 58 72 58 66V62C58 58 61 55 66 53L83 49C87 48 89 47 89 45V42C89 40 87 38 83 38H58V34Z"
                fill="white"
              />
            </svg>
          </div>
        </Link>

        <div>
          <h1 className="text-base font-extrabold text-slate-900 leading-tight">
            Machine Monitoring System
          </h1>
          <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5 hidden sm:block">
            ES Print Group of Companies · inventory · incoming · reservations · deliveries
          </p>
        </div>
      </div>

      {/* Right User & Actions Bar (Matching Screenshot 2) */}
      <div className="flex items-center gap-2 text-xs">
        {/* User Role Badge */}
        <div className="px-3 py-1 bg-slate-100 rounded-full font-semibold text-slate-700 hidden md:flex items-center gap-1.5">
          <span>{userName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500 font-normal">{userRole}</span>
        </div>

        {/* Access Button */}
        {isAdmin && (
          <Link
            href="/machines/admin"
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-full font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Access</span>
          </Link>
        )}

        {/* Backup / Export CSV button */}
        <button
          onClick={onExportCSV}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-full font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="hidden sm:inline">Backup</span>
        </button>

        {/* CSV Button */}
        <button
          onClick={onExportCSV}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-full font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>CSV</span>
        </button>

        {/* Portal Home link */}
        <Link
          href="/dashboard"
          className="hidden md:inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-full font-semibold text-slate-600 shadow-2xs transition-colors"
        >
          Portal
        </Link>

        {/* Add Machine Button */}
        {onAddMachine && (
          <button
            onClick={onAddMachine}
            className="flex items-center gap-1 px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span>+ Add Machine</span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-full font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
