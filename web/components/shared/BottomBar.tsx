"use client";

import { Home, QrCode, User } from "lucide-react";
import { cn } from "@/lib/cn";

export type Tab = "home" | "account";

function TabButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-20 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors",
        active ? "text-lime" : "text-muted hover:text-fg"
      )}
    >
      {children}
      {label}
    </button>
  );
}

/** Exactly two tabs and a raised Scan button in the middle. The left tab can be renamed (Agents use "Shift"). */
export default function BottomBar({
  tab,
  onTab,
  onScan,
  homeLabel = "Home",
  HomeIcon = Home,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onScan: () => void;
  homeLabel?: string;
  HomeIcon?: React.ComponentType<{ size?: number }>;
}) {
  return (
    <nav
      className="fixed left-1/2 z-50 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      aria-label="Main"
    >
      <div className="relative flex h-16 items-center justify-between rounded-full border border-line bg-surface px-4 shadow-card">
        <TabButton active={tab === "home"} label={homeLabel} onClick={() => onTab("home")}>
          <HomeIcon size={22} />
        </TabButton>
        <button
          onClick={onScan}
          aria-label="Scan QR code"
          className="absolute left-1/2 -top-6 grid h-[4.25rem] w-[4.25rem] -translate-x-1/2 place-items-center rounded-full border-4 border-bg bg-lime text-ink shadow-card transition-transform hover:scale-105"
        >
          <QrCode size={28} strokeWidth={2.2} />
        </button>
        <TabButton active={tab === "account"} label="Account" onClick={() => onTab("account")}>
          <User size={22} />
        </TabButton>
      </div>
    </nav>
  );
}
