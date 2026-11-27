"use client";

import { useEffect, useState } from "react";
import { Briefcase, Clock, Cpu, CreditCard, LayoutDashboard, LogOut, Menu, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import AgentsView from "./AgentsView";
import CustomersView from "./CustomersView";
import Overview from "./Overview";
import PaymentsView from "./PaymentsView";
import RentalsView from "./RentalsView";
import RulesView from "./RulesView";
import SecurityView from "./SecurityView";
import StationsView from "./StationsView";

type View = "overview" | "agents" | "stations" | "customers" | "rentals" | "payments" | "rules" | "security";

const NAV: { id: View; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Briefcase },
  { id: "stations", label: "Stations", icon: Cpu },
  { id: "customers", label: "Customers", icon: Users },
  { id: "rentals", label: "Rentals and tracking", icon: Clock },
  { id: "payments", label: "Top-ups", icon: CreditCard },
  { id: "rules", label: "Pricing and rules", icon: SlidersHorizontal },
  { id: "security", label: "Security and audit", icon: ShieldCheck },
];

function NavList({ view, onPick }: { view: View; onPick: (v: View) => void }) {
  return (
    <nav aria-label="Admin sections" className="space-y-1">
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          aria-current={view === id ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-colors",
            view === id ? "bg-lime text-ink" : "text-muted hover:bg-raised hover:text-fg"
          )}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}

/** Super Admin dashboard. Sidebar on desktop, slide-over menu on phones. */
export default function AdminApp() {
  const { session, signOut } = useAuth();
  const [view, setView] = useState<View>("overview");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const title = NAV.find((n) => n.id === view)?.label ?? "";
  const pick = (v: View) => {
    setView(v);
    setMenu(false);
  };

  return (
    <div className="absolute inset-0 flex bg-bg">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface p-5 md:flex">
        <Logo />
        <p className="mb-6 mt-1 pl-[3.25rem] text-xs font-bold uppercase tracking-wider text-muted">Admin</p>
        <NavList view={view} onPick={pick} />
        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <p className="text-sm text-muted">Signed in as <span className="font-bold text-fg">{session?.name}</span></p>
          <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-line py-3 text-sm font-bold hover:border-lime">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
          <button onClick={() => setMenu(true)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-full border border-line md:hidden">
            <Menu size={20} />
          </button>
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-10 md:p-6">
          <div className="mx-auto max-w-6xl">
            {view === "overview" && <Overview />}
            {view === "agents" && <AgentsView onToast={setToast} />}
            {view === "stations" && <StationsView onToast={setToast} />}
            {view === "customers" && <CustomersView onToast={setToast} />}
            {view === "rentals" && <RentalsView onToast={setToast} />}
            {view === "payments" && <PaymentsView />}
            {view === "rules" && <RulesView onToast={setToast} />}
            {view === "security" && <SecurityView onToast={setToast} />}
          </div>
        </main>
      </div>

      {menu && (
        <div className="anim-fade fixed inset-0 z-[55] flex bg-black/60 md:hidden" onClick={() => setMenu(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="anim-sheet flex h-full w-[min(20rem,85%)] flex-col border-r border-line bg-surface p-5">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMenu(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full border border-line">
                <X size={18} />
              </button>
            </div>
            <NavList view={view} onPick={pick} />
            <button onClick={signOut} className="mt-auto flex w-full items-center justify-center gap-2 rounded-full border-2 border-line py-3 text-sm font-bold">
              <LogOut size={16} /> Log out
            </button>
          </aside>
        </div>
      )}

      {toast && (
        <div role="status" className="anim-sheet fixed left-1/2 top-20 z-[90] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-bg shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}
