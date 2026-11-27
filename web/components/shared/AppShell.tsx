"use client";

import { useEffect, useState } from "react";
import AccountScreen from "@/components/account/AccountScreen";
import TopUp from "@/components/account/TopUp";
import AdminApp from "@/components/admin/AdminApp";
import AgentApp from "@/components/agent/AgentApp";
import AuthFlow from "@/components/auth/AuthFlow";
import HomeScreen from "@/components/home/HomeScreen";
import Landing from "@/components/landing/Landing";
import ActiveRental from "@/components/rental/ActiveRental";
import OverdueNotice from "@/components/rental/OverdueNotice";
import ScanScreen, { ScanRequest } from "@/components/scan/ScanScreen";
import BottomBar, { Tab } from "./BottomBar";
import Mascot from "./Mascot";
import { AccountProvider } from "@/lib/account";
import { AdminProvider } from "@/lib/admin";
import { AgentProvider } from "@/lib/agent";
import "@/styles/motion.css";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LocationProvider } from "@/lib/location";
import { cn } from "@/lib/cn";
import { callApi } from "@/lib/api";
import { RULES } from "@/lib/mock";
import { AppProvider, useApp } from "@/lib/store";

/** The customer app: Home map, Scan, Account. */
function CustomerApp() {
  const { rental } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [scan, setScan] = useState<ScanRequest | null>(null);
  const [rentalOpen, setRentalOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [resumeRef, setResumeRef] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // coming back from Paynow's card page: reopen the top-up screen on that payment
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("paynow");
    if (ref && /^VRC-[A-Z0-9]{12}$/.test(ref)) {
      setResumeRef(ref);
      setTopUpOpen(true);
    }
    if (ref !== null) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function openScan(req: ScanRequest = {}) {
    // one power bank at a time: renting again just opens the current rental
    if (rental && req.mode !== "buy") {
      if (req.mode === "rent") setToast("You already have a power bank out.");
      setRentalOpen(true);
      return;
    }
    setScan(req);
  }

  return (
    <>
      {/* Home stays mounted so the map keeps its position between tabs */}
      <div className={cn("absolute inset-0", tab !== "home" && "hidden")}>
        <HomeScreen
          onScan={() => openScan()}
          onRent={(s) => openScan({ station: s, mode: "rent" })}
          onBuy={(s) => openScan({ station: s, mode: "buy" })}
          onOpenRental={() => setRentalOpen(true)}
        />
      </div>
      {tab === "account" && <AccountScreen onTopUp={() => setTopUpOpen(true)} onToast={setToast} />}

      <BottomBar tab={tab} onTab={setTab} onScan={() => openScan()} />

      {scan && (
        <ScanScreen
          initialStation={scan.station}
          initialMode={scan.mode}
          onClose={() => setScan(null)}
          onTopUp={() => {
            setScan(null);
            setTopUpOpen(true);
          }}
          onOpenRental={() => {
            setScan(null);
            setRentalOpen(true);
          }}
        />
      )}

      {topUpOpen && (
        <TopUp
          resumeRef={resumeRef}
          onClose={() => {
            setTopUpOpen(false);
            setResumeRef(null);
          }}
        />
      )}
      {rentalOpen && <ActiveRental onClose={() => setRentalOpen(false)} />}

      <OverdueNotice />

      {toast && (
        <div
          role="status"
          className="anim-sheet fixed left-1/2 top-24 z-[90] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-bg shadow-card"
        >
          {toast}
        </div>
      )}
    </>
  );
}

/** Decides what to show: landing, sign in, or the app for the signed-in role. */
function Gate() {
  const { status, session } = useAuth();
  const [screen, setScreen] = useState<"login" | "signup" | "apply" | null>(null);

  if (status === "loading") {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <Mascot size={72} />
      </div>
    );
  }

  if (!session) {
    if (screen)
      return <AuthFlow key={screen} start={screen} onExit={() => setScreen(null)} onAuthed={() => setScreen(null)} />;
    return <Landing onLogin={() => setScreen("login")} onSignup={() => setScreen("signup")} onApply={() => setScreen("apply")} />;
  }

  if (session.role === "agent")
    return (
      <AgentProvider>
        <AgentApp />
      </AgentProvider>
    );
  if (session.role === "admin")
    return (
      <AdminProvider>
        <AdminApp />
      </AdminProvider>
    );

  return (
    <LocationProvider>
      <AppProvider>
        <CustomerApp />
      </AppProvider>
    </LocationProvider>
  );
}

/**
 * Keeps the prices on screen in step with the ones the server really charges (the admin can change them).
 * Runs once at start, whenever the app comes back to the front, and every few minutes.
 */
function useServerRules(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await callApi<{ rules: typeof RULES }>("/api/rules");
      if (!alive || !r.ok) return;
      const next = r.data.rules;
      if ((Object.keys(next) as (keyof typeof RULES)[]).some((k) => typeof next[k] === "number" && RULES[k] !== next[k])) {
        Object.assign(RULES, next);
        setVersion((v) => v + 1); // re-draw everything with the new numbers
      }
    }
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const t = setInterval(onVisible, 5 * 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return version;
}

export default function AppShell() {
  useServerRules();
  return (
    <AccountProvider>
      <AuthProvider>
        <main className="relative h-dvh w-full overflow-hidden bg-bg">
          <Gate />
        </main>
      </AuthProvider>
    </AccountProvider>
  );
}
