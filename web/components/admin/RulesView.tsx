"use client";

import { useState } from "react";
import { Card, btnGhost, btnPrimary, fieldCls } from "./ui";
import { useAdmin } from "@/lib/admin";
import { AdminRules, DEFAULT_RULES } from "@/lib/admin";

const FIELDS: { key: keyof AdminRules; label: string; unit: string; hint: string }[] = [
  { key: "ratePerHour", label: "Rental rate", unit: "$ per hour", hint: "Billed per started hour when the power bank is returned." },
  { key: "minBalance", label: "Minimum balance to rent", unit: "credits", hint: "The security hold a customer must have in their wallet." },
  { key: "outrightPrice", label: "Buy outright price", unit: "$ flat", hint: "Also the amount forfeited when a rental is not returned." },
  { key: "overdueHours", label: "Overdue limit", unit: "hours", hint: "After this, a rental converts into a purchase." },
  { key: "commissionPct", label: "Agent commission", unit: "% of cash top-ups", hint: "Paid on top of the daily allowance." },
  { key: "baseAllowance", label: "Agent daily allowance", unit: "$ per shift", hint: "Flat pay for attending a shift." },
  { key: "saleBonus", label: "Agent sale bonus", unit: "$ per sale", hint: "Fixed bonus for each outright sale facilitated." },
];

export default function RulesView({ onToast }: { onToast: (m: string) => void }) {
  const { rules, saveRules } = useAdmin();
  const [draft, setDraft] = useState<Record<keyof AdminRules, string>>(() =>
    Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Record<keyof AdminRules, string>
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = Object.fromEntries(
      (Object.keys(draft) as (keyof AdminRules)[]).map((k) => [k, draft[k].trim() === "" ? NaN : Number(draft[k])])
    ) as AdminRules;
    setBusy(true);
    const res = await saveRules(next);
    setBusy(false);
    if (res.ok) {
      setError("");
      onToast("Rules saved and logged");
    } else setError(res.reason);
  }

  return (
    <Card title="Pricing and rules">
      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm font-semibold">
            {f.label} <span className="font-normal text-muted">({f.unit})</span>
            <input
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              inputMode="decimal"
              className={`${fieldCls} mt-1.5`}
            />
            <span className="mt-1 block text-xs font-normal text-muted">{f.hint}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-4 text-sm font-semibold text-bad" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={() => void save()} className={btnPrimary}>{busy ? "Saving…" : "Save rules"}</button>
        <button
          onClick={() => {
            setDraft(Object.fromEntries(Object.entries(DEFAULT_RULES).map(([k, v]) => [k, String(v)])) as Record<keyof AdminRules, string>);
            setError("");
          }}
          className={btnGhost}
        >
          Reset to defaults
        </button>
        <p className="text-xs text-muted">Changes apply to rentals started from now on. A power bank already out keeps the price and time limit it started with. Agent pay applies to the next transaction. Every change is written to the audit log.</p>
      </div>
    </Card>
  );
}
