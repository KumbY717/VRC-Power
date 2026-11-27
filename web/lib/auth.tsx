"use client";

// Real authentication. Passwords, codes, sessions and roles all live on the server; the browser only
// holds an httpOnly cookie it cannot read. This file asks the server who the person is and relays
// login, sign-up and reset requests.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { callApi } from "./api";

export type Role = "customer" | "agent" | "admin";
export type Session = { id: string; role: Role; name: string; phone: string | null; email: string | null; mustChangePassword: boolean };
type Status = "loading" | "out" | "in";

/** Only shown while NEXT_PUBLIC_SHOW_DEMO=1 (development). They exist because `./vrc db` creates them. */
export const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO === "1";
export const DEMO_ACCOUNTS: { role: Role; id: string; pw: string }[] = [
  { role: "customer", id: "0771234567", pw: "Customer123" },
  { role: "agent", id: "0782345678", pw: "Agent1234" },
  { role: "admin", id: "admin@vrcpower.test", pw: "Admin1234" },
];

export type LoginResult = { ok: true; session: Session } | { ok: false; reason: "invalid" | "locked" | "network"; message: string; retryAfter?: number };
export type StartResult = { ok: true; challengeId: string; devCode?: string } | { ok: false; message: string; retryAfter?: number };
export type VerifyResult =
  | { ok: true; session: Session | null }
  | { ok: false; code: string; message: string; triesLeft?: number };
export type SimpleResult = { ok: true } | { ok: false; message: string };

type Ctx = {
  status: Status;
  session: Session | null;
  login: (role: Role, id: string, password: string) => Promise<LoginResult>;
  startSignup: (p: { name: string; phone: string; email: string; password: string }) => Promise<StartResult>;
  startReset: (phone: string) => Promise<StartResult>;
  verifyOtp: (challengeId: string, code: string) => Promise<VerifyResult>;
  resetPassword: (challengeId: string, password: string) => Promise<SimpleResult>;
  /** Make a session returned by login/verify the current one. Kept separate so callers can finish their own steps first. */
  adopt: (s: Session) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    callApi<{ session: Session | null }>("/api/auth/me").then((r) => {
      if (!alive) return;
      if (r.ok) setSession(r.data.session);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback<Ctx["login"]>(async (role, id, password) => {
    const r = await callApi<{ session: Session }>("/api/auth/login", { role, id, password });
    if (r.ok) return { ok: true, session: r.data.session };
    if (r.status === 429) return { ok: false, reason: "locked", message: r.message, retryAfter: r.retryAfter };
    if (r.code === "network") return { ok: false, reason: "network", message: r.message };
    return { ok: false, reason: "invalid", message: r.message };
  }, []);

  const startSignup = useCallback<Ctx["startSignup"]>(async (p) => {
    const r = await callApi<{ challengeId: string; devCode?: string }>("/api/auth/signup", p);
    return r.ok ? { ok: true, challengeId: r.data.challengeId, devCode: r.data.devCode } : { ok: false, message: r.message, retryAfter: r.retryAfter };
  }, []);

  const startReset = useCallback<Ctx["startReset"]>(async (phone) => {
    const r = await callApi<{ challengeId: string; devCode?: string }>("/api/auth/forgot", { phone });
    return r.ok ? { ok: true, challengeId: r.data.challengeId, devCode: r.data.devCode } : { ok: false, message: r.message, retryAfter: r.retryAfter };
  }, []);

  const verifyOtp = useCallback<Ctx["verifyOtp"]>(async (challengeId, code) => {
    const r = await callApi<{ session?: Session; ok?: boolean }>("/api/auth/otp/verify", { challengeId, code });
    if (r.ok) return { ok: true, session: r.data.session ?? null };
    return { ok: false, code: r.code, message: r.message, triesLeft: r.triesLeft };
  }, []);

  const resetPassword = useCallback<Ctx["resetPassword"]>(async (challengeId, password) => {
    const r = await callApi("/api/auth/reset", { challengeId, password });
    return r.ok ? { ok: true } : { ok: false, message: r.message };
  }, []);

  const adopt = useCallback((s: Session) => setSession(s), []);

  const signOut = useCallback(async () => {
    setSession(null); // instant on screen; the server call follows
    await callApi("/api/auth/logout", {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      status: !loaded ? "loading" : session ? "in" : "out",
      session,
      login,
      startSignup,
      startReset,
      verifyOtp,
      resetPassword,
      adopt,
      signOut,
    }),
    [loaded, session, login, startSignup, startReset, verifyOtp, resetPassword, adopt, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
