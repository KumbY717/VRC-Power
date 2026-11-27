"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import Confetti from "@/components/shared/Confetti";
import Mascot from "@/components/shared/Mascot";
import { cn } from "@/lib/cn";
import { RULES, Station, avgCharge, money, readyCount } from "@/lib/mock";
import { useApp } from "@/lib/store";

export type Mode = "rent" | "buy";
export type ScanRequest = { station?: Station; mode?: Mode };
type Step = "scan" | "confirm" | "unlocking" | "done" | "error";

function UnlockProgress() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const f = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(f);
  }, []);
  return (
    <div className="h-2 w-56 overflow-hidden rounded-full bg-raised">
      <div
        className="h-full rounded-full bg-lime"
        style={{ width: go ? "100%" : "0%", transition: "width 1.7s ease-in-out" }}
      />
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("font-semibold", warn && "text-warn")}>{value}</span>
    </div>
  );
}

export default function ScanScreen({
  initialStation,
  initialMode = "rent",
  onClose,
  onTopUp,
  onOpenRental,
}: {
  initialStation?: Station;
  initialMode?: Mode;
  onClose: () => void;
  onTopUp: () => void;
  onOpenRental: () => void;
}) {
  const { stations, balance, rental, unlock, buy } = useApp();
  const [step, setStep] = useState<Step>(initialStation ? "confirm" : "scan");
  const [stationId, setStationId] = useState<string | null>(initialStation?.id ?? null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [slot, setSlot] = useState(0);
  const [error, setError] = useState("");

  const station = stations.find((s) => s.id === stationId) ?? null;

  function pick(s: Station) {
    setCodeError("");
    setStationId(s.id);
    setStep("confirm");
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const found = stations.find((s) => s.code === code.trim().toUpperCase());
    if (found) pick(found);
    else setCodeError("We couldn't find that station code. Check the sticker and try again.");
  }

  // the "talk to the station" moment
  useEffect(() => {
    if (step !== "unlocking" || !station) return;
    const t = setTimeout(async () => {
      const res = await (mode === "rent" ? unlock(station.id) : buy(station.id));
      if (res.ok) {
        setSlot(res.slot);
        setStep("done");
      } else {
        setError(res.reason);
        setStep("error");
      }
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const title =
    step === "scan"
      ? "Scan station QR"
      : step === "confirm"
        ? (station?.name ?? "Station")
        : step === "unlocking"
          ? "Unlocking"
          : step === "done"
            ? mode === "rent"
              ? "Unlocked"
              : "Purchased"
            : "Couldn't unlock";

  const corner = "absolute h-9 w-9 border-lime";

  return (
    <div
      className={cn(
        "anim-fade fixed inset-0 z-[60] flex flex-col",
        step === "scan" ? "bg-black text-white" : "bg-bg text-fg"
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="truncate font-heading text-xl font-bold">{title}</h2>
        {step !== "unlocking" && (
          <button
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full",
              step === "scan" ? "bg-white/10 text-white" : "bg-raised text-muted"
            )}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* 1. scan */}
      {step === "scan" && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
            <div className="relative aspect-square w-full max-w-xs">
              <span className={`${corner} left-0 top-0 rounded-tl-2xl border-l-4 border-t-4`} />
              <span className={`${corner} right-0 top-0 rounded-tr-2xl border-r-4 border-t-4`} />
              <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
              <span className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4`} />
              <span className="anim-scan absolute inset-x-3 h-0.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" />
            </div>
            <p className="text-center text-sm text-white/70">
              Point your camera at the QR sticker on the station.
            </p>
          </div>
          <div className="space-y-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <form onSubmit={submitCode} className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Or type the code, e.g. VRC-SL01"
                autoCapitalize="characters"
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-lime"
              />
              <button
                type="submit"
                aria-label="Continue"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime text-ink"
              >
                <ArrowRight size={20} />
              </button>
            </form>
            {codeError && <p className="text-sm text-bad">{codeError}</p>}
            <p className="text-xs text-white/50">Demo: tap a code to simulate scanning that station.</p>
            <div className="flex flex-wrap gap-2">
              {stations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pick(s)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 2. confirm */}
      {step === "confirm" &&
        station &&
        (() => {
          const live = station.status === "online";
          const ready = readyCount(station);
          const need = mode === "rent" ? RULES.minBalance : RULES.outrightPrice;
          const enough = balance >= need;
          const blocked = !live
            ? "This station is offline right now."
            : ready === 0
              ? "No power banks are ready here. Try another station."
              : mode === "rent" && rental
                ? "You already have a power bank out."
                : null;
          return (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-4">
                <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
                  <Mascot size={52} mood={blocked ? "sleepy" : "happy"} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold">{station.venue}</p>
                    <p className="text-xs text-muted">
                      {station.code} · {ready} of {station.slots.length} ready
                      {live && ready > 0 ? ` · ${avgCharge(station)}% avg.` : ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-full bg-raised p-1 text-sm font-bold">
                  {(["rent", "buy"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      aria-pressed={mode === m}
                      className={cn(
                        "rounded-full py-2.5 transition-colors",
                        mode === m ? "bg-lime text-ink" : "text-muted"
                      )}
                    >
                      {m === "rent" ? "Rent" : `Buy outright`}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 rounded-3xl border border-line bg-surface p-4">
                  {mode === "rent" ? (
                    <>
                      <Row label="Rate" value={`${money(RULES.ratePerHour)} / hour`} />
                      <Row label="Minimum balance" value={`${RULES.minBalance} credits`} />
                      <Row label="Your balance" value={money(balance)} warn={!enough} />
                      <p className="pt-2 text-xs text-muted">
                        Return it to any VRC station within {RULES.overdueHours} hours. After that it
                        becomes a purchase and {RULES.outrightPrice} credits are used.
                      </p>
                    </>
                  ) : (
                    <>
                      <Row label="Price" value={`${money(RULES.outrightPrice)} flat`} />
                      <Row label="Pay with" value="VRC Credits" />
                      <Row label="Your balance" value={money(balance)} warn={!enough} />
                      <p className="pt-2 text-xs text-muted">
                        The slot opens and the power bank is yours to keep. No returns.
                      </p>
                    </>
                  )}
                </div>

                {blocked && <p className="rounded-2xl bg-warn/15 p-3 text-sm text-warn">{blocked}</p>}
                {!blocked && !enough && (
                  <p className="rounded-2xl bg-warn/15 p-3 text-sm text-warn">
                    You need {need} credits for this. Top up first.
                  </p>
                )}
              </div>
              <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {blocked ? (
                  <button disabled className="w-full rounded-full bg-raised py-4 text-base font-bold text-muted">
                    Not available
                  </button>
                ) : !enough ? (
                  <button
                    onClick={onTopUp}
                    className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink"
                  >
                    Top up credits
                  </button>
                ) : (
                  <button
                    onClick={() => setStep("unlocking")}
                    className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink hover:brightness-105"
                  >
                    {mode === "rent" ? "Unlock a power bank" : `Pay ${money(RULES.outrightPrice)} and take it`}
                  </button>
                )}
              </div>
            </>
          );
        })()}

      {/* 3. unlocking */}
      {step === "unlocking" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <Mascot size={96} />
          <UnlockProgress />
          <p className="text-sm text-muted">Talking to the station…</p>
        </div>
      )}

      {/* 4. done */}
      {step === "done" && station && (
        <div className="relative flex flex-1 flex-col">
          <Confetti />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <Mascot size={88} />
            <div className="grid h-24 w-24 place-items-center rounded-full bg-lime font-heading text-5xl font-bold text-ink">
              {slot}
            </div>
            <h3 className="font-heading text-3xl font-bold">Slot {slot} is open</h3>
            <p className="max-w-xs text-sm text-muted">
              {mode === "rent"
                ? `Pull out the power bank. Billing starts now at ${money(RULES.ratePerHour)} per hour.`
                : "Pull out the power bank. It's yours to keep. Enjoy!"}
            </p>
          </div>
          <div className="space-y-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {mode === "rent" ? (
              <button
                onClick={onOpenRental}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-4 text-base font-bold text-ink"
              >
                <Check size={18} /> View my rental
              </button>
            ) : (
              <button onClick={onClose} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
                Done
              </button>
            )}
            {mode === "rent" && (
              <button onClick={onClose} className="w-full rounded-full py-3 text-sm font-semibold text-muted">
                Back to map
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. error */}
      {step === "error" && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <Mascot size={88} mood="sleepy" />
            <h3 className="font-heading text-2xl font-bold">That didn&apos;t work</h3>
            <p className="max-w-xs text-sm text-muted">{error}</p>
          </div>
          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button onClick={onClose} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
              Back to map
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
