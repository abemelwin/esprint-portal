"use client";

interface Props {
  view: string;
  setView: (v: string) => void;
  canViewOverview: boolean;
}

export function SchedulerBottomNav({ view, setView, canViewOverview }: Props) {
  const tabs = [
    { key: "calendar", icon: "📅", label: "Schedule" },
    { key: "reports",  icon: "📊", label: "Reports"  },
    ...(canViewOverview ? [{ key: "overview", icon: "🗺", label: "Overview" }] : []),
  ];

  return (
    <nav style={{
      position: "sticky",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#fff",
      borderTop: "1px solid rgba(15,23,42,.08)",
      boxShadow: "0 -1px 8px rgba(15,23,42,.06)",
      display: "flex",
      alignItems: "stretch",
      zIndex: 40,
      flexShrink: 0,
    }}>
      {tabs.map(t => {
        const active = view === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "10px 8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              borderTop: active ? "2px solid #2563eb" : "2px solid transparent",
              color: active ? "#2563eb" : "#64748b",
              fontWeight: active ? 700 : 500,
              fontSize: 11.5,
              transition: "all .15s",
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
