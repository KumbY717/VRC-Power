"use client";

import Mascot from "@/components/shared/Mascot";
import { RULES, money } from "@/lib/mock";
import { useApp } from "@/lib/store";

/** Shown once when a rental passes 24 hours and turns into a purchase. */
export default function OverdueNotice() {
  const { notice, clearNotice } = useApp();
  if (!notice) return null;
  return (
    <div className="anim-fade fixed inset-0 z-[80] grid place-items-center bg-black/60 p-5">
      <div role="alertdialog" className="anim-sheet w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center">
        <Mascot size={72} mood="sleepy" className="mx-auto" />
        <h3 className="mt-3 font-heading text-2xl font-bold">Rental converted</h3>
        <p className="mt-2 text-sm text-muted">
          The power bank from {notice.stationName} wasn&apos;t returned within {RULES.overdueHours} hours,
          so it became a purchase. {money(notice.amount)} of your credits were used.
        </p>
        <button onClick={clearNotice} className="mt-5 w-full rounded-full bg-lime py-3.5 font-bold text-ink">
          Understood
        </button>
      </div>
    </div>
  );
}
