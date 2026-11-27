"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Card, Chip, ConfirmModal, DataTable, Drawer, Td, Tr, btnDanger } from "./ui";
import { useAdmin } from "@/lib/admin";
import type { AdminRentalDto } from "@/lib/appTypes";
import { cn } from "@/lib/cn";
import { fmtSpan } from "@/lib/format";
import { fmtDate, fmtTime } from "@/lib/validate";

const HOUR = 3_600_000;

function useTick(ms: number) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export default function RentalsView({ onToast }: { onToast: (m: string) => void }) {
  const { rentals, convertRental } = useAdmin();
  const now = useTick(30_000);
  const [onlyActive, setOnlyActive] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);

  const list = rentals.filter((r) => !onlyActive || r.status === "active");
  const r = rentals.find((x) => x.id === openId) ?? null;

  const state = (x: AdminRentalDto) => {
    const limit = x.overdueHours * HOUR;
    if (x.status === "returned") return { tone: "ok" as const, text: "Returned" };
    if (x.status === "converted") return { tone: "bad" as const, text: "Converted" };
    const el = now - x.startedAt;
    if (el >= limit) return { tone: "bad" as const, text: "Overdue" };
    if (el >= limit - 4 * HOUR) return { tone: "warn" as const, text: "Near limit" };
    return { tone: "ok" as const, text: "In use" };
  };

  return (
    <Card
      title="Rentals and tracking"
      action={
        <div className="flex gap-1 rounded-full bg-raised p-1 text-sm font-bold" role="radiogroup" aria-label="Filter">
          {([true, false] as const).map((v) => (
            <button key={String(v)} role="radio" aria-checked={onlyActive === v} onClick={() => setOnlyActive(v)} className={cn("rounded-full px-4 py-1.5", onlyActive === v ? "bg-lime text-ink" : "text-muted")}>
              {v ? "Active" : "All"}
            </button>
          ))}
        </div>
      }
    >
      <DataTable head={["Rental", "Customer", "Station", "Time out", "Status", ""]} empty={list.length ? undefined : "No rentals to show."}>
        {list.map((x) => {
          const s = state(x);
          const el = (x.endedAt ?? now) - x.startedAt;
          const limit = x.overdueHours * HOUR;
          return (
            <Tr key={x.id} onClick={() => setOpenId(x.id)}>
              <Td><p className="font-bold">{x.id}</p><p className="font-mono text-xs text-muted">{x.serial}</p></Td>
              <Td><p className="font-mono">{x.customer}</p><p className="text-xs text-muted">{x.customerName}</p></Td>
              <Td>{x.station} <span className="text-muted">· slot {x.slot}</span></Td>
              <Td>
                <p className="font-semibold">{fmtSpan(el)}</p>
                {x.status === "active" && (
                  <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-raised">
                    <div className={cn("h-full rounded-full", s.tone === "bad" ? "bg-bad" : s.tone === "warn" ? "bg-warn" : "bg-lime")} style={{ width: `${Math.min(100, (el / limit) * 100)}%` }} />
                  </div>
                )}
              </Td>
              <Td><Chip tone={s.tone}>{s.text}</Chip></Td>
              <Td className="text-right text-lime">Track</Td>
            </Tr>
          );
        })}
      </DataTable>

      {r && (
        <Drawer title={`${r.id} · ${r.customer}`} onClose={() => setOpenId(null)}>
          <Card title="Power bank">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Serial</dt><dd className="font-mono font-semibold">{r.serial}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Taken from</dt><dd className="font-semibold">{r.station}, slot {r.slot}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Last seen</dt><dd className="font-semibold">{r.status === "returned" ? `Returned at ${r.returnedAt}` : r.status === "converted" ? "Not returned" : "With customer"}</dd></div>
            </dl>
          </Card>

          <Card title="Timeline">
            <ol className="space-y-4">
              {[
                { label: "Unlocked", at: r.startedAt, done: true },
                { label: "In use", at: r.startedAt, done: true },
                r.status === "returned"
                  ? { label: "Returned", at: r.endedAt ?? 0, done: true }
                  : r.status === "converted"
                    ? { label: "Converted to purchase", at: r.endedAt ?? 0, done: true }
                    : { label: now - r.startedAt >= r.overdueHours * HOUR ? "Overdue" : `Return due (${r.overdueHours}h)`, at: r.startedAt + r.overdueHours * HOUR, done: false },
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full", s.done ? "bg-lime text-ink" : "border-2 border-dashed border-line text-muted")}>
                    {s.done ? <Check size={16} strokeWidth={3} /> : null}
                  </span>
                  <span className="flex-1 font-semibold">{s.label}</span>
                  <span className="text-sm text-muted">{fmtDate(s.at)} {fmtTime(s.at)}</span>
                </li>
              ))}
            </ol>
          </Card>

          {r.status === "active" && (
            <button onClick={() => setAsk(true)} className={cn(btnDanger, "w-full")}>Convert to purchase</button>
          )}

          {ask && (
            <ConfirmModal
              title="Convert to a purchase?"
              body={`The customer keeps the power bank and up to $${r.outright.toFixed(2)} of their credits are forfeited (promo credits first). This can't be undone.`}
              confirmLabel="Convert"
              danger
              onClose={() => setAsk(false)}
              onConfirm={async () => {
                const res = await convertRental(r.id);
                if (!res.ok) return res.reason;
                onToast("Rental converted");
              }}
            />
          )}
        </Drawer>
      )}
    </Card>
  );
}
