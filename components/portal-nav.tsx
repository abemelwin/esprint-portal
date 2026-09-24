"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface PortalNavProps {
  userName: string;
  userRole: string;
  userInitials: string;
  /** Current module name shown in breadcrumb (empty on dashboard). */
  currentModule?: string;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export function PortalNav({
  userName,
  userRole,
  userInitials,
  currentModule,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}: PortalNavProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex-shrink-0 h-[52px] bg-white border-b border-slate-200 flex items-center px-3 sm:px-4.5 gap-2 sm:gap-3 shadow-xs z-30 sticky top-0">
      {/* Mobile Hamburger toggle (visible < 1024px) */}
      {onToggleMobileSidebar && (
        <button
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center -ml-1 mr-1"
        >
          {isMobileSidebarOpen ? (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      )}

      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2 sm:gap-2.5 no-underline shrink-0">
        <div className="w-[30px] h-[30px] rounded-lg overflow-hidden bg-white flex items-center justify-center shadow-md">
          <img src="/logo.jpg" alt="ES Print Media Inc." className="w-full h-full object-cover" />
        </div>
        <div className="hidden xs:block sm:block">
          <p className="text-[13px] font-extrabold text-slate-900 leading-tight">ES Print Media Inc.</p>
          <p className="text-[9.5px] text-slate-400 font-medium hidden sm:block">Business Operations Portal</p>
        </div>
      </Link>

      {/* Breadcrumbs */}
      {currentModule && (
        <div className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2 min-w-0">
          <svg className="hidden sm:block shrink-0" width="12" height="12" fill="none" stroke="#cbd5e1" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs sm:text-[13px] font-bold text-slate-700 truncate max-w-[120px] sm:max-w-none">
            {currentModule}
          </span>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md px-2.5 py-1 no-underline ml-1 transition-colors"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Portal Home</span>
          </Link>
        </div>
      )}

      <div className="flex-1" />

      {/* User Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 py-1 px-1.5 sm:px-2 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-xs">
          {userInitials}
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight truncate max-w-[150px]">{userName}</p>
          <p className="text-[10px] sm:text-[10.5px] text-slate-400 font-medium truncate max-w-[150px]">{userRole}</p>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={logout}
        className="flex items-center gap-1.5 text-xs sm:text-[12.5px] font-semibold text-red-500 border border-red-200 hover:bg-red-50 rounded-lg px-2.5 sm:px-3.5 py-1.5 bg-white cursor-pointer transition-colors shrink-0"
        title="Logout"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span className="hidden sm:inline">Logout</span>
      </button>
    </header>
  );
}
