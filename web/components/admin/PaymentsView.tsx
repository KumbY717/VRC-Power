"use client";

import { useState } from "react";
import { Card, DataTable, StatTile, Td, Tr } from "./ui";
import { useAdmin } from "@/lib/admin";
import { money } from "@/lib/mock";
import { fmtDate, fmtTime } from "@/lib/validate";

export default function PaymentsView() {
  const { topups, revenue, payments, checkPayment } = useAdmin();
  const [checking, setChecking] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const week = revenue.slice(-7).reduce((a, b) => a + b, 0);
  const fortnight = revenue.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Today" value={money(revenue[revenue.length - 1])} hint="Credits bought" />
        <StatTile label="Last 7 days" value={money(week)} />
        <StatTile label="Last 14 days" value={money(fortnight)} />
      </div>

      <Card title="Paynow payments">
        <DataTable head={["Reference", "Customer", "Paid with", "Amount", "Status", ""]} empty={payments.length ? undefined : "No Paynow payments yet."}>
          {payments.map((p) => (
            <Tr key={p.ref}>
              <Td>
                <p className="font-mono text-xs font-semibold">{p.ref}</p>
                <p className="text-xs text-muted">{fmtDate(p.at)} {fmtTime(p.at)}</p>
              </Td>
              <Td><p className="font-bold">{p.customerName}</p><p className="font-mono text-xs text-muted">{p.customer}</p></Td>
              <Td>{p.method}</Td>
              <Td className="font-semibold">{money(p.amount)}</Td>
              <Td>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-bold " +
                    (p.status === "paid" ? "bg-lime text-ink" : p.status === "pending" ? "bg-raised text-fg" : "bg-bad/20 text-bad")
                  }
                >
                  {p.status === "paid" ? "Paid" : p.status === "pending" ? "Waiting" : p.status === "cancelled" ? "Cancelled" : "Failed"}
                </span>
                {p.flag && <p className="mt-1 max-w-xs text-xs font-semibold text-warn">{p.flag}</p>}
                {p.error && <p className="mt-1 max-w-xs text-xs text-muted">{p.error}</p>}
              </Td>
              <Td>
                {(p.status === "pending" || p.flag) && (
                  <button
                    disabled={checking === p.ref}
                    onClick={async () => {
                      setChecking(p.ref);
                      setMsg("");
                      const r = await checkPayment(p.ref);
                      setChecking(null);
                      setMsg(r.ok ? `Checked ${p.ref} with Paynow.` : r.reason);
                    }}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                  >
                    {checking === p.ref ? "Checking…" : "Check now"}
                  </button>
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>
        {msg && <p className="mt-3 text-sm font-semibold" role="status">{msg}</p>}
        <p className="mt-4 text-xs text-muted">
          Credits are added only after Paynow itself confirms the money arrived. A payment still &quot;Waiting&quot; after a few minutes may just be unapproved on the customer&apos;s phone; Check now asks Paynow again.
        </p>
      </Card>

      <Card title="Recent top-ups">
        <DataTable head={["Reference", "Customer", "Paid with", "Amount", "When"]} empty={topups.length ? undefined : "No top-ups yet."}>
          {topups.map((p) => (
            <Tr key={p.id}>
              <Td className="font-mono text-xs font-semibold">{p.ref}</Td>
              <Td><p className="font-bold">{p.customerName}</p><p className="font-mono text-xs text-muted">{p.customer}</p></Td>
              <Td>{p.method}</Td>
              <Td className="font-semibold">{money(p.amount)}</Td>
              <Td className="text-muted">{fmtDate(p.at)} {fmtTime(p.at)}</Td>
            </Tr>
          ))}
        </DataTable>
        <p className="mt-4 text-xs text-muted">
          Every top-up is a credit in a customer&apos;s wallet: cash handed to an agent, or a confirmed Paynow payment. To give money back, use Refund cash credit on the customer&apos;s page. If Paynow refunds a payment after the credits were added, it is flagged above and a person decides what to do.
        </p>
      </Card>
    </div>
  );
}
