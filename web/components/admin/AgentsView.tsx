"use client";

import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { Card, Chip, ConfirmModal, DataTable, Drawer, Td, Tr, btnGhost, btnPrimary, fieldCls } from "./ui";
import { useAdmin } from "@/lib/admin";
import type { AdminAgentDto } from "@/lib/appTypes";
import { cn } from "@/lib/cn";
import { money } from "@/lib/mock";
import { fmtDate, maskNumber } from "@/lib/validate";

const reconTone = (d: number) => (d === 0 ? "ok" : "bad");
const reconText = (d: number) => (d === 0 ? "Matched" : d < 0 ? `Short $${Math.abs(d).toFixed(2)}` : `Over $${d.toFixed(2)}`);

function StationPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { stations } = useAdmin();
  if (!stations.length) return <p className="text-sm text-muted">No stations yet.</p>;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Stations">
      {stations.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
            className={cn("rounded-full border-2 px-4 py-2 text-sm font-bold", on ? "border-lime bg-lime text-ink" : "border-line")}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/** Shown once, right after an agent is created. The password is never stored in readable form. */
function NewAgentDone({ name, phone, password, onClose }: { name: string; phone: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-lime/15 p-4 text-sm font-semibold text-lime">{name} is set up. Give them these login details now.</p>
      <div className="space-y-2 rounded-3xl border border-line bg-surface p-5 text-sm">
        <div className="flex justify-between"><span className="text-muted">Phone number</span><span className="font-mono font-bold">{phone}</span></div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">One-time password</span>
          <span className="font-mono text-xl font-bold tracking-wider">{password}</span>
        </div>
      </div>
      <p className="text-sm text-muted">
        This password is shown <span className="font-bold text-fg">only this once</span> and can&apos;t be looked up later. If it is lost, the agent can use &ldquo;Forgot password&rdquo; on the login screen to set a new one by SMS code.
      </p>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`VRC Power agent login. Phone: ${phone} Password: ${password}`);
              setCopied(true);
            } catch {
              /* clipboard not available: the password is on screen */
            }
          }}
          className={cn(btnGhost, "flex flex-1 items-center justify-center gap-2")}
        >
          <Copy size={16} /> {copied ? "Copied" : "Copy details"}
        </button>
        <button onClick={onClose} className={cn(btnPrimary, "flex-1")}>Done</button>
      </div>
    </div>
  );
}

function AddAgent({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { createAgent } = useAdmin();
  const [f, setF] = useState({ name: "", phone: "", venue: "", event: "" });
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError("");
    const r = await createAgent({ ...f, stationIds });
    setBusy(false);
    if (r.ok) {
      setDone(r.tempPassword);
      onToast("Agent created");
    } else setError(r.reason);
  }

  return (
    <Drawer title="Add an agent" onClose={onClose}>
      {done ? (
        <NewAgentDone name={f.name} phone={f.phone} password={done} onClose={onClose} />
      ) : (
        <div className="space-y-3">
          {(
            [
              ["name", "Full name", "e.g. Farai Moyo"],
              ["phone", "Phone number", "e.g. 0782345678"],
              ["venue", "Venue", "e.g. Eastgate Mall"],
              ["event", "Event (optional)", "e.g. Harare Tech Expo"],
            ] as const
          ).map(([k, label, ph]) => (
            <label key={k} className="block text-sm font-semibold">
              {label}
              <input value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} placeholder={ph} inputMode={k === "phone" ? "tel" : undefined} className={cn(fieldCls, "mt-1.5")} />
            </label>
          ))}
          <div className="text-sm font-semibold">
            <p className="mb-1.5">Stations they look after</p>
            <StationPicker value={stationIds} onChange={setStationIds} />
          </div>
          {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
          <button disabled={busy} onClick={() => void submit()} className={cn(btnPrimary, "w-full")}>{busy ? "Creating…" : "Create agent"}</button>
          <p className="text-xs text-muted">A one-time password is made for you to hand over. They start with no float: add it after.</p>
        </div>
      )}
    </Drawer>
  );
}

