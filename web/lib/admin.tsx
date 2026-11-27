"use client";

// Admin dashboard state. The server owns everything: it checks that the caller is an admin, applies every rule,
// and writes the audit log. This file asks for the data, shows it, and sends actions.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Mascot from "@/components/shared/Mascot";
import { callApi } from "./api";
import type { AdminCustomerDto, AdminRulesDto, AdminStateDto } from "./appTypes";
import { useAuth } from "./auth";

export type Result = { ok: true } | { ok: false; reason: string };
export type AdjustKind = "promo" | "refund" | "deduct";
export type AdminRules = AdminRulesDto;

export const DEFAULT_RULES: AdminRules = {
  ratePerHour: 1,
  minBalance: 15,
  outrightPrice: 15,
  overdueHours: 24,
  commissionPct: 5,
  baseAllowance: 5,
  saleBonus: 1,
};

type Ctx = AdminStateDto & {
  search: (q: string) => Promise<{ ok: true; customers: AdminCustomerDto[] } | { ok: false; reason: string }>;
  createAgent: (i: { name: string; phone: string; venue: string; event: string; stationIds: string[] }) => Promise<{ ok: true; tempPassword: string } | { ok: false; reason: string }>;
  updateAgentProfile: (agentId: string, i: { venue: string; event: string; stationIds: string[] }) => Promise<Result>;
  changeFloat: (agentId: string, mode: "add" | "take", amount: number, note: string) => Promise<Result>;
  setAgentActive: (agentId: string, active: boolean, reason: string) => Promise<Result>;
  payAgent: (agentId: string, amount: number, note: string) => Promise<Result>;
  adjustCustomer: (customerId: string, kind: AdjustKind, amount: number, reason: string) => Promise<Result>;
  setCustomerActive: (customerId: string, active: boolean, reason: string) => Promise<Result>;
  convertRental: (code: string) => Promise<Result>;
  checkPayment: (ref: string) => Promise<Result>;
  saveRules: (r: AdminRules) => Promise<Result>;
  revokeSession: (id: string) => Promise<Result>;
  remoteUnlock: (stationId: string, slot: number, reason: string) => Promise<Result>;
  setStationStatus: (stationId: string, status: "online" | "offline", reason: string) => Promise<Result>;
  saveStation: (i: { id?: string; code?: string; name: string; venue: string; address: string; lat: number; lng: number; slotCount?: number }) => Promise<Result>;
  refresh: () => Promise<void>;
};

const AdminContext = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [data, setData] = useState<AdminStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const failed = useCallback(
    (status: number, message: string) => {
      if (status === 401) void signOut(); // session ended (12 hours, or an hour idle): back to the login screen
      return message;
    },
    [signOut]
  );

  const refresh = useCallback(async () => {
    const r = await callApi<{ state: AdminStateDto }>("/api/admin/state");
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

  /** Sends an action. On success the screen takes the fresh state that comes back with the answer. */
  const act = useCallback(
    async <T extends object = object>(path: string, body: unknown): Promise<({ ok: true } & T) | { ok: false; reason: string }> => {
      const r = await callApi<{ state: AdminStateDto } & T>(path, body);
      if (r.ok) {
        setData(r.data.state);
        return { ok: true, ...r.data };
      }
      if (r.status === 0 || r.status >= 500) void refresh();
      return { ok: false, reason: failed(r.status, r.message) };
    },
    [failed, refresh]
  );

  const value = useMemo<Ctx | null>(() => {
    if (!data) return null;
    const simple = async (path: string, body: unknown): Promise<Result> => {
      const r = await act(path, body);
      return r.ok ? { ok: true } : r;
    };
    return {
      ...data,
      search: async (q) => {
        const r = await callApi<{ customers: AdminCustomerDto[] }>(`/api/admin/customers?q=${encodeURIComponent(q)}`);
        return r.ok ? { ok: true, customers: r.data.customers } : { ok: false, reason: failed(r.status, r.message) };
      },
      createAgent: async (i) => {
        const r = await act<{ tempPassword: string }>("/api/admin/agent/create", i);
        return r.ok ? { ok: true, tempPassword: r.tempPassword } : r;
      },
      updateAgentProfile: (agentId, i) => simple("/api/admin/agent/profile", { agentId, ...i }),
      changeFloat: (agentId, mode, amount, note) => simple("/api/admin/agent/float", { agentId, mode, amount, note }),
      setAgentActive: (agentId, active, reason) => simple("/api/admin/agent/active", { agentId, active, reason }),
      payAgent: (agentId, amount, note) => simple("/api/admin/agent/payout", { agentId, amount, note }),
      adjustCustomer: (customerId, kind, amount, reason) => simple("/api/admin/customer/adjust", { customerId, kind, amount, reason }),
      setCustomerActive: (customerId, active, reason) => simple("/api/admin/customer/active", { customerId, active, reason }),
      convertRental: (code) => simple("/api/admin/rental/convert", { code }),
      checkPayment: (ref) => simple("/api/admin/payment/check", { ref }),
      saveRules: (rules) => simple("/api/admin/rules/save", rules),
      revokeSession: (id) => simple("/api/admin/session/revoke", { id }),
      remoteUnlock: (stationId, slot, reason) => simple("/api/admin/station/unlock", { stationId, slot, reason }),
      setStationStatus: (stationId, status, reason) => simple("/api/admin/station/status", { stationId, status, reason }),
      saveStation: (i) => simple("/api/admin/station/save", i),
      refresh,
    };
  }, [data, act, failed, refresh]);

  if (!value) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
        <div className="space-y-4">
          <Mascot size={72} mood={error ? "sleepy" : "happy"} className="mx-auto" />
          {error ? (
            <>
              <p className="max-w-xs text-sm text-muted">{error}</p>
              <div className="flex justify-center gap-2">
                <button onClick={() => void refresh()} className="rounded-full bg-lime px-6 py-3 font-bold text-ink">Try again</button>
                <button onClick={() => void signOut()} className="rounded-full border border-line px-6 py-3 font-bold">Sign out</button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Loading the dashboard…</p>
          )}
        </div>
      </div>
    );
  }
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
