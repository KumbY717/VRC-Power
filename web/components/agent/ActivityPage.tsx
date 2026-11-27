"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Mascot from "@/components/shared/Mascot";
import SubPage from "@/components/shared/SubPage";
import { useAgent } from "@/lib/agent";
import { money } from "@/lib/mock";
import { fmtTime } from "@/lib/validate";

export default function ActivityPage({ onBack }: { onBack: () => void }) {
  const { entries } = useAgent();
  const [q, setQ] = useState("");
  const list = useMemo(
    () => entries.filter((t) => !q.trim() || t.customer.toLowerCase().includes(q.trim().toLowerCase())),
    [entries, q]
  );
  const customers = new Set(entries.map((t) => t.customer)).size;

  return (
    <SubPage title="Customers served" onBack={onBack}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Customers</p>
          <p className="font-heading text-3xl font-bold">{customers}</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Transactions</p>
          <p className="font-heading text-3xl font-bold">{entries.length}</p>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-full border-2 border-line bg-surface px-4 py-3 focus-within:border-lime">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a customer code" aria-label="Search customers" className="w-full bg-transparent text-sm outline-none" />
      </label>

      {list.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Mascot size={72} mood="sleepy" />
          <p className="text-sm text-muted">{entries.length ? "No match." : "No customers served yet this shift."}</p>
        </div>
      )}
      {list.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-3xl border border-line bg-surface p-4">
          <div className="leading-tight">
            <p className="font-mono font-bold">{t.customer}</p>
            <p className="text-sm text-muted">{t.kind === "sale" ? "Outright sale" : "Cash top-up"} · {fmtTime(t.at)}</p>
          </div>
          <p className="font-heading text-xl font-bold">{money(t.amount)}</p>
        </div>
      ))}
    </SubPage>
  );
}
