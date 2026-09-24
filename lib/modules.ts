/**
 * Module Registry — the single source of truth for all portal modules.
 *
 * Each module represents one of the consolidated systems. Adding a new
 * module (HRIS, Machines, etc.) later = add an entry here + build its
 * pages under app/(portal)/<key>/.
 */

export type ModuleKey =
  | "checks"
  | "hris"
  | "machines"
  | "scheduler"
  | "sales"
  | "support";

export interface ModuleDef {
  key: ModuleKey;
  name: string;
  subtitle: string;
  /** Route segment under /(portal)/ */
  path: string;
  /** Whether this module is built and available yet */
  enabled: boolean;
  /** Tailwind gradient classes for the icon tile */
  gradient: string;
  /** lucide-react icon name */
  icon: string;
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  checks: {
    key: "checks",
    name: "Check Monitoring",
    subtitle: "Hold & Return Monitoring",
    path: "/checks",
    enabled: true, // first module being migrated
    gradient: "from-slate-800 to-slate-900",
    icon: "CircleCheck",
  },
  hris: {
    key: "hris",
    name: "HRIS — SPMT",
    subtitle: "Strategic Performance Tracker",
    path: "/hris",
    enabled: false,
    gradient: "from-[#0B1E38] to-[#0B4F9C]",
    icon: "Users",
  },
  machines: {
    key: "machines",
    name: "Machine Monitoring",
    subtitle: "Inventory · Stock · TBA List",
    path: "/machines",
    enabled: true,
    gradient: "from-blue-600 to-violet-600",
    icon: "Printer",
  },
  scheduler: {
    key: "scheduler",
    name: "Support Scheduler",
    subtitle: "Calendar · KPI · Reports",
    path: "/scheduler",
    enabled: false,
    gradient: "from-amber-600 to-yellow-500",
    icon: "CalendarDays",
  },
  sales: {
    key: "sales",
    name: "Sales Portal",
    subtitle: "Quote Builder · Catalog · Closing Docs",
    path: "/sales",
    enabled: true,
    gradient: "from-red-700 to-red-500",
    icon: "Receipt",
  },
  support: {
    key: "support",
    name: "Chatbot Support",
    subtitle: "Live Chats · Service Requests · KB",
    path: "/support",
    enabled: false,
    gradient: "from-blue-700 to-indigo-600",
    icon: "MessageSquare",
  },
};

export const MODULE_LIST: ModuleDef[] = Object.values(MODULES);
