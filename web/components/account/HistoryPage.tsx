"use client";

import { useMemo, useState } from "react";
import { Clock, Plus, ShoppingBag, X } from "lucide-react";
import Mascot from "@/components/shared/Mascot";
import SubPage from "@/components/shared/SubPage";
import { cn } from "@/lib/cn";
import { Txn, TxnKind, useApp } from "@/lib/store";
import { fmtDate, fmtTime } from "@/lib/validate";

type Filter = "all" | "rental" | "topup" | "purchase";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rental", label: "Rentals" },
  { id: "topup", label: "Top-ups" },
  { id: "purchase", label: "Purchases" },
];

const KIND_LABEL: Record<TxnKind, string> = {
  rental: "Rental",
  topup: "Top-up",
  purchase: "Purchase",
  overdue: "Overdue purchase",
};

function Icon({ kind }: { kind: TxnKind }) {
  const cls = "grid h-11 w-11 shrink-0 place-items-center rounded-2xl";
  if (kind === "topup") return <span className={cn(cls, "bg-lime text-ink")}><Plus size={20} strokeWidth={3} /></span>;
  if (kind === "purchase") return <span className={cn(cls, "bg-raised")}><ShoppingBag size={20} /></span>;
  if (kind === "overdue") return <span className={cn(cls, "bg-bad text-ink")}><Clock size={20} /></span>;
  return <span className={cn(cls, "bg-raised")}><Clock size={20} /></span>;
}

const amountText = (n: number) => `${n > 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`;

function Receipt({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Type", KIND_LABEL[txn.kind]],
    ["Date", fmtDate(txn.at)],
    ["Time", `${fmtTime(txn.at)} CAT`],
    ["Reference", txn.id.toUpperCase()],
    ...(txn.note ? ([["Details", txn.note]] as [string, string][]) : []),
    ["Status", "Completed"],
  ];
  return (
    <div className="anim-fade fixed inset-0 z-[65] flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Receipt"
        className="anim-sheet mx-auto w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold">Receipt</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-raised text-muted">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted">{txn.title}</p>
        <p className={cn("font-heading text-4xl font-bold", txn.amount > 0 && "text-lime")}>{amountText(txn.amount)}</p>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default function HistoryPage({ onBack }: { onBack: () => void }) {
  const { history } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Txn | null>(null);

  const groups = useMemo(() => {
    const list = history
      .filter((t) => filter === "all" || t.kind === filter || (filter === "purchase" && t.kind === "overdue"))
      .sort((a, b) => b.at - a.at);
    const map = new Map<string, Txn[]>();
    list.forEach((t) => {
      const k = fmtDate(t.at);
      map.set(k, [...(map.get(k) ?? []), t]);
    });
    return [...map.entries()];
  }, [history, filter]);

  return (
    <SubPage title="History" onBack={onBack}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-bold",
              filter === f.id ? "border-lime bg-lime text-ink" : "border-line bg-surface"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Mascot size={80} mood="sleepy" />
          <p className="font-heading text-xl font-bold">Nothing here yet</p>
          <p className="text-sm text-muted">Your rentals, top-ups and purchases will show up here.</p>
        </div>
      )}

      {groups.map(([date, items]) => (
        <section key={date} className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{date}</h3>
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpen(t)}
              className="flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-3.5 text-left"
            >
              <Icon kind={t.kind} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-bold">{t.title}</span>
                <span className="block text-sm text-muted">
                  {fmtTime(t.at)}
                  {t.note ? ` · ${t.note}` : ""}
                </span>
              </span>
              <span className={cn("font-heading text-lg font-bold tabular-nums", t.amount > 0 && "text-lime")}>
                {amountText(t.amount)}
              </span>
            </button>
          ))}
        </section>
      ))}

      {open && <Receipt txn={open} onClose={() => setOpen(null)} />}
    </SubPage>
  );
}
