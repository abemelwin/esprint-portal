import type { MachineStatus } from "../types";

const STATUS_CONFIG: Record<
  MachineStatus,
  { hex: string; color: string }
> = {
  Incoming:       { hex: "#2a78d6", color: "var(--incoming)" },
  "In Stock":     { hex: "#1baf7a", color: "var(--stock)" },
  Recertified:    { hex: "#0d9488", color: "var(--recert)" },
  Demo:           { hex: "#d6459b", color: "var(--demo)" },
  Reserved:       { hex: "#eda100", color: "var(--reserved)" },
  Delivered:      { hex: "#008300", color: "var(--delivered)" },
  "Pullout Parts":{ hex: "#8a5a2b", color: "var(--pullout)" },
};

export const STATUS_ROW_CLASS: Record<MachineStatus, string> = {
  Incoming:        "st-incoming",
  "In Stock":      "st-instock",
  Recertified:     "st-recertified",
  Demo:            "st-demo",
  Reserved:        "st-reserved",
  Delivered:       "st-delivered",
  "Pullout Parts": "st-pulloutparts",
};

export const ALL_STATUSES = Object.keys(STATUS_CONFIG) as MachineStatus[];

function hexAlpha(hex: string, a: number) {
  if (hex.startsWith("var")) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function StatusPill({ status }: { status: MachineStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { hex: "#888", color: "#888" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-[650] whitespace-nowrap"
      style={{ background: hexAlpha(cfg.hex, 0.14), color: cfg.color }}
    >
      <span
        className="w-2 h-2 rounded-full flex-none"
        style={{ background: cfg.hex }}
      />
      {status}
    </span>
  );
}
