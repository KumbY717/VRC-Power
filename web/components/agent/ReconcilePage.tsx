"use client";

import { useState } from "react";
import Confetti from "@/components/shared/Confetti";
import Mascot from "@/components/shared/Mascot";
import SubPage from "@/components/shared/SubPage";
import { Report, useAgent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import { money } from "@/lib/mock";

const sign = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;

export default function ReconcilePage({ onClose }: { onClose: () => void }) {
  const agent = useAgent();
  const [counted, setCounted] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = Number(counted);
  const ok = counted !== "" && Number.isFinite(value) && value >= 0 && /^\d+(\.\d{1,2})?$/.test(counted);
  const diff = ok ? Math.round((value - agent.given) * 100) / 100 : 0;
  const match = ok && Math.abs(diff) < 0.005;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await agent.endShift(value);
    setBusy(false);
    if (r.ok) setReport(r.report);
    else setError(r.reason);
  }

  if (report) {
    const matched = Math.abs(report.diff) < 0.005;
    return (
      <SubPage title="Shift closed" onBack={onClose}>
        <div className="relative space-y-4 pt-4 text-center">
          {matched && <Confetti />}
          <Mascot size={96} mood={matched ? "happy" : "sleepy"} className="mx-auto" />
          <h3 className="font-heading text-3xl font-bold">{matched ? "Cash matches" : report.diff < 0 ? "Cash is short" : "Cash is over"}</h3>
          <p className="mx-auto max-w-sm text-sm text-muted">
            {matched
              ? "Perfect. Your float and your cash agree."
              : `Your count is ${sign(report.diff)} compared with the float you gave out. Your supervisor will review this report.`}
          </p>
          <div className="space-y-2 rounded-3xl border border-line bg-surface p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted">Expected cash</span><span className="font-semibold">{money(report.expectedCash)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Counted cash</span><span className="font-semibold">{money(report.countedCash)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Customers served</span><span className="font-semibold">{report.txnCount}</span></div>
            <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold">You earned</span><span className="font-heading text-lg font-bold text-lime">{money(report.earned)}</span></div>
          </div>
          <button onClick={onClose} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">Done</button>
        </div>
      </SubPage>
    );
  }

  return (
    <SubPage title="End shift" onBack={onClose}>
      <div className="space-y-2 rounded-3xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Float given to you</span><span className="font-semibold">{agent.assigned.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Float left</span><span className="font-semibold">{agent.float.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Customers served</span><span className="font-semibold">{agent.entries.length}</span></div>
        <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold">Cash you should hold</span><span className="font-heading text-xl font-bold">{money(agent.given)}</span></div>
      </div>

      <label className="block text-sm font-semibold">
        Cash you counted
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 focus-within:border-lime">
          <span className="font-heading text-2xl text-muted">$</span>
          <input
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="w-full bg-transparent py-3.5 font-heading text-3xl font-bold outline-none"
          />
        </div>
      </label>

      {ok && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold",
            match ? "bg-lime/15 text-lime" : "bg-bad/15 text-bad"
          )}
        >
          <Mascot size={40} mood={match ? "happy" : "sleepy"} />
          {match ? "Matches. Nice work." : `${sign(diff)} ${diff < 0 ? "short" : "over"}. Count again to be sure.`}
        </div>
      )}

      <button
        disabled={!ok || busy}
        onClick={() => void submit()}
        className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink disabled:bg-raised disabled:text-muted"
      >
        {busy ? "Submitting…" : "Submit report and close shift"}
      </button>
      {error && (
        <p className="rounded-2xl bg-bad/15 p-3 text-sm font-semibold text-bad" role="alert">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-muted">You can submit even if it doesn&apos;t match. It will be flagged for review.</p>
    </SubPage>
  );
}