function AgentDrawer({ agent, onClose, onToast }: { agent: AdminAgentDto; onClose: () => void; onToast: (m: string) => void }) {
  const { rules, changeFloat, payAgent, setAgentActive, updateAgentProfile } = useAdmin();
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [payAmount, setPayAmount] = useState(agent.owed > 0 ? agent.owed.toFixed(2) : "");
  const [payNote, setPayNote] = useState("");
  const [venue, setVenue] = useState(agent.venue === "Unassigned" ? "" : agent.venue);
  const [event, setEvent] = useState(agent.event);
  const [stationIds, setStationIds] = useState(agent.stationIds);
  const [error, setError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);
  const setErr = (k: string, v: string) => setError((e) => ({ ...e, [k]: v }));

  async function run(key: string, fn: () => Promise<{ ok: true } | { ok: false; reason: string }>, done: string) {
    setBusy(key);
    setErr(key, "");
    const r = await fn();
    setBusy("");
    if (r.ok) onToast(done);
    else setErr(key, r.reason);
  }

  return (
    <Drawer title={agent.name} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {!agent.active ? <Chip tone="bad">Suspended</Chip> : agent.onShift ? <Chip tone="ok">On shift</Chip> : <Chip>Off shift</Chip>}
        <Chip>{agent.venue}</Chip>
        <Chip>{maskNumber(agent.phone)}</Chip>
      </div>

      <Card title="Float">
        <p className="font-heading text-4xl font-bold">{agent.floatLeft}<span className="text-xl text-muted"> / {agent.floatAssigned}</span></p>
        <p className="mt-1 text-sm text-muted">Credits the agent can still hand out. Cash in hand at the end of a shift must equal the credits given.</p>
        <div className="mt-4 space-y-2">
          <input value={amount} onChange={(e) => { setAmount(e.target.value); setErr("float", ""); }} inputMode="decimal" aria-label="Credits" className={fieldCls} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed when taking back)" aria-label="Note" className={fieldCls} />
          <div className="flex gap-2">
            <button
              disabled={!agent.active || !!busy}
              onClick={() => void run("float", () => changeFloat(agent.id, "add", Number(amount), note), `Added ${amount} credits to ${agent.name}'s float`)}
              className={cn(btnPrimary, "flex-1")}
            >
              Add float
            </button>
            <button
              disabled={!!busy}
              onClick={() => void run("float", () => changeFloat(agent.id, "take", Number(amount), note), `Took ${amount} credits back`)}
              className={cn(btnGhost, "flex-1")}
            >
              Take back
            </button>
          </div>
        </div>
        {error.float && <p className="mt-2 text-sm font-semibold text-bad" role="alert">{error.float}</p>}
      </Card>

      <Card title="Pay">
        <div className="grid grid-cols-3 gap-2 text-center">
          {([["Earned", agent.earnedTotal], ["Paid", agent.paidTotal], ["Owed", agent.owed]] as const).map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-raised p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{l}</p>
              <p className={cn("font-heading text-xl font-bold", l === "Owed" && v > 0 && "text-lime")}>{money(v)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {money(rules.baseAllowance)} per shift + {rules.commissionPct}% of cash top-ups + {money(rules.saleBonus)} per outright sale. Counted when a shift is closed. Change these in Pricing and rules.
        </p>
        <div className="mt-3 space-y-2">
          <input value={payAmount} onChange={(e) => { setPayAmount(e.target.value); setErr("pay", ""); }} inputMode="decimal" placeholder="Amount paid ($)" aria-label="Amount paid" className={fieldCls} />
          <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note, e.g. EcoCash, week ending 22 Nov" aria-label="Payment note" className={fieldCls} />
          <button disabled={!!busy || agent.owed <= 0} onClick={() => void run("pay", () => payAgent(agent.id, Number(payAmount), payNote), "Payout recorded")} className={cn(btnPrimary, "w-full")}>
            Record payout
          </button>
          <p className="text-xs text-muted">This only records a payment you have made yourself (EcoCash, cash). Nothing is sent from here.</p>
          {error.pay && <p className="text-sm font-semibold text-bad" role="alert">{error.pay}</p>}
        </div>
        {agent.payouts.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {agent.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-raised p-3">
                <span className="text-muted">{fmtDate(p.at)} {p.note && `· ${p.note}`}</span>
                <span className="font-semibold">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Cash counts">
        {agent.recon.length === 0 ? (
          <p className="text-sm text-muted">No completed shifts yet.</p>
        ) : (
          <ul className="space-y-2">
            {agent.recon.map((d, i) => (
              <li key={i} className="flex items-center justify-between rounded-2xl bg-raised p-3 text-sm">
                <span className="text-muted">{i === 0 ? "Last shift" : `${i + 1} shifts ago`}</span>
                <Chip tone={reconTone(d)}>{reconText(d)}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Venue and stations">
        <div className="space-y-2">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" aria-label="Venue" className={fieldCls} />
          <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Event (optional)" aria-label="Event" className={fieldCls} />
          <StationPicker value={stationIds} onChange={setStationIds} />
          <button disabled={!!busy} onClick={() => void run("profile", () => updateAgentProfile(agent.id, { venue, event, stationIds }), "Details saved")} className={cn(btnGhost, "w-full")}>
            Save details
          </button>
          {error.profile && <p className="text-sm font-semibold text-bad" role="alert">{error.profile}</p>}
        </div>
      </Card>

      <button onClick={() => setConfirm(true)} className={agent.active ? "w-full rounded-full border-2 border-bad py-3 font-bold text-bad" : cn(btnGhost, "w-full")}>
        {agent.active ? "Suspend agent" : "Reactivate agent"}
      </button>

      {confirm && (
        <ConfirmModal
          title={agent.active ? `Suspend ${agent.name}?` : `Reactivate ${agent.name}?`}
          body={agent.active ? "They are signed out right now and can't take cash until reactivated. Their float stays as it is." : "They'll be able to log in and start shifts again."}
          confirmLabel={agent.active ? "Suspend" : "Reactivate"}
          danger={agent.active}
          needReason
          onClose={() => setConfirm(false)}
          onConfirm={async (reason) => {
            const res = await setAgentActive(agent.id, !agent.active, reason);
            if (!res.ok) return res.reason;
            onToast(agent.active ? "Agent suspended" : "Agent reactivated");
          }}
        />
      )}
    </Drawer>
  );
}

export default function AgentsView({ onToast }: { onToast: (m: string) => void }) {
  const { agents } = useAdmin();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const agent = agents.find((a) => a.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <Card
        title="Agents"
        action={
          <button onClick={() => setAdding(true)} className={cn(btnPrimary, "flex items-center gap-2 py-2.5")}>
            <Plus size={16} /> Add agent
          </button>
        }
      >
        <DataTable head={["Agent", "Venue", "Status", "Float", "Owed", "Last cash count", ""]} empty={agents.length ? undefined : "No agents yet. Add the first one."}>
          {agents.map((a) => (
            <Tr key={a.id} onClick={() => setOpenId(a.id)}>
              <Td><p className="font-bold">{a.name}</p><p className="text-xs text-muted">{maskNumber(a.phone)}</p></Td>
              <Td>{a.venue}</Td>
              <Td>{!a.active ? <Chip tone="bad">Suspended</Chip> : a.onShift ? <Chip tone="ok">On shift</Chip> : <Chip>Off shift</Chip>}</Td>
              <Td>
                <p className="font-semibold">{a.floatLeft} / {a.floatAssigned}</p>
                <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-lime" style={{ width: `${a.floatAssigned ? (a.floatLeft / a.floatAssigned) * 100 : 0}%` }} />
                </div>
              </Td>
              <Td className="font-semibold">{money(a.owed)}</Td>
              <Td>{a.recon.length ? <Chip tone={reconTone(a.recon[0])}>{reconText(a.recon[0])}</Chip> : <span className="text-muted">No shifts yet</span>}</Td>
              <Td className="text-right text-lime">Open</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>

      {agent && <AgentDrawer key={agent.id} agent={agent} onClose={() => setOpenId(null)} onToast={onToast} />}
      {adding && <AddAgent onClose={() => setAdding(false)} onToast={onToast} />}
    </div>
  );
}
