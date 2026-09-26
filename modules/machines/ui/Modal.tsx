"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-xl",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[9999] p-5 transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,.3)] w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-2xl leading-none bg-none border-none cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-[var(--border)] flex gap-2.5 justify-end sticky bottom-0 bg-[var(--surface-1)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ModalFooter({
  onCancel,
  onConfirm,
  confirmLabel = "Save",
  confirmVariant = "primary" as const,
  loading = false,
}: {
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
}) {
  return (
    <>
      <Button variant="default" onClick={onCancel}>
        Cancel
      </Button>
      {onConfirm && (
        <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
          {loading ? "Saving…" : confirmLabel}
        </Button>
      )}
    </>
  );
}
