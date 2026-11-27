"use client";

import { useMemo, useState } from "react";
import { BarChart3, List, MapPin, QrCode, Search, SlidersHorizontal } from "lucide-react";
import BalanceChip from "@/components/shared/BalanceChip";
import Logo from "@/components/shared/Logo";
import Mascot from "@/components/shared/Mascot";
import Sheet from "@/components/shared/Sheet";
import RentalBanner from "@/components/rental/RentalBanner";
import MapView from "./MapView";
import NearbyList from "./NearbyList";
import StationSheet from "./StationSheet";
import { cn } from "@/lib/cn";
import { useLocation } from "@/lib/location";
import { RULES, Station, avgCharge, isAvailable, readyCount } from "@/lib/mock";
import { useApp } from "@/lib/store";

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-heading text-xl font-bold leading-tight">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </p>
    </div>
  );
}

export default function HomeScreen({
  onScan,
  onRent,
  onBuy,
  onOpenRental,
}: {
  onScan: () => void;
  onRent: (s: Station) => void;
  onBuy: (s: Station) => void;
  onOpenRental: () => void;
}) {
  const { stations, balance, rental } = useApp();
  const { pos } = useLocation();
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false); // phones: the three numbers start folded away

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stations.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q) || s.venue.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)) &&
        (!onlyAvailable || isAvailable(s))
    );
  }, [stations, query, onlyAvailable]);

  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const live = stations.filter((s) => s.status === "online");
  const banksReady = stations.reduce((n, s) => n + readyCount(s), 0);
  const banksTotal = stations.reduce((n, s) => n + s.slots.length, 0);
  const charged = live.filter((s) => readyCount(s) > 0);
  const avg = charged.length
    ? Math.round(charged.reduce((n, s) => n + avgCharge(s), 0) / charged.length)
    : 0;

  function pick(id: string | null) {
    setSelectedId(id);
    setListOpen(false);
  }

  return (
    <div className="absolute inset-0">
      <MapView stations={visible} selectedId={selectedId} onSelect={pick} insetTop={136} insetBottom={selected ? 480 : 270} />

      {/* soft fade so the top bar stays readable over the map */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-bg via-bg/60 to-transparent" />

      {/* the top bar, bottom cards and side list hug the edges of the window and share one side margin */}
      <div
        className="pointer-events-none absolute inset-0 z-20 flex flex-col px-4 md:px-[var(--edge)]"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <header className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-3 md:flex-nowrap md:gap-x-4">
          <Logo />
          <div className="order-2 ml-auto md:order-3">
            <BalanceChip balance={balance} />
          </div>
          <div className="order-3 flex w-full items-center gap-2 md:order-2 md:mx-auto md:w-auto md:max-w-xl md:flex-1">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-line bg-surface px-4 py-3 shadow-card focus-within:border-lime">
              <Search size={18} className="shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stations or venues"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </label>
            <button
              onClick={() => setOnlyAvailable((v) => !v)}
              aria-pressed={onlyAvailable}
              aria-label={onlyAvailable ? "Showing stations with power banks ready" : "Show only stations with power banks ready"}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-card",
                onlyAvailable ? "border-lime bg-lime text-ink" : "border-line bg-surface text-fg hover:border-lime"
              )}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">{onlyAvailable ? "Available" : "All"}</span>
            </button>
            <button
              onClick={() => setListOpen(true)}
              aria-label={`Station list, ${live.length} live`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-3 text-sm font-semibold shadow-card hover:border-lime md:hidden"
            >
              <List size={16} /> {live.length}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-stretch justify-between gap-4 pb-28 pt-4">
          {/* bottom-left: numbers and the scan prompt (or the running rental) */}
          <div className="flex min-w-0 flex-1 flex-col justify-end">
            {!selected && !listOpen && (
              <div className="anim-sheet space-y-3 md:max-w-md">
                {rental ? (
                  <div className="pointer-events-auto">
                    <RentalBanner onOpen={onOpenRental} />
                  </div>
                ) : (
                  <>
                    {/* phones: one small button that unfolds the numbers; wider screens always show them */}
                    <button
                      onClick={() => setStatsOpen((v) => !v)}
                      aria-expanded={statsOpen}
                      className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold shadow-card md:hidden"
                    >
                      <BarChart3 size={14} className="text-lime" />
                      {live.length} live · {banksReady} ready
                    </button>
                    <div className={cn("pointer-events-auto grid-cols-3 gap-2 md:grid", statsOpen ? "grid" : "hidden")}>
                      <Stat label="Stations" value={live.length} unit="live" />
                      <Stat label="Banks ready" value={banksReady} unit={`/ ${banksTotal}`} />
                      <Stat label="Avg. charge" value={avg} unit="%" />
                    </div>
                    <div className="pointer-events-auto flex items-center gap-3 rounded-3xl border border-line bg-surface p-3 shadow-card">
                      <Mascot size={44} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="font-heading text-lg font-bold">Ready when you are</p>
                        <p className="text-xs text-muted">
                          Rent from <span className="font-semibold text-fg">${RULES.ratePerHour}/hr</span> · {RULES.ratePerHour} VRC Credit per hour
                        </p>
                      </div>
                      <button onClick={onScan} className="flex shrink-0 items-center gap-2 rounded-full bg-lime px-4 py-3 text-sm font-bold text-ink hover:brightness-105">
                        <QrCode size={18} /> Scan
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* right: the station list (wide screens; phones open it from the List button) */}
          <aside className="pointer-events-auto hidden max-h-[calc(100dvh-22rem)] w-72 shrink-0 self-start overflow-y-auto rounded-3xl border border-line bg-surface p-4 shadow-card md:block lg:w-80">
            <h2 className="mb-3 flex items-center justify-between font-heading text-lg font-bold">
              <span>
                Nearby stations
                <span className="block text-xs font-medium text-muted">{pos ? "Nearest first" : `${live.length} live now`}</span>
              </span>
              <MapPin size={18} className="text-lime" />
            </h2>
            <NearbyList stations={visible} selectedId={selectedId} onSelect={pick} />
          </aside>
        </div>
      </div>

      {selected && <StationSheet station={selected} balance={balance} onClose={() => setSelectedId(null)} onRent={onRent} onBuy={onBuy} />}

      {listOpen && (
        <div className="md:hidden">
          <Sheet title="Nearby stations" onClose={() => setListOpen(false)} backdrop>
            <NearbyList stations={visible} selectedId={selectedId} onSelect={pick} />
          </Sheet>
        </div>
      )}
    </div>
  );
}
