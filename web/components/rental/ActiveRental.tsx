"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Flag, X, Zap } from "lucide-react";
import Confetti from "@/components/shared/Confetti";
import Mascot from "@/components/shared/Mascot";
import { cn } from "@/lib/cn";
import { fmtClock, fmtLeft, fmtSpan, HOUR } from "@/lib/format";
import { money } from "@/lib/mock";
import { SHOW_DEMO } from "@/lib/auth";
import { Receipt, useApp, useNow } from "@/lib/store";

type Phase = "active" | "returning" | "receipt";

const PROBLEMS = [
  "The power bank isn't charging my phone",
  "Cable or port is broken",
  "I can't find a free slot to return it",
  "I was charged incorrectly",
  "Something else",
];

function ReportSheet({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-[65] flex items-end bg-black/50 anim-fade" onClick={onClose}>
      <div
        className="anim-sheet mx-auto w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Mascot size={64} />
            <h3 className="font-heading text-xl font-bold">Thanks, we&apos;re on it</h3>
            <p className="text-sm text-muted">Our team will check this and get back to you.</p>
            <button onClick={onClose} className="mt-2 w-full rounded-full bg-lime py-3.5 font-bold text-ink">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold">Report a problem</h3>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-raised text-muted">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {PROBLEMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setChoice(p)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold",
                    choice === p ? "border-lime bg-lime/10" : "border-line bg-raised"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              disabled={!choice}
              onClick={() => setSent(true)}
              className="mt-4 w-full rounded-full bg-lime py-3.5 font-bold text-ink disabled:bg-raised disabled:text-muted"
            >
              Send report
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReturnProgress() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const f = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(f);
  }, []);
  return (
    <div className="h-2 w-56 overflow-hidden rounded-full bg-raised">
      <div
        className="h-full rounded-full bg-lime"
        style={{ width: go ? "100%" : "0%", transition: "width 1.6s ease-in-out" }}
      />
    </div>
  );
}

