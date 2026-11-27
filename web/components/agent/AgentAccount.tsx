"use client";

import { useState } from "react";
import { ChevronRight, CircleHelp, ClipboardList, LogOut, Settings, Users, Wallet } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import HelpPage from "@/components/account/HelpPage";
import SettingsPage from "@/components/account/SettingsPage";
import { useAccount } from "@/lib/account";
import { useAgent } from "@/lib/agent";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/mock";
import ActivityPage from "./ActivityPage";
import EarningsPage from "./EarningsPage";
import ReportsPage from "./ReportsPage";

type Page = "earnings" | "activity" | "reports" | "settings" | "help" | null;

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 border-b border-line px-4 py-4 text-left last:border-b-0">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-raised"><Icon size={20} /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      <ChevronRight size={20} className="text-muted" />
    </button>
  );
}

export default function AgentAccount({ onToast }: { onToast: (m: string) => void }) {
  const { session, signOut } = useAuth();
  const { profile } = useAccount();
  const a = useAgent();
  const [page, setPage] = useState<Page>(null);
  const back = () => setPage(null);

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-36 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="font-heading text-3xl font-bold">Account</h1>

        <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card">
          <Avatar id={profile.avatar} size={64} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-heading text-xl font-bold">{session?.name ?? "Agent"}</p>
            <p className="text-sm text-muted">VRC agent · {session?.id}</p>
          </div>
        </div>

        <div className="rounded-3xl bg-lime p-5 text-ink shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">Earned today</p>
          <p className="font-heading text-5xl font-bold leading-tight">{money(a.earned)}</p>
          <p className="mt-1 text-sm font-semibold">{a.entries.length} transactions this shift</p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <Row icon={Wallet} label="Earnings and payouts" hint="Allowance, commission, weekly chart" onClick={() => setPage("earnings")} />
          <Row icon={Users} label="Customers served" hint={`${a.entries.length} this shift`} onClick={() => setPage("activity")} />
          <Row icon={ClipboardList} label="Shift reports" hint={`${a.reports.length} past shifts`} onClick={() => setPage("reports")} />
          <Row icon={Settings} label="Settings" hint="Appearance, language, password" onClick={() => setPage("settings")} />
          <Row icon={CircleHelp} label="Help and support" onClick={() => setPage("help")} />
        </div>

        <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface py-4 font-bold">
          <LogOut size={18} /> Log out
        </button>
      </div>

      {page === "earnings" && <EarningsPage onBack={back} />}
      {page === "activity" && <ActivityPage onBack={back} />}
      {page === "reports" && <ReportsPage onBack={back} />}
      {page === "settings" && <SettingsPage onBack={back} onToast={onToast} />}
      {page === "help" && <HelpPage onBack={back} />}
    </div>
  );
}
