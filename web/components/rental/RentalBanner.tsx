"use client";

import { ChevronRight } from "lucide-react";
import Mascot from "@/components/shared/Mascot";
import { fmtClock } from "@/lib/format";
import { money } from "@/lib/mock";
import { useApp, useNow } from "@/lib/store";
import { HOUR } from "@/lib/format";

/** Shown on Home while a power bank is out. */
export default function RentalBanner({ onOpen }: { onOpen: () => void }) {
  const { rental, balance } = useApp();
  const now = useNow(1000);
  if (!rental) return null;
  const elapsed = Math.max(0, now - rental.startedAt);
  const cost = Math.min(Math.max(1, Math.ceil(elapsed / HOUR)) * rental.rate, balance);
  return (
    <button
      onClick={onOpen}
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-3xl bg-lime p-3 text-left text-ink shadow-card"
    >
      <Mascot size={46} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-xs font-bold uppercase tracking-wider opacity-70">
          Renting · Slot {rental.slot}
        </span>
        <span className="block truncate text-sm font-semibold">{rental.stationName}</span>
      </span>
      <span className="text-right leading-tight">
        <span className="block font-heading text-lg font-bold tabular-nums">{fmtClock(elapsed)}</span>
        <span className="block text-xs font-semibold">{money(cost)}</span>
      </span>
      <ChevronRight size={20} />
    </button>
  );
}
