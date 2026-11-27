"use client";

import { Card, Chip, StatTile } from "./ui";
import { useAdmin } from "@/lib/admin";
import { money } from "@/lib/mock";
import { fmtTime } from "@/lib/validate";

function RevenueChart({ REVENUE }: { REVENUE: number[] }) {
  const w = 600;
  const h = 180;
  const pad = 8;
  const max = Math.max(...REVENUE, 1);
  const pts = REVENUE.map((v, i) => [pad + (i * (w - pad * 2)) / (REVENUE.length - 1), h - pad - (v / max) * (h - pad * 2 - 14)] as const);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const total = REVENUE.reduce((a, b) => a + b, 0);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Revenue for the last 14 days. Total ${money(total)}. Highest day ${money(max)}.`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={h - pad - f * (h - pad * 2 - 14)} y2={h - pad - f * (h - pad * 2 - 14)} stroke="var(--line)" strokeDasharray="4 6" />
        ))}
        <polygon points={area} fill="var(--lime)" opacity="0.18" />
        <polyline points={line} fill="none" stroke="var(--lime)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? "var(--lime)" : "var(--surface)"} stroke="var(--lime)" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>14 days ago</span>
        <span>Total {money(total)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function Overview() {
  const { agents, rentals, audit, revenue, outstanding, counts, stations, now } = useAdmin();
  const active = rentals.filter((r) => r.status === "active");
  const nearOverdue = active.filter((r) => now - r.startedAt > (r.overdueHours - 4) * 3_600_000);
  const onShift = agents.filter((a) => a.onShift && a.active);
  const flagged = agents.filter((a) => a.recon[0] && a.recon[0] !== 0);
  const today = revenue[revenue.length - 1];
  const yesterday = revenue[revenue.length - 2];
  const vs = yesterday > 0 ? `${today >= yesterday ? "+" : "−"}${Math.round((Math.abs(today - yesterday) / yesterday) * 100)}% vs yesterday` : "Yesterday: no top-ups";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Top-ups today" value={money(today)} hint={vs} />
        <StatTile label="Active rentals" value={String(counts.activeRentals)} hint={nearOverdue.length ? `${nearOverdue.length} near the overdue limit` : "All within limits"} tone={nearOverdue.length ? "warn" : undefined} />
        <StatTile label="Credits outstanding" value={money(outstanding)} hint="Owed to customers" />
        <StatTile label="Agents on shift" value={`${onShift.length} / ${counts.agentsActive}`} hint={flagged.length ? `${flagged.length} with a cash mismatch` : "No cash mismatches"} tone={flagged.length ? "bad" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Top-ups, last 14 days" className="lg:col-span-2">
          <RevenueChart REVENUE={revenue} />
        </Card>
        <Card title="Station health">
          <div className="space-y-3">
            {stations.length === 0 && <p className="text-sm text-muted">No stations yet.</p>}
            {stations.map((s) => {
              const banks = s.slots.filter((x): x is { serial: string; charge: number } => x !== null);
              const ready = banks.filter((b) => b.charge >= 60).length;
              const avg = banks.length ? Math.round(banks.reduce((n, b) => n + b.charge, 0) / banks.length) : 0;
              return (
                <div key={s.id} className="rounded-2xl border border-line bg-raised p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{s.name}</p>
                    <Chip tone={s.status === "online" ? "ok" : "bad"}>
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${s.status === "online" ? "bg-lime" : "bg-bad"}`} />
                      {s.status === "online" ? "Online" : "Offline"}
                    </Chip>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {ready}/{s.slots.length} ready · {banks.length} docked · {avg}% avg
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Needs attention">
          <ul className="space-y-2 text-sm">
            {nearOverdue.length === 0 && flagged.length === 0 && <li className="text-muted">Nothing needs attention. 🎉</li>}
            {nearOverdue.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-warn/10 p-3">
                <span><span className="font-bold">{r.id}</span> · {r.customer} at {r.station}</span>
                <Chip tone="warn">{Math.floor((now - r.startedAt) / 3_600_000)}h out</Chip>
              </li>
            ))}
            {flagged.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-bad/10 p-3">
                <span><span className="font-bold">{a.name}</span> last shift cash was off</span>
                <Chip tone="bad">{a.recon[0] < 0 ? "Short" : "Over"} ${Math.abs(a.recon[0]).toFixed(2)}</Chip>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent activity">
          <ul className="space-y-3">
            {audit.length === 0 && <li className="text-sm text-muted">Nothing yet.</li>}
            {audit.slice(0, 6).map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lime" />
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{a.action}</span> · {a.target}
                  <span className="block truncate text-muted">{a.detail}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{fmtTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