export default function ActiveRental({ onClose }: { onClose: () => void }) {
  const { rental, balance, returnBank, advance } = useApp();
  const now = useNow(1000);
  const [phase, setPhase] = useState<Phase>("active");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [report, setReport] = useState(false);

  // simulate the station detecting the returned bank
  useEffect(() => {
    if (phase !== "returning") return;
    const t = setTimeout(async () => {
      const r = await returnBank();
      if (r) {
        setReceipt(r);
        setPhase("receipt");
      } else onClose();
    }, 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // rental ended elsewhere (e.g. converted after 24h): leave this screen
  useEffect(() => {
    if (!rental && phase === "active") onClose();
  }, [rental, phase, onClose]);

  if (phase === "receipt" && receipt) {
    return (
      <div className="anim-fade fixed inset-0 z-[55] flex flex-col bg-bg">
        <Confetti />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Mascot size={88} />
          <h2 className="font-heading text-3xl font-bold">Power bank returned</h2>
          <div className="w-full max-w-sm space-y-2 rounded-3xl border border-line bg-surface p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted">Returned at</span><span className="font-semibold">{receipt.returnedAt}</span></div>
            <div className="flex justify-between"><span className="text-muted">Time</span><span className="font-semibold">{fmtSpan(receipt.durationMs)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Billed</span><span className="font-semibold">{receipt.hours} h × {money(receipt.rental.rate)}</span></div>
            <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold">Total</span><span className="font-heading text-lg font-bold">{money(receipt.charged)}</span></div>
            <div className="flex justify-between"><span className="text-muted">New balance</span><span className="font-semibold">{money(receipt.balanceAfter)}</span></div>
          </div>
        </div>
        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!rental) return null;

  if (phase === "returning") {
    return (
      <div className="anim-fade fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
        <Mascot size={96} />
        <ReturnProgress />
        <p className="text-sm text-muted">Waiting for the station to detect your power bank…</p>
      </div>
    );
  }

  const elapsed = Math.max(0, now - rental.startedAt);
  const limit = rental.overdueHours * HOUR;
  const left = Math.max(0, limit - elapsed);
  const hours = Math.max(1, Math.ceil(elapsed / HOUR));
  const cost = Math.min(hours * rental.rate, balance);
  const ringColor = left > 4 * HOUR ? "var(--lime)" : left > HOUR ? "var(--warn)" : "var(--bad)";
  const R = 52;
  const C = 2 * Math.PI * R;
  const overdueSoon = left <= 4 * HOUR;

  const timeline = [
    { label: "Unlocked", done: true },
    { label: "In use", done: true, current: true },
    { label: "Returned", done: false },
  ];

  return (
    <div className="anim-fade fixed inset-0 z-[55] overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Back to map"
            className="grid h-10 w-10 place-items-center rounded-full bg-raised text-fg"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="leading-tight">
            <h2 className="font-heading text-xl font-bold">Your rental</h2>
            <p className="text-xs text-muted">{rental.stationName} · Slot {rental.slot}</p>
          </div>
        </div>

        {/* battery + timer */}
        <div className="flex items-center gap-5 rounded-3xl border border-line bg-surface p-5">
          <div className="relative shrink-0">
            <div className="mx-auto h-2 w-8 rounded-t-md bg-fg/70" />
            <div className="relative h-40 w-24 overflow-hidden rounded-2xl border-4 border-fg/70 bg-raised">
              <div
                className="absolute inset-x-0 bottom-0 bg-lime"
                style={{ height: `${rental.startCharge}%` }}
              />
              <div className="absolute inset-0 grid place-items-center text-ink">
                <Zap size={34} fill="currentColor" />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Rental time</p>
            <p className="font-heading text-4xl font-bold tabular-nums leading-tight">{fmtClock(elapsed)}</p>
            <p className="mt-2 font-heading text-2xl font-bold text-lime">{money(cost)}</p>
            <p className="text-xs text-muted">{hours} started hour{hours > 1 ? "s" : ""} · {money(rental.rate)}/hr</p>
            <p className="mt-2 text-[11px] text-muted">{rental.serial} · {rental.startCharge}% at pickup</p>
          </div>
        </div>

        {/* 24h ring */}
        <div className="flex items-center gap-5 rounded-3xl border border-line bg-surface p-5">
          <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--raised)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${C * (left / limit)} ${C}`}
            />
          </svg>
          <div className="min-w-0">
            <p className="font-heading text-2xl font-bold leading-tight">{fmtLeft(left)} left</p>
            <p className={cn("mt-1 text-sm", overdueSoon ? "text-warn" : "text-muted")}>
              After {rental.overdueHours} hours this rental becomes a purchase and{" "}
              {rental.outright} credits are forfeited.
            </p>
          </div>
        </div>

        {/* timeline */}
        <div className="flex items-center justify-between rounded-3xl border border-line bg-surface px-5 py-4">
          {timeline.map((t, i) => (
            <div key={t.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-xs",
                    t.done ? "bg-lime text-ink" : "bg-raised text-muted",
                    t.current && "ring-4 ring-lime/30"
                  )}
                >
                  {t.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("text-[11px] font-semibold", t.done ? "text-fg" : "text-muted")}>
                  {t.label}
                </span>
              </div>
              {i < timeline.length - 1 && (
                <span className={cn("mx-2 mb-5 h-0.5 flex-1 rounded", timeline[i + 1].done ? "bg-lime" : "bg-line")} />
              )}
            </div>
          ))}
        </div>

        <p className="rounded-2xl bg-raised p-4 text-sm text-muted">
          To return it, plug the power bank into any free slot on any VRC station. The station detects
          it and closes your rental automatically.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setPhase("returning")}
            className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink hover:brightness-105"
          >
            I returned it
          </button>
          <button
            onClick={() => setReport(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-3.5 text-sm font-bold"
          >
            <Flag size={16} /> Report a problem
          </button>
        </div>

        {/* development helpers (only while NEXT_PUBLIC_SHOW_DEMO=1) */}
        {SHOW_DEMO && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted">
            <span>Demo time travel:</span>
            {[1, 12, 23].map((h) => (
              <button
                key={h}
                onClick={() => void advance(h)}
                className="rounded-full bg-raised px-3 py-1.5 font-semibold text-fg hover:bg-line"
              >
                +{h}h
              </button>
            ))}
          </div>
        )}
      </div>

      {report && <ReportSheet onClose={() => setReport(false)} />}
    </div>
  );
}
