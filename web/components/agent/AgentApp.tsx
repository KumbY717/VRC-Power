"use client";

import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import BottomBar, { Tab } from "@/components/shared/BottomBar";
import { useAgent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import AgentAccount from "./AgentAccount";
import AgentScan from "./AgentScan";
import ReconcilePage from "./ReconcilePage";
import ShiftScreen from "./ShiftScreen";

/** The agent app: Shift, Scan (customer QR), Account. */
export default function AgentApp() {
  const { shiftOpen } = useAgent();
  const [tab, setTab] = useState<Tab>("home");
  const [scan, setScan] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <div className={cn("absolute inset-0", tab !== "home" && "hidden")}>
        <ShiftScreen onEnd={() => setReconcile(true)} onToast={setToast} />
      </div>
      {tab === "account" && <AgentAccount onToast={setToast} />}

      <BottomBar
        tab={tab}
        onTab={setTab}
        homeLabel="Shift"
        HomeIcon={Briefcase}
        onScan={() => {
          if (!shiftOpen) {
            setTab("home");
            setToast("Start your shift to take cash top-ups.");
          } else setScan(true);
        }}
      />

      {scan && <AgentScan onClose={() => setScan(false)} />}
      {reconcile && <ReconcilePage onClose={() => setReconcile(false)} />}

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
