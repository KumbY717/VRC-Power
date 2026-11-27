"use client";

import { X } from "lucide-react";

/** Floating card that sits above the bottom bar. Used for station details and lists. */
export default function Sheet({
  title,
  onClose,
  children,
  backdrop = false,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  backdrop?: boolean;
}) {
  return (
    <>
      {backdrop && (
        <div className="anim-fade fixed inset-0 z-30 bg-black/40" onClick={onClose} aria-hidden="true" />
      )}
      <section
        className="anim-sheet fixed bottom-24 left-3 right-3 z-40 max-h-[70dvh] overflow-y-auto rounded-3xl border border-line bg-surface p-4 shadow-card md:left-[var(--edge)] md:right-auto md:w-[26rem]"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold leading-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-muted hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </>
  );
}
