"use client";

import { useRouter } from "next/navigation";
import type { ModuleDef } from "@/lib/modules";

interface AppCardProps {
  module: ModuleDef;
  /** The user's role inside this module (shown as a tag). */
  roleLabel?: string;
  isModuleAdmin?: boolean;
}

export function AppCard({ module, roleLabel, isModuleAdmin }: AppCardProps) {
  const router = useRouter();
  const disabled = !module.enabled;

  function open() {
    if (disabled) return;
    router.push(module.path);
  }

  return (
    <div
      onClick={open}
      style={{
        background: "#fff",
        border: "1.5px solid #e2e8f0",
        borderRadius: 18,
        padding: 22,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: disabled ? 0.55 : 1,
        transition: "all .2s",
      }}
      onMouseOver={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,.1)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
        <div className={`bg-gradient-to-br ${module.gradient}`} style={{ width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
          <ModuleIcon name={module.icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", letterSpacing: "-.2px" }}>{module.name}</p>
          <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{module.subtitle}</p>
        </div>
        {!disabled && (
          <svg width="15" height="15" fill="none" stroke="#cbd5e1" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {disabled ? (
          <span style={{ fontSize: 10, fontWeight: 700, background: "#f1f5f9", color: "#94a3b8", padding: "3px 10px", borderRadius: 999 }}>Coming soon</span>
        ) : (
          <>
            {roleLabel && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", padding: "3px 10px", borderRadius: 999 }}>{roleLabel}</span>
            )}
            {isModuleAdmin && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: 999 }}>Module Admin</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Minimal inline icon set (avoids extra runtime dep issues). */
function ModuleIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, fill: "none", stroke: "white", strokeWidth: 2, viewBox: "0 0 24 24" } as const;
  switch (name) {
    case "CircleCheck":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "Users":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "Printer":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
    case "CalendarDays":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "Receipt":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "MessageSquare":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
    default:
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>;
  }
}
