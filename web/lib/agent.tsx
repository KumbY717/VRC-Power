"use client";

// The agent's app state. The server owns the float, shifts and every credit handed out; this file asks for it,
// shows it, and sends actions. Screens use the same hook as before (useAgent).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Mascot from "@/components/shared/Mascot";
import { callApi } from "./api";
import type { AgentEntryDto, AgentStateDto, ReportDto } from "./appTypes";
import { useAuth } from "./auth";

export type AgentTxn = AgentEntryDto;
export type Report = ReportDto;
export type AddResult = { ok: true; txn: AgentTxn } | { ok: false; reason: string };
export type SimpleResult = { ok: true } | { ok: false; reason: string };

type Ctx = {
  profile: AgentStateDto["profile"];
  shiftOpen: boolean;
  startedAt: number | null;
  /** credits still available to hand out */
  float: number;
  /** float when this shift started (or the current float when off shift) */
  assigned: number;
  entries: AgentTxn[];
  reports: Report[];
  week: AgentStateDto["week"];
  payouts: AgentStateDto["payouts"];
  demoCustomers: string[];
  /** the stations this agent works at, with what is in them now */
  stations: AgentStateDto["stations"];
  /** credits handed out this shift = cash that should be in the agent's hands */
  given: number;
  commissionTotal: number;
  /** base allowance + commission for this shift */
  earned: number;
  startShift: () => Promise<SimpleResult>;
  /** shows the customer's first name so the agent can check it's the right person */
  lookup: (code: string) => Promise<{ ok: true; name: string } | { ok: false; reason: string }>;
  /** `ref` must be new for each transaction and the same for every retry of that transaction */
  addCredits: (code: string, amount: number, ref: string) => Promise<AddResult>;
  recordSale: (code: string, ref: string) => Promise<AddResult>;
  endShift: (countedCash: number) => Promise<{ ok: true; report: Report } | { ok: false; reason: string }>;
  refresh: () => Promise<void>;
};

const AgentContext = createContext<Ctx | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [data, setData] = useState<AgentStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const failed = useCallback(
    (status: number, message: string) => {
      if (status === 401) void signOut();
      return message;
    },
    [signOut]
  );

  const refresh = useCallback(async () => {
    const r = await callApi<{ state: AgentStateDto }>("/api/agent/state");
    if (r.ok) {
      setData(r.data.state);
      setError(null);
    } else setError(failed(r.status, r.message));
  }, [failed]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const poll = setInterval(onVisible, 30_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const startShift = useCallback(async (): Promise<SimpleResult> => {
    const r = await callApi<{ state: AgentStateDto }>("/api/agent/shift/start", {});
    if (r.ok) {
      setData(r.data.state);
      return { ok: true };
    }
    void refresh();
    return { ok: false, reason: failed(r.status, r.message) };
  }, [failed, refresh]);

  const lookup = useCallback(
    async (code: string) => {
      const r = await callApi<{ customer: { name: string } }>("/api/agent/lookup", { code });
      return r.ok ? ({ ok: true, name: r.data.customer.name } as const) : ({ ok: false, reason: failed(r.status, r.message) } as const);
    },
    [failed]
  );

  const send = useCallback(
    async (body: Record<string, unknown>): Promise<AddResult> => {
      const r = await callApi<{ entry: AgentTxn; state: AgentStateDto }>("/api/agent/credit", body);
      if (r.ok) {
        setData(r.data.state);
        return { ok: true, txn: r.data.entry };
      }
      // a failed call may still have gone through (bad signal): the screen reloads and the same ref is safe to retry
      if (r.status === 0 || r.status >= 500) void refresh();
      return { ok: false, reason: failed(r.status, r.message) };
    },
    [failed, refresh]
  );

  const addCredits = useCallback((code: string, amount: number, ref: string) => send({ code, kind: "topup", amount, ref }), [send]);
  const recordSale = useCallback((code: string, ref: string) => send({ code, kind: "sale", ref }), [send]);

  const endShift = useCallback(
    async (countedCash: number) => {
      const r = await callApi<{ report: Report; state: AgentStateDto }>("/api/agent/shift/end", { counted: countedCash });
      if (r.ok) {
        setData(r.data.state);
        return { ok: true, report: r.data.report } as const;
      }
      void refresh();
      return { ok: false, reason: failed(r.status, r.message) } as const;
    },
    [failed, refresh]
  );

  const value = useMemo<Ctx | null>(() => {
    if (!data) return null;
    const sh = data.shift;
    return {
      profile: data.profile,
      shiftOpen: !!sh,
      startedAt: sh?.startedAt ?? null,
      float: data.float,
      assigned: sh ? sh.assigned : data.float,
      entries: sh?.entries ?? [],
      reports: data.reports,
      week: data.week,
      payouts: data.payouts,
      demoCustomers: data.demoCustomers,
      stations: data.stations,
      given: sh?.given ?? 0,
      commissionTotal: sh?.commissionTotal ?? 0,
      earned: sh?.earned ?? 0,
      startShift,
      lookup,
      addCredits,
      recordSale,
      endShift,
      refresh,
    };
  }, [data, startShift, lookup, addCredits, recordSale, endShift, refresh]);

  if (!value) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
        <div className="space-y-4">
          <Mascot size={72} mood={error ? "sleepy" : "happy"} className="mx-auto" />
          {error ? (
            <>
              <p className="max-w-xs text-sm text-muted">{error}</p>
              <div className="flex justify-center gap-2">
                <button onClick={() => void refresh()} className="rounded-full bg-lime px-6 py-3 font-bold text-ink">
                  Try again
                </button>
                <button onClick={() => void signOut()} className="rounded-full border border-line px-6 py-3 font-bold">
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Loading your shift…</p>
          )}
        </div>
      </div>
    );
  }
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside <AgentProvider>");
  return ctx;
}
