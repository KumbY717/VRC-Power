"use client";

import { useState } from "react";
import { Play, Square } from "lucide-react";
import Mascot from "@/components/shared/Mascot";
import { useAgent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import { money, readyCount } from "@/lib/mock";
import { fmtTime } from "@/lib/validate";
import FloatTank from "./FloatTank";

export default function ShiftScreen({
  onEnd,
  onToast,
}: {
  onEnd: () => void;
  onToast: (m: string) => void;
}) {
  const a = useAgent();
  const [busy, setBusy] = useState(false);
  const stations = a.stations;
  const tank = Math.max(a.assigned, a.float, 1);
  const low = a.shiftOpen && a.float < tank * 0.2;

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-36 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold">Shift</h1>
            <p className="text-sm text-muted">
              {a.profile.event} · {a.profile.venue}
            </p>
          </div>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold",
              a.shiftOpen ? "border-lime bg-lime/15 text-lime" : "border-line bg-surface text-muted"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", a.shiftOpen ? "bg-lime" : "bg-muted")} />
            {a.shiftOpen ? "On shift" : "Off shift"}
          </span>
        </div>

        {/* float */}
        <div className="flex items-center gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <FloatTank remaining={a.float} total={tank} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Float left</p>
              <p className="font-heading text-4xl font-bold leading-tight">
                {a.float.toFixed(0)}
                <span className="text-xl text-muted"> / {tank.toFixed(0)}</span>
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted">Credits given</span>
                <span className="font-semibold">{a.given.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted">Earned this shift</span>
                <span className="font-semibold text-lime">{money(a.earned)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* cash you should hold */}
        <div className="rounded-3xl border-2 border-lime bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Cash you should be holding</p>
          <p className="font-heading text-4xl font-bold">{money(a.given)}</p>
          <p className="mt-1 text-sm text-muted">
            Every credit you give out is cash you took in. At the end of the shift, the cash you count must be exactly this amount.
          </p>
        </div>

        {low && (
          <p className="flex items-center gap-3 rounded-2xl bg-warn/15 p-4 text-sm font-semibold text-warn" role="alert">
            <Mascot size={36} mood="sleepy" /> Your float is running low. Contact the admin if you need more.
          </p>
        )}

        {a.shiftOpen ? (
          <button
            onClick={onEnd}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-line bg-surface py-4 text-base font-bold hover:border-lime"
          >
            <Square size={18} /> End shift and count cash
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await a.startShift();
              setBusy(false);
              onToast(r.ok ? "Shift started. Float loaded." : r.reason);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-4 text-base font-bold text-ink hover:brightness-105 disabled:opacity-60"
          >
            <Play size={18} fill="currentColor" /> Start shift
          </button>
        )}

        {/* stations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Your stations</h2>
          {stations.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-4">
              <div className="leading-tight">
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-muted">{s.code}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1" aria-hidden="true">
                  {s.slots.map((c, i) => (
                    <span key={i} className={cn("h-5 w-2 rounded-sm", c === null ? "border border-dashed border-line" : "bg-lime")} />
                  ))}
                </div>
                <span className="rounded-full bg-lime/15 px-3 py-1 text-xs font-bold text-lime">
                  {readyCount(s)}/{s.slots.length}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* today's top-ups */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">This shift</h2>
          {a.entries.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line p-5 text-center text-sm text-muted">
              {a.shiftOpen ? "No customers yet. Tap the scan button when someone hands you cash." : "Start your shift to begin taking cash top-ups."}
            </p>
          ) : (
            a.entries.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-3xl border border-line bg-surface p-4">
                <div className="leading-tight">
                  <p className="font-mono font-bold">{t.customer}</p>
                  <p className="text-sm text-muted">
                    {t.kind === "sale" ? "Outright sale" : "Cash top-up"} · {fmtTime(t.at)}
                  </p>
                </div>
                <div className="text-right leading-tight">
                  <p className="font-heading text-xl font-bold">{money(t.amount)}</p>
                  <p className="text-xs text-lime">+{money(t.commission)} earned</p>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
