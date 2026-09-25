import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const inputCls =
  "w-full bg-[var(--surface-0)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2.5 rounded-[9px] text-[13.5px] font-[inherit] focus:outline-none focus:border-[var(--accent)]";

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} {...props} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={inputCls} {...props}>
      {children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${inputCls} min-h-[60px] resize-y`} {...props} />
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{children}</div>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--text-secondary)] px-3 py-2.5 rounded-[9px] text-[12.5px] mb-3.5">
      {children}
    </div>
  );
}
