"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, Chip, ConfirmModal, DataTable, Drawer, Td, Tr, btnGhost, btnPrimary, fieldCls } from "./ui";
import { useAdmin, AdjustKind } from "@/lib/admin";
import type { AdminCustomerDto } from "@/lib/appTypes";
import { cn } from "@/lib/cn";
import { money } from "@/lib/mock";
import { maskNumber } from "@/lib/validate";

const KINDS: { id: AdjustKind; label: string; hint: string }[] = [
  { id: "promo", label: "Add promo credit", hint: "Goodwill or campaign credit. Never refundable." },
  { id: "refund", label: "Refund cash credit", hint: "Only unspent credits bought with real money. Take the money back to them yourself (EcoCash, cash); this removes the credits." },
  { id: "deduct", label: "Deduct (correction)", hint: "Fixes a mistake. Uses promo credits first, then cash." },
];

export default function CustomersView({ onToast }: { onToast: (m: string) => void }) {
  const { customers, rentals, search, adjustCustomer, setCustomerActive } = useAdmin();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminCustomerDto[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<AdjustKind>("promo");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const term = q.trim();
  async function runSearch(t: string) {
    const r = await search(t);
    if (r.ok) {
      setResults(r.customers);
      setSearchError("");
    } else setSearchError(r.reason);
  }
  // the server searches everyone, so it works with thousands of customers; wait for a pause in typing
  useEffect(() => {
    if (term.length < 2) {
      setResults(null);
      setSearchError("");
      return;
    }
    const t = setTimeout(() => void runSearch(term), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const base = results ?? customers;
  const list = useMemo(() => base.filter((c) => !flaggedOnly || c.flagged), [base, flaggedOnly]);
  const c = base.find((x) => x.id === openId) ?? null;
  const mine = c ? rentals.filter((r) => r.customer === c.code) : [];

  async function submit() {
    if (!c) return;
    setBusy(true);
    const res = await adjustCustomer(c.id, kind, Number(amount), reason);
    setBusy(false);
    if (res.ok) {
      onToast("Wallet updated and logged");
      setAmount("");
      setReason("");
      setError("");
      if (term.length >= 2) void runSearch(term);
    } else setError(res.reason);
  }

  return (
    <Card
      title="Customers"
      action={
        <button onClick={() => setFlaggedOnly((f) => !f)} aria-pressed={flaggedOnly} className={cn("rounded-full border-2 px-4 py-2 text-sm font-bold", flaggedOnly ? "border-lime bg-lime text-ink" : "border-line")}>
          Flagged only
        </button>
      }
    >
      <label className="mb-1 flex items-center gap-3 rounded-full border-2 border-line bg-bg px-4 py-3 focus-within:border-lime">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or code" aria-label="Search customers" className="w-full bg-transparent text-sm outline-none" />
      </label>
      <p className="mb-4 px-2 text-xs text-muted">
        {searchError ? <span className="text-bad">{searchError}</span> : results ? `${results.length} found` : `Showing the ${customers.length} newest customers. Search to find anyone.`}
      </p>
      <DataTable head={["Customer", "Phone", "Cash credits", "Promo", "Rentals", ""]} empty={list.length ? undefined : "No customers match."}>
        {list.map((x) => (
          <Tr key={x.id} onClick={() => { setOpenId(x.id); setError(""); }}>
            <Td><p className="font-bold">{x.name}</p><p className="font-mono text-xs text-muted">{x.code}</p></Td>
            <Td>{maskNumber(x.phone)}</Td>
            <Td className="font-semibold">{money(x.cash)}</Td>
            <Td>{money(x.promo)}</Td>
            <Td>{x.rentals}</Td>
            <Td>{!x.active ? <Chip tone="bad">Suspended</Chip> : x.flagged ? <Chip tone="warn">Flagged</Chip> : null}</Td>
          </Tr>
        ))}
      </DataTable>

      {c && (
        <Drawer title={c.name} onClose={() => setOpenId(null)}>
          <div className="flex flex-wrap gap-2">
            <Chip>{c.code}</Chip>
            {!c.active && <Chip tone="bad">Suspended</Chip>}
            {c.flagged && <Chip tone="warn">Flagged: a power bank was not returned</Chip>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-line bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Cash credits</p>
              <p className="font-heading text-3xl font-bold">{money(c.cash)}</p>
              <p className="text-xs text-muted">Refundable</p>
            </div>
            <div className="rounded-3xl border border-line bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Promo credits</p>
              <p className="font-heading text-3xl font-bold">{money(c.promo)}</p>
              <p className="text-xs text-muted">Not refundable</p>
            </div>
          </div>

          <Card title="Adjust wallet">
            <div role="radiogroup" aria-label="Adjustment type" className="space-y-2">
              {KINDS.map((k) => (
                <button key={k.id} role="radio" aria-checked={kind === k.id} onClick={() => { setKind(k.id); setError(""); }} className={cn("w-full rounded-2xl border-2 p-3 text-left", kind === k.id ? "border-lime bg-lime/10" : "border-line")}>
                  <span className="block font-bold">{k.label}</span>
                  <span className="block text-sm text-muted">{k.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount ($)" aria-label="Amount" className={fieldCls} />
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (saved in the audit log)" aria-label="Reason" className={fieldCls} />
              {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
              <button disabled={busy} onClick={() => void submit()} className={cn(btnPrimary, "w-full")}>{busy ? "Applying…" : "Apply"}</button>
            </div>
          </Card>

          <Card title="Recent rentals">
            {mine.length === 0 ? (
              <p className="text-sm text-muted">No recent rentals.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {mine.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-2xl bg-raised p-3">
                    <span>{r.id} · {r.station}</span>
                    <Chip tone={r.status === "converted" ? "bad" : r.status === "active" ? "warn" : "ok"}>{r.status}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <button onClick={() => setConfirm(true)} className={c.active ? "w-full rounded-full border-2 border-bad py-3 font-bold text-bad" : cn(btnGhost, "w-full")}>
            {c.active ? "Suspend customer" : "Reactivate customer"}
          </button>

          {confirm && (
            <ConfirmModal
              title={c.active ? `Suspend ${c.name}?` : `Reactivate ${c.name}?`}
              body={c.active ? "They are signed out right now and can't log in or rent. Their credits are kept." : "They'll be able to log in and rent again."}
              confirmLabel={c.active ? "Suspend" : "Reactivate"}
              danger={c.active}
              needReason
              onClose={() => setConfirm(false)}
              onConfirm={async (r) => {
                const res = await setCustomerActive(c.id, !c.active, r);
                if (!res.ok) return res.reason;
                onToast(c.active ? "Customer suspended" : "Customer reactivated");
                if (term.length >= 2) void runSearch(term);
              }}
            />
          )}
        </Drawer>
      )}
    </Card>
  );
}
