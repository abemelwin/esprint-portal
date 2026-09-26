"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface MachinesTopNavProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  onAddMachine?: () => void;
}

export function MachinesTopNav({
  userName,
  userRole,
  isAdmin,
  onAddMachine,
}: MachinesTopNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-[52px] bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 sticky top-0 z-40 select-none shadow-xs">
      {/* Left: ES Logo + ES Print Media Inc. + Subtitle + Chevron > + Module Title + Portal Home link */}
      <div className="flex items-center gap-2">
        {/* ES Print Logo */}
        <Link href="/dashboard" title="Back to Portal Home" className="shrink-0 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.jpg"
            alt="ES Print Logo"
            width={36}
            height={36}
            className="rounded-full object-cover border border-slate-200"
          />
        </Link>

        <div>
          <h1 className="text-[13.5px] font-extrabold text-slate-900 leading-tight">
            ES Print Media Inc.
          </h1>
          <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 hidden sm:block">
            Business Operations Portal
          </p>
        </div>

        {/* Chevron Divider > */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" className="mx-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        {/* Module Title */}
        <Link href="/machines" className="text-[13.5px] font-bold text-slate-800 hover:text-blue-600 transition-colors">
          Machine Monitoring System
        </Link>

        {/* Compact Portal Home Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 transition-colors ml-1"
          title="Return to Business Operations Portal Home"
        >
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Portal Home</span>
        </Link>
      </div>

      {/* Right: User + Action Buttons */}
      <div className="flex items-center gap-1.5 text-xs">
        {/* User badge */}
        <span className="hidden md:block text-[11.5px] font-semibold text-slate-700 mr-1">
          {userName} <span className="font-normal text-slate-400">· {userRole}</span>
        </span>

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
