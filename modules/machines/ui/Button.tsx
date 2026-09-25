import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary" | "ghost" | "danger";
type Size    = "sm" | "md";

const BASE =
  "inline-flex items-center gap-1.5 font-[550] cursor-pointer rounded-[9px] border transition-colors disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS: Record<Variant, string> = {
  default:
    "bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
  primary:
    "bg-[var(--accent)] border-[var(--accent)] text-white hover:brightness-110",
  ghost:
    "bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
  danger:
    "bg-transparent border-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-[12px]",
  md: "px-3.5 py-2 text-[13px]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
