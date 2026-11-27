"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, Chip, DataTable, Td, Tr, btnGhost, fieldCls } from "./ui";
import { useAdmin } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime } from "@/lib/validate";

type Tab = "audit" | "sessions";

export default function SecurityView({ onToast }: { onToast: (m: string) => void }) {
  const { audit, sessions, revokeSession } = useAdmin();
  const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState<Tab>("audit");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("All");

  const actions = useMemo(() => ["All", ...Array.from(new Set(audit.map((a) => a.action)))], [audit]);
  const list = audit.filter(
    (a) =>
      (action === "All" || a.action === action) &&
      (!q.trim() || `${a.target} ${a.detail} ${a.actor}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Security sections">
        {([["audit", "Audit log"], ["sessions", "Sessions"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-full border-2 px-5 py-2.5 text-sm font-bold", tab === id ? "border-lime bg-lime text-ink" : "border-line bg-surface")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "audit" && (
        <Card title="Audit log">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-3 rounded-full border-2 border-line bg-bg px-4 py-3 focus-within:border-lime">
              <Search size={18} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the log" aria-label="Search the audit log" className="w-full bg-transparent text-sm outline-none" />
            </label>
            <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" className={cn(fieldCls, "sm:w-56")}>
              {actions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <DataTable head={["When", "Who", "Action", "Target", "Details"]} empty={list.length ? undefined : "Nothing matches."}>
            {list.map((a) => (
              <Tr key={a.id}>
                <Td className="whitespace-nowrap text-muted">{fmtDate(a.at)} {fmtTime(a.at)}</Td>
                <Td>{a.actor}</Td>
                <Td><Chip>{a.action}</Chip></Td>
                <Td className="font-semibold">{a.target}</Td>
                <Td className="min-w-[14rem] text-muted">{a.detail}</Td>
              </Tr>
            ))}
          </DataTable>
          <p className="mt-4 text-xs text-muted">The newest 200 entries. The log is append-only on the server: nobody, including the Super Admin, can edit or delete entries.</p>
        </Card>
      )}

      {tab === "sessions" && (
        <Card title="Staff sessions">
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-raised p-4">
                <div className="leading-tight">
                  <p className="font-bold">{s.who} <Chip>{s.role}</Chip></p>
                  <p className="mt-1 text-sm text-muted">{s.device} · {s.ip} · {s.current ? "active now" : `last seen ${fmtDate(s.lastSeen)} ${fmtTime(s.lastSeen)}`}</p>
                </div>
                {s.current ? (
                  <Chip tone="ok">This session</Chip>
                ) : (
                  <button
                    disabled={busyId === s.id}
                    onClick={async () => {
                      setBusyId(s.id);
                      const r = await revokeSession(s.id);
                      setBusyId("");
                      onToast(r.ok ? "Session revoked" : r.reason);
                    }}
                    className={btnGhost}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Admin sessions end after 12 hours, or after an hour with no activity. Revoking signs that person out at once. Customer sessions are not listed here.</p>
        </Card>
      )}
    </div>
  );
}
