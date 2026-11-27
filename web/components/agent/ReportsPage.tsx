"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import SubPage from "@/components/shared/SubPage";
import { useAgent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import { money } from "@/lib/mock";
import { fmtDate, fmtTime } from "@/lib/validate";

export default function ReportsPage({ onBack }: { onBack: () => void }) {
  const { reports } = useAgent();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <SubPage title="Shift reports" onBack={onBack}>
      {reports.map((r) => {
        const matched = Math.abs(r.diff) < 0.005;
        return (
          <div key={r.id} className="rounded-3xl border border-line bg-surface">
            <button
              onClick={() => setOpen(open === r.id ? null : r.id)}
              aria-expanded={open === r.id}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <span className="leading-tight">
                <span className="block font-bold">{fmtDate(r.endedAt)}</span>
                <span className="block text-sm text-muted">{r.txnCount} customers · {money(r.earned)} earned</span>
              </span>
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    matched ? "bg-lime/15 text-lime" : "bg-bad/15 text-bad"
                  )}
                >
                  {matched ? "Matched" : r.diff < 0 ? `Short $${Math.abs(r.diff).toFixed(2)}` : `Over $${r.diff.toFixed(2)}`}
                </span>
                <ChevronDown size={18} className={cn("transition-transform", open === r.id && "rotate-180")} />
              </span>
            </button>
            {open === r.id && (
              <dl className="space-y-2 border-t border-line p-4 text-sm">
                {([
                  ["Time", `${fmtTime(r.startedAt)} to ${fmtTime(r.endedAt)} CAT`],
                  ["Float given", String(r.assigned)],
                  ["Credits given out", r.given.toFixed(2)],
                  ["Expected cash", money(r.expectedCash)],
                  ["Counted cash", money(r.countedCash)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </SubPage>
  );
}
