"use client";

import { useState } from "react";
import { Banknote, ChevronRight, CircleHelp, Clock, CreditCard, LogOut, QrCode, Settings } from "lucide-react";
import Avatar from "@/components/shared/Avatar";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { RULES, money } from "@/lib/mock";
import { useApp } from "@/lib/store";
import HelpPage from "./HelpPage";
import HistoryPage from "./HistoryPage";
import MethodsPage from "./MethodsPage";
import ProfilePage from "./ProfilePage";
import QrSheet from "./QrSheet";
import SettingsPage from "./SettingsPage";

type Page = "profile" | "methods" | "history" | "settings" | "help" | null;

function MenuRow({
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
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 border-b border-line px-4 py-4 text-left last:border-b-0"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-raised">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      <ChevronRight size={20} className="text-muted" />
    </button>
  );
}

export default function AccountScreen({
  onTopUp,
  onToast,
}: {
  onTopUp: () => void;
  onToast: (m: string) => void;
}) {
  const { balance, history } = useApp();
  const { profile, methods } = useAccount();
  const { signOut } = useAuth();
  const [page, setPage] = useState<Page>(null);
  const [qr, setQr] = useState(false);

  const pct = Math.min(100, Math.round((balance / RULES.minBalance) * 100));
  const enough = balance >= RULES.minBalance;
  const back = () => setPage(null);

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-36 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="font-heading text-3xl font-bold">Account</h1>

        {/* profile */}
        <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card">
          <Avatar id={profile.avatar} size={64} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-heading text-xl font-bold">{profile.name}</p>
            <p className="text-sm text-muted">{profile.phone}</p>
          </div>
          <button
            onClick={() => setPage("profile")}
            className="rounded-full border border-line px-4 py-2 text-sm font-bold"
          >
            Edit
          </button>
        </div>

        {/* credits */}
        <div className="rounded-3xl bg-lime p-5 text-ink shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">VRC Credits</p>
          <p className="font-heading text-5xl font-bold leading-tight">{money(balance)}</p>
          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-ink/20"
            role="progressbar"
            aria-valuenow={Math.min(balance, RULES.minBalance)}
            aria-valuemin={0}
            aria-valuemax={RULES.minBalance}
            aria-label="Progress toward the minimum rental balance"
          >
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold">
            {enough
              ? `You're above the ${RULES.minBalance}-credit minimum. Ready to rent.`
              : `${money(RULES.minBalance - balance)} more to reach the ${RULES.minBalance}-credit minimum.`}
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={onTopUp} className="flex-1 rounded-full bg-ink py-3.5 text-base font-bold text-lime">
              Top up
            </button>
            <button
              onClick={() => setQr(true)}
              className="flex items-center justify-center gap-2 rounded-full border-2 border-ink px-4 py-3.5 text-sm font-bold"
            >
              <Banknote size={18} /> Pay cash
            </button>
          </div>
        </div>

        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          <span className="font-bold text-fg">How credits work: </span>
          they&apos;re non-transferable and can only be used on VRC rentals and purchases. Unused cash
          top-ups can be refunded to where they came from. Promo credits can&apos;t.
        </p>

        {/* menu */}
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <MenuRow icon={QrCode} label="My QR code" hint={`For cash top-ups with an agent`} onClick={() => setQr(true)} />
          <MenuRow
            icon={CreditCard}
            label="Payment methods"
            hint={methods.length ? `${methods.length} saved` : "None saved yet"}
            onClick={() => setPage("methods")}
          />
          <MenuRow icon={Clock} label="History" hint={`${history.length} transactions`} onClick={() => setPage("history")} />
          <MenuRow icon={Settings} label="Settings" hint="Appearance, language, notifications, password" onClick={() => setPage("settings")} />
          <MenuRow icon={CircleHelp} label="Help and support" onClick={() => setPage("help")} />
        </div>

        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface py-4 font-bold"
        >
          <LogOut size={18} /> Log out
        </button>
      </div>

      {page === "profile" && <ProfilePage onBack={back} onToast={onToast} />}
      {page === "methods" && (
        <MethodsPage onBack={back} onToast={onToast} onShowQr={() => setQr(true)} />
      )}
      {page === "history" && <HistoryPage onBack={back} />}
      {page === "settings" && <SettingsPage onBack={back} onToast={onToast} />}
      {page === "help" && <HelpPage onBack={back} />}
      {qr && <QrSheet onClose={() => setQr(false)} />}
    </div>
  );
}
