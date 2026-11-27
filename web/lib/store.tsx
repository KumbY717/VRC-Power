"use client";

// The customer's app state. The server owns the money, rentals and station inventory; this file asks for
// it, shows it, and sends actions. The screens use the same hooks as before (useApp, useNow).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { callApi } from "./api";
import type { ReceiptDto, RentalDto, StateDto, TxnDto } from "./appTypes";
import { useAuth } from "./auth";
import { distanceM } from "./geo";
import { useLocation } from "./location";
import type { Station } from "./mock";
import Mascot from "@/components/shared/Mascot";

export type Rental = RentalDto;
export type Txn = TxnDto;
export type TxnKind = TxnDto["kind"];
export type Receipt = ReceiptDto;
export type Notice = { kind: "converted"; stationName: string; amount: number };
export type ActionResult = { ok: true; slot: number } | { ok: false; reason: string };
export type SimpleResult = { ok: true } | { ok: false; reason: string };

type Ctx = {
  balance: number;
  accountCode: string;
  stations: Station[];
  rental: Rental | null;
  history: Txn[];
  notice: Notice | null;
  /** how far the phone's clock is from the server's, in ms */
  skew: number;
  unlock: (stationId: string) => Promise<ActionResult>;
  buy: (stationId: string) => Promise<ActionResult>;
  returnBank: () => Promise<Receipt | null>;
  /** development only: make the current rental look older */
  advance: (hours: number) => Promise<void>;
  clearNotice: () => void;
  refresh: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [data, setData] = useState<StateDto | null>(null);
  const [skew, setSkew] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noticeSeen, setNoticeSeen] = useState(false);
  const { pos } = useLocation();

  const apply = useCallback((s: StateDto) => {
    setData(s);
    setSkew(s.now - Date.now());
    setError(null);
    setNoticeSeen(false);
  }, []);

  /** Handles the failures every call can have. Returns the message to show. */
  const failed = useCallback(
    (status: number, message: string) => {
      if (status === 401) void signOut(); // session ended: back to the login screen
      return message;
    },
    [signOut]
  );

  const refresh = useCallback(async () => {
    const r = await callApi<{ state: StateDto }>("/api/me/state");
    if (r.ok) apply(r.data.state);
    else setError(failed(r.status, r.message));
  }, [apply, failed]);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // while a rental runs, re-check the 24-hour rule from the server now and then
  const rentalOn = !!data?.rental;
  useEffect(() => {
    if (!rentalOn) return;
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [rentalOn, refresh]);

  // names, positions and stock come from the server; distances are worked out here from the phone's own position
  const stations = useMemo<Station[]>(() => {
    if (!data) return [];
    return data.stations.map((s) => ({ ...s, distanceM: pos ? Math.round(distanceM(pos, s)) : null }));
  }, [data, pos]);

  const unlock = useCallback(
    async (stationId: string): Promise<ActionResult> => {
      const r = await callApi<{ slot: number; state: StateDto }>("/api/rentals/unlock", { stationId });
      if (r.ok) {
        apply(r.data.state);
        return { ok: true, slot: r.data.slot };
      }
      return { ok: false, reason: failed(r.status, r.message) };
    },
    [apply, failed]
  );

  const buy = useCallback(
    async (stationId: string): Promise<ActionResult> => {
      const r = await callApi<{ slot: number; state: StateDto }>("/api/rentals/buy", { stationId });
      if (r.ok) {
        apply(r.data.state);
        return { ok: true, slot: r.data.slot };
      }
      return { ok: false, reason: failed(r.status, r.message) };
    },
    [apply, failed]
  );

  const returnBank = useCallback(async (): Promise<Receipt | null> => {
    if (!data?.rental) return null;
    // a power bank can go back into any station with a free slot: pick the nearest
    const free = stations
      .filter((s) => s.status === "online" && s.slots.includes(null))
      .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
    const target = free[0] ?? stations.find((s) => s.id === data.rental?.stationId);
    if (!target) return null;
    const r = await callApi<{ receipt: Receipt; state: StateDto }>("/api/rentals/return", { stationId: target.id });
    if (r.ok) {
      apply(r.data.state);
      return r.data.receipt;
    }
    failed(r.status, r.message);
    void refresh();
    return null;
  }, [data, stations, apply, failed, refresh]);

  const advance = useCallback(
    async (hours: number) => {
      const r = await callApi<{ state: StateDto }>("/api/dev/time-travel", { hours });
      if (r.ok) apply(r.data.state);
    },
    [apply]
  );

  const clearNotice = useCallback(() => {
    setNoticeSeen(true);
    void callApi("/api/me/ack-notice", {});
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!data) return null;
    return {
      balance: data.balance,
      accountCode: data.accountCode,
      stations,
      rental: data.rental,
      history: data.history,
      notice: data.notice && !noticeSeen ? { kind: "converted", stationName: data.notice.stationName, amount: data.notice.amount } : null,
      skew,
      unlock,
      buy,
      returnBank,
      advance,
      clearNotice,
      refresh,
    };
  }, [data, stations, noticeSeen, skew, unlock, buy, returnBank, advance, clearNotice, refresh]);

  if (!value) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
        <div className="space-y-4">
          <Mascot size={72} mood={error ? "sleepy" : "happy"} className="mx-auto" />
          {error ? (
            <>
              <p className="text-sm text-muted">{error}</p>
              <button onClick={() => void refresh()} className="rounded-full bg-lime px-6 py-3 font-bold text-ink">
                Try again
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">Loading your wallet…</p>
          )}
        </div>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Server time that re-renders every `ms`. Client components only. */
export function useNow(ms = 1000) {
  const { skew } = useApp();
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n + skew;
}
