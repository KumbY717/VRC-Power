"use client";

import SubPage from "@/components/shared/SubPage";
import { useAgent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import { money } from "@/lib/mock";
import { fmtDate } from "@/lib/validate";

export default function EarningsPage({ onBack }: { onBack: () => void }) {
  const a = useAgent();
  const topups = a.entries.filter((t) => t.kind === "topup");
  const sales = a.entries.filter((t) => t.kind === "sale");
  const topupComm = topups.reduce((n, t) => n + t.commission, 0);
  const saleComm = sales.reduce((n, t) => n + t.commission, 0);
  const base = a.startedAt === null ? 0 : a.profile.baseAllowance;
  const bars = [...a.week, { d: "Today", v: a.earned }];
  const max = Math.max(...bars.map((b) => b.v), 1);

  return (
    <SubPage title="Earnings" onBack={onBack}>
      <div className="rounded-3xl bg-lime p-5 text-ink shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">Today</p>
        <p className="font-heading text-5xl font-bold">{money(a.earned)}</p>
      </div>

      <div className="space-y-2 rounded-3xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Daily allowance</span><span className="font-semibold">{money(base)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Commission ({Math.round(a.profile.commissionRate * 100)}% of {topups.length} top-ups)</span><span className="font-semibold">{money(topupComm)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Sale bonuses ({sales.length} × {money(a.profile.saleBonus)})</span><span className="font-semibold">{money(saleComm)}</span></div>
        <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold">Total</span><span className="font-heading text-lg font-bold">{money(a.earned)}</span></div>
      </div>

      <section className="rounded-3xl border border-line bg-surface p-4">
        <h3 className="mb-4 font-heading text-lg font-bold">This week</h3>
        <div className="flex h-40 items-end gap-2" role="img" aria-label="Earnings for the last 7 days">
          {bars.map((b, i) => (
            <div key={b.d} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted">{b.v ? `$${Math.round(b.v)}` : "–"}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn("w-full rounded-t-lg", i === bars.length - 1 ? "bg-lime" : "bg-sky")}
                  style={{ height: `${Math.max(4, (b.v / max) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-muted">{b.d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Payouts</h3>
        {a.payouts.length === 0 && (
          <p className="rounded-3xl border border-dashed border-line p-5 text-center text-sm text-muted">No payouts yet. They appear here once the admin has paid you.</p>
        )}
        {a.payouts.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-3xl border border-line bg-surface p-4">
            <div className="leading-tight">
              <p className="font-bold">{p.note}</p>
              <p className="text-sm text-muted">{fmtDate(p.at)}</p>
            </div>
            <p className="font-heading text-xl font-bold">{money(p.amount)}</p>
          </div>
        ))}
      </section>
    </SubPage>
  );
}
