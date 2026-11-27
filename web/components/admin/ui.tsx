"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const fieldCls =
  "w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-lime";
export const btnPrimary = "rounded-full bg-lime px-5 py-3 text-sm font-bold text-ink hover:brightness-105 disabled:bg-raised disabled:text-muted";
export const btnGhost = "rounded-full border-2 border-line bg-surface px-5 py-3 text-sm font-bold hover:border-lime";
export const btnDanger = "rounded-full bg-bad px-5 py-3 text-sm font-bold text-ink hover:brightness-105 disabled:opacity-40";

export function Card({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-line bg-surface p-5 shadow-card", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-heading text-xl font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 font-heading text-3xl font-bold leading-tight", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

type Tone = "ok" | "warn" | "bad" | "muted";
const TONES: Record<Tone, string> = {
  ok: "bg-lime/15 text-lime",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  muted: "bg-raised text-muted",
};
export function Chip({ tone = "muted", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold", TONES[tone])}>{children}</span>;
}

export function DataTable({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b-2 border-line text-xs uppercase tracking-wider text-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="py-8 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}

export function Tr({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={onClick ? 0 : undefined}
      className={cn("border-b border-line", onClick && "cursor-pointer hover:bg-raised focus-visible:bg-raised")}
    >
      {children}
    </tr>
  );
}
export const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-3 py-3.5 align-middle", className)}>{children}</td>
);

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="anim-fade fixed inset-0 z-[60] flex bg-black/60" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet ml-auto flex h-full w-full max-w-lg flex-col border-l border-line bg-bg"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <h2 className="font-heading text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-line">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

/** Confirmation dialog. Can ask for a reason, which goes in the audit log. */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  needReason,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  needReason?: boolean;
  /** Return an error message to keep the dialog open, or nothing when it worked. May be async. */
  onConfirm: (reason: string) => string | void | Promise<string | void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="anim-fade fixed inset-0 z-[70] grid place-items-center bg-black/70 p-5" onClick={onClose}>
      <div role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="anim-sheet w-full max-w-md space-y-4 rounded-3xl border border-line bg-surface p-6">
        <h3 className="font-heading text-2xl font-bold">{title}</h3>
        <div className="text-sm text-muted">{body}</div>
        {needReason && (
          <label className="block text-sm font-semibold">
            Reason (saved in the audit log)
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={cn(fieldCls, "mt-1.5")} />
          </label>
        )}
        {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>Cancel</button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const err = await onConfirm(reason);
              setBusy(false);
              if (err) setError(err);
              else onClose();
            }}
            className={danger ? btnDanger : btnPrimary}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
