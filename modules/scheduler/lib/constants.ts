/** Constants (ported from esprint-support-scheduler/src/lib/constants.js) */

export const ROLES: Record<string, { label: string; short: string; color: string }> = {
  manager:     { label: "Service Manager",        short: "Svc Mgr",    color: "#4f46e5" },
  bsm:         { label: "Branch Service Manager", short: "Branch Mgr", color: "#9333ea" },
  coordinator: { label: "Service Coordinator",    short: "Coord",      color: "#0284c7" },
  senior:      { label: "Senior FSE",             short: "Senior",     color: "#2563eb" },
  junior:      { label: "Junior FSE",             short: "Junior",     color: "#059669" },
  trainee:     { label: "Trainee",                short: "Trainee",    color: "#d97706" },
};
export const ROLE_ORDER = ["manager", "bsm", "coordinator", "senior", "junior", "trainee"];

export const TYPES: Record<string, { label: string; cls: string }> = {
  installation: { label: "Installation", cls: "t-install" },
  onsite:       { label: "Onsite",       cls: "t-onsite"  },
  hotline:      { label: "Hotline",      cls: "t-hotline" },
  others:       { label: "Others",       cls: "t-others"  },
  leave:        { label: "Leave",        cls: "t-leave"   },
  absent:       { label: "Absent",       cls: "t-absent"  },
};
export const TYPE_KEYS  = ["installation", "onsite", "hotline", "others"];
export const ABSENCE_KEYS = ["leave", "absent"];

export const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending: { label: "Pending",        cls: "pending", dot: "pending" },
  ongoing: { label: "Ongoing",        cls: "ongoing", dot: "ongoing" },
  success: { label: "Successful",     cls: "success", dot: "success" },
  fail:    { label: "Not successful", cls: "fail",    dot: "fail"    },
  cancel:  { label: "Cancelled",      cls: "cancel",  dot: "cancel"  },
};

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const REGIONS: Record<string, string[]> = {
  "North Luzon":    ["CAB", "ISA", "PANG"],
  "South Luzon":    ["CAV", "CAMSUR", "MAK", "PAL", "RIZ"],
  "Visayas":        ["BAC", "CEB", "ILO", "TAC"],
  "North Mindanao": ["BUK", "BUT", "CDO", "PAG", "ZAM"],
  "South Mindanao": ["DAV", "GENSAN", "TAG"],
};

export const REGION_COLORS: Record<string, string> = {
  "North Luzon":    "#2a78d6",
  "South Luzon":    "#0ea5e9",
  "Visayas":        "#b5179e",
  "North Mindanao": "#1baf7a",
  "South Mindanao": "#10b981",
};

export function getBranchRegion(branchCode: string): string | null {
  if (!branchCode) return null;
  for (const [region, codes] of Object.entries(REGIONS)) {
    if (codes.includes(branchCode)) return region;
  }
  return null;
}

export const ALL_BRANCH_CODES = [
  "BAC","BUK","BUT","CAB","CAMSUR","CAV","CDO","CEB","DAV","GENSAN",
  "ILO","ISA","MAK","PAG","PAL","PANG","RIZ","TAC","TAG","ZAM",
];

export interface Branch  { id: string; name: string; note: string }
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  home_branch_id: string;
  hotline: boolean;
  [key: string]: unknown;
}
export interface Job {
  id: string;
  date: string;
  jt_no: string;
  jt_url?: string;
  staff_id: string;
  branch_id: string;
  customer: string;
  location?: string;
  machine?: string;
  serial_no?: string;
  type: string;
  type_other?: string;
  status: string;
  status_note?: string;
  created_at?: string;
}
export interface AppUser {
  id: string;
  auth_id?: string;
  name: string;
  email: string;
  role: string;
  branch_ids?: string[];
  main_branch_id?: string;
  edit_branch_ids?: string[];
  view_branch_ids?: string[];
  can_edit?: boolean;
  is_active?: boolean;
  employee_role?: string;
  [key: string]: unknown;
}
export interface PendingRegistration {
  id: string;
  email: string;
  name: string;
  role: string;
  branch_ids?: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
  [key: string]: unknown;
}

export function formatBranchSummary(branchIds: string[], allBranches: Branch[] = []): string {
  if (!branchIds || branchIds.length === 0) return "—";
  if (allBranches.length > 0 && allBranches.every((b) => branchIds.includes(b.id))) {
    return "All Branches";
  }
  const branchCodes = branchIds
    .map((id) => allBranches.find((b) => b.id === id)?.name || id)
    .filter(Boolean);
  if (branchCodes.length === 0) return "—";
  if (branchCodes.length === 1) return branchCodes[0];

  const uniqueRegions = Array.from(
    new Set(branchCodes.map((code) => getBranchRegion(code)).filter(Boolean))
  ) as string[];
  const hasNorthLuzon   = uniqueRegions.includes("North Luzon");
  const hasSouthLuzon   = uniqueRegions.includes("South Luzon");
  const hasNorthMindanao = uniqueRegions.includes("North Mindanao");
  const hasSouthMindanao = uniqueRegions.includes("South Mindanao");
  if (hasNorthLuzon && hasSouthLuzon && uniqueRegions.length === 2) return "Luzon";
  if (hasNorthMindanao && hasSouthMindanao && uniqueRegions.length === 2) return "Mindanao";
  if (uniqueRegions.length > 0) return uniqueRegions.join(", ");
  return branchCodes.join(", ");
}

