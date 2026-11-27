"use client";

import { Navigation, Route } from "lucide-react";
import Sheet from "@/components/shared/Sheet";
import { cn } from "@/lib/cn";
import { directionsUrl, formatDistance, walkMinutes } from "@/lib/geo";
import { RULES, Station, avgCharge, money, readyCount } from "@/lib/mock";

function Slot({ charge }: { charge: number | null }) {
  if (charge === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="h-12 w-full rounded-lg border border-dashed border-line" />
        <span className="text-[10px] text-muted">empty</span>
      </div>
    );
  }
  const tone = charge >= 60 ? "bg-lime" : charge >= 40 ? "bg-sun" : "bg-warn";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-12 w-full overflow-hidden rounded-lg border border-line bg-raised">
        <div className={cn("absolute inset-x-0 bottom-0", tone)} style={{ height: `${charge}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-muted">{charge}%</span>
    </div>
  );
}

export default function StationSheet({
  station,
  balance,
  onClose,
  onRent,
  onBuy,
}: {
  station: Station;
  balance: number;
  onClose: () => void;
  onRent: (s: Station) => void;
  onBuy: (s: Station) => void;
}) {
  const live = station.status === "online";
  const ready = readyCount(station);
  const canRent = live && ready > 0;
  const enough = balance >= RULES.minBalance;

  return (
    <Sheet title={station.name} onClose={onClose}>
      <p className="-mt-2 mb-3 text-sm text-muted">
        {station.venue}
        {station.address && station.address !== station.venue ? ` · ${station.address}` : ""}
      </p>

      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
            live ? "bg-lime/15 text-lime" : "bg-raised text-muted"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-lime" : "bg-muted")} />
          {live ? "Online" : "Offline"}
        </span>
        {station.distanceM !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5">
            <Navigation size={12} /> {formatDistance(station.distanceM)}
            {station.distanceM <= 3000 && ` · ${walkMinutes(station.distanceM)} min walk`}
          </span>
        )}
        {live && (
          <span className="rounded-full bg-raised px-3 py-1.5">{avgCharge(station)}% avg. charge</span>
        )}
      </div>

      <div className="mb-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(station.slots.length, 8)}, minmax(0, 1fr))` }}>
        {station.slots.map((c, i) => (
          <Slot key={i} charge={c} />
        ))}
      </div>
      <p className="mb-4 mt-2 text-xs text-muted">
        {ready} of {station.slots.length} power banks ready
      </p>

      <div className="mb-4 rounded-2xl bg-raised p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Rental</span>
          <span className="font-semibold">{money(RULES.ratePerHour)} / hour</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Minimum balance</span>
          <span className={cn("font-semibold", !enough && "text-warn")}>
            {RULES.minBalance} credits
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          disabled={!canRent}
          onClick={() => onRent(station)}
          className={cn(
            "flex-1 rounded-full px-4 py-3.5 text-[15px] font-bold transition-colors",
            canRent ? "bg-lime text-ink hover:brightness-105" : "bg-raised text-muted"
          )}
        >
          {!live ? "Station offline" : ready === 0 ? "No power banks" : enough ? "Rent now" : "Top up to rent"}
        </button>
        <button
          disabled={!canRent}
          onClick={() => onBuy(station)}
          className="rounded-full border border-line px-4 py-3.5 text-[15px] font-bold text-fg hover:border-lime disabled:opacity-40"
        >
          Buy {money(RULES.outrightPrice)}
        </button>
      </div>
      <a
        href={directionsUrl(station)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-sm font-bold hover:border-lime"
      >
        <Route size={16} /> Directions
      </a>
      {live && !enough && (
        <p className="mt-2 text-xs text-warn">
          You have {money(balance)}. Renting needs at least {RULES.minBalance} credits.
        </p>
      )}
    </Sheet>
  );
}
