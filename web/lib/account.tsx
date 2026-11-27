"use client";

// Profile, saved payment methods and settings. Persisted in this browser only (localStorage).
// Replaced by server-side account data when the backend exists.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { USER } from "./mock";

export type Theme = "dark" | "light";
export type TextSize = "normal" | "large";
export type Lang = "en" | "sn" | "nd";
export type MethodType = "ecocash" | "onemoney";
export type Method = { id: string; type: MethodType; number: string };
export type Profile = { name: string; phone: string; email: string; avatar: number };
export type Notify = { reminders: boolean; receipts: boolean; promos: boolean };

type Data = {
  theme: Theme;
  contrast: boolean;
  textSize: TextSize;
  lang: Lang;
  notify: Notify;
  profile: Profile;
  methods: Method[];
  defaultMethodId: string | null;
};

const DEFAULT: Data = {
  theme: "dark",
  contrast: false,
  textSize: "normal",
  lang: "en",
  notify: { reminders: true, receipts: true, promos: false },
  profile: { name: USER.name, phone: USER.phone, email: "", avatar: 0 },
  methods: [{ id: "m1", type: "ecocash", number: "0771234567" }],
  defaultMethodId: "m1",
};

const KEY = "vrc-account-v1";

function merge(raw: unknown): Data {
  if (!raw || typeof raw !== "object") return DEFAULT;
  const r = raw as Partial<Data>;
  const methods = Array.isArray(r.methods)
    ? r.methods.filter(
        (m): m is Method =>
          !!m && typeof m.id === "string" && (m.type === "ecocash" || m.type === "onemoney") && typeof m.number === "string"
      )
    : DEFAULT.methods;
  return {
    theme: r.theme === "light" ? "light" : "dark",
    contrast: !!r.contrast,
    textSize: r.textSize === "large" ? "large" : "normal",
    lang: r.lang === "sn" || r.lang === "nd" ? r.lang : "en",
    notify: { ...DEFAULT.notify, ...(r.notify ?? {}) },
    profile: { ...DEFAULT.profile, ...(r.profile ?? {}) },
    methods,
    defaultMethodId: methods.some((m) => m.id === r.defaultMethodId) ? (r.defaultMethodId ?? null) : (methods[0]?.id ?? null),
  };
}

type Ctx = Data & {
  set: (patch: Partial<Pick<Data, "theme" | "contrast" | "textSize" | "lang">>) => void;
  setNotify: (key: keyof Notify, value: boolean) => void;
  updateProfile: (p: Partial<Profile>) => void;
  addMethod: (type: MethodType, number: string) => Method;
  removeMethod: (id: string) => void;
  setDefaultMethod: (id: string) => void;
};

const AccountContext = createContext<Ctx | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(merge(JSON.parse(raw)));
    } catch {
      /* ignore broken or blocked storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data, loaded]);

  // apply visual settings to the page
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = data.theme;
    if (data.contrast) el.dataset.contrast = "high";
    else delete el.dataset.contrast;
    el.style.fontSize = data.textSize === "large" ? "18.5px" : "";
  }, [data.theme, data.contrast, data.textSize]);

  const set = useCallback((patch: Parameters<Ctx["set"]>[0]) => setData((d) => ({ ...d, ...patch })), []);
  const setNotify = useCallback(
    (key: keyof Notify, value: boolean) => setData((d) => ({ ...d, notify: { ...d.notify, [key]: value } })),
    []
  );
  const updateProfile = useCallback(
    (p: Partial<Profile>) => setData((d) => ({ ...d, profile: { ...d.profile, ...p } })),
    []
  );
  const addMethod = useCallback((type: MethodType, number: string): Method => {
    const m: Method = { id: `m${Date.now().toString(36)}`, type, number: number.replace(/[\s-]/g, "") };
    setData((d) => ({ ...d, methods: [...d.methods, m], defaultMethodId: d.defaultMethodId ?? m.id }));
    return m;
  }, []);
  const removeMethod = useCallback(
    (id: string) =>
      setData((d) => {
        const methods = d.methods.filter((m) => m.id !== id);
        return {
          ...d,
          methods,
          defaultMethodId: d.defaultMethodId === id ? (methods[0]?.id ?? null) : d.defaultMethodId,
        };
      }),
    []
  );
  const setDefaultMethod = useCallback((id: string) => setData((d) => ({ ...d, defaultMethodId: id })), []);

  const value = useMemo<Ctx>(
    () => ({ ...data, set, setNotify, updateProfile, addMethod, removeMethod, setDefaultMethod }),
    [data, set, setNotify, updateProfile, addMethod, removeMethod, setDefaultMethod]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside <AccountProvider>");
  return ctx;
}