export function namesMatch(n1: string, n2: string): boolean {
  if (!n1 || !n2) return false;
  const s1 = n1.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const s2 = n2.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
  const words1 = s1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = s2.split(/\s+/).filter((w) => w.length > 2);
  const matches = words1.filter((w) => words2.includes(w));
  return (
    matches.length >= 2 ||
    (words1.length === 1 && words2.includes(words1[0])) ||
    (words2.length === 1 && words1.includes(words2[0]))
  );
}

export interface DesignatedManager {
  nameKey: string;
  fullName: string;
  role: string;
  isAdmin?: boolean;
  branchCodes: string[];
  label: string;
  filterMatch?: (nameNorm: string) => boolean;
}

export const DESIGNATED_MANAGERS: DesignatedManager[] = [
  { nameKey: "rioja",     fullName: "Arnold Rioja",          role: "manager",     isAdmin: true, branchCodes: ALL_BRANCH_CODES, label: "🌐 All Branches (Admin)" },
  { nameKey: "danilo",    fullName: "Danilo Carangan",        role: "manager",     isAdmin: true, branchCodes: ALL_BRANCH_CODES, label: "🌐 All Branches (Admin)" },
  { nameKey: "eina",      fullName: "Ricky Eina",             role: "manager",     branchCodes: ["MAK"],                         label: "🏢 MAK · Makati" },
  { nameKey: "de chavez", fullName: "Limwel De Chavez",       role: "manager",     branchCodes: ["ISA","PANG","CAB","CAMSUR"],   label: "✏️ ISA, PANG, CAB, CAMSUR" },
  { nameKey: "almoite",   fullName: "Michael Almoite",        role: "bsm",         branchCodes: ["PAL"],                         label: "🏢 PAL · Palawan" },
  { nameKey: "coliflores",fullName: "Darel Coliflores",       role: "bsm",         branchCodes: ["TAC"],                         label: "🏢 TAC · Tacloban" },
  {
    nameKey: "calvo", fullName: "Jessriel Calvo", role: "bsm", branchCodes: ["CEB"],
    filterMatch: (n) => n.includes("jessriel") || (n.includes("calvo") && !n.includes("jerus")),
    label: "🏢 CEB · Cebu",
  },
  { nameKey: "sacuan",  fullName: "Gerald Sacuan",         role: "bsm",         branchCodes: ["CDO","BUT","PAG","ZAM","BUK"], label: "✏️ North Mindanao" },
  { nameKey: "genabe",  fullName: "Martin Genabe",          role: "bsm",         branchCodes: ["TAG","DAV","GENSAN"],          label: "✏️ South Mindanao" },
  { nameKey: "venus",   fullName: "Venus Liloan",           role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "angelie", fullName: "Angelie Tamondong",      role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "arianne", fullName: "Arianne Espinosa",       role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "philip",  fullName: "June Philip Garcia",     role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "sioco",   fullName: "John Trent Sioco",       role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "natan",   fullName: "Dennis Natan",           role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "yumang",  fullName: "Don Alexander Yumang",   role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
  { nameKey: "templa",  fullName: "Marvin Jay Templa",      role: "coordinator", branchCodes: ALL_BRANCH_CODES,               label: "🌐 All Branches (Coordinator)" },
];

export function isAdminOrCoordinator(
  person: { name?: string; role?: string } | null,
  appUsers: AppUser[] = []
): boolean {
  if (!person) return false;
  const r = (person.role || "").toLowerCase();
  if (r === "admin" || r === "coordinator" || r === "service_coordinator") return true;
  const pName = (person.name || "").trim().toLowerCase();
  if (!pName) return false;
  if (pName.includes("eileen")) return true;
  if (appUsers.length > 0) {
    const matchedUser = appUsers.find((u) => u.name && namesMatch(u.name, person.name ?? ""));
    if (matchedUser) {
      const ur = (matchedUser.role || "").toLowerCase();
      if (ur === "admin" || ur === "service_coordinator" || ur === "coordinator") return true;
    }
  }
  const des = DESIGNATED_MANAGERS.find((m) => {
    if (m.filterMatch) return m.filterMatch(pName);
    return pName.includes(m.nameKey) || (m.fullName && namesMatch(m.fullName, person.name ?? ""));
  });
  if (des) {
    if (des.role === "coordinator" || des.isAdmin || des.label?.includes("Admin") || des.label?.includes("Coordinator")) {
      return true;
    }
  }
  return false;
}
