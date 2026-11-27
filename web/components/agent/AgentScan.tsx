"use client";

import { useRef, useState } from "react";
import { ArrowRight, Delete, X } from "lucide-react";
import Confetti from "@/components/shared/Confetti";
import Mascot from "@/components/shared/Mascot";
import { useAgent } from "@/lib/agent";
import { cn } from "@/lib/cn";
import { RULES, money } from "@/lib/mock";

type Step = "scan" | "amount" | "confirm" | "done" | "error";
type Mode = "topup" | "sale";

const QUICK = [5, 10, 15, 20];

/** A fresh random reference for one transaction. If the signal drops and the agent taps again, the same ref is sent,
 *  so the server can tell it's a retry and never credits twice. (randomUUID needs https, so use random bytes.) */
function newRef() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function press(k: string) {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === ".") {
      if (value.includes(".")) return;
      return onChange(value === "" ? "0." : value + ".");
    }
    if (value.length >= 6) return;
    if (value.includes(".") && value.split(".")[1].length >= 2) return;
    onChange(value === "0" ? k : value + k);
  }
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          aria-label={k === "back" ? "Delete" : k}
          className="grid h-14 place-items-center rounded-2xl border border-line bg-surface font-heading text-2xl font-bold active:bg-raised"
        >
          {k === "back" ? <Delete size={24} /> : k}
        </button>
      ))}
    </div>
  );
}

export default function AgentScan({ onClose }: { onClose: () => void }) {
  const agent = useAgent();
  const [step, setStep] = useState<Step>("scan");
  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(newRef());
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [mode, setMode] = useState<Mode>("topup");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [lastAmount, setLastAmount] = useState(0);

  const value = Number(amount);
  const amountOk = amount !== "" && Number.isFinite(value) && value >= 1 && value <= 200 && /^\d+(\.\d{1,2})?$/.test(amount);
  const cash = mode === "sale" ? RULES.outrightPrice : value;
  const valid = mode === "sale" ? true : amountOk;
  const overFloat = valid && cash > agent.float;
  const commission = mode === "sale" ? agent.profile.saleBonus : valid ? Math.round(value * agent.profile.commissionRate * 100) / 100 : 0;

  /** Looks the customer up first, so the agent sees a name and can check it's the right person before taking cash. */
  async function pick(raw: string) {
    const c = raw.trim().toUpperCase();
    if (!/^USER-\d{6}$/.test(c)) {
      setCodeError("That doesn't look like a customer code. It should be like USER-482193.");
      return;
    }
    setBusy(true);
    setCodeError("");
    const r = await agent.lookup(c);
    setBusy(false);
    if (!r.ok) {
      setCodeError(r.reason);
      return;
    }
    setCustomer(c);
    setCustomerName(r.name);
    ref.current = newRef();
    setStep("amount");
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    void pick(code);
  }

  // a changed amount or type is a different transaction, so it gets a new reference
  function changeAmount(v: string) {
    ref.current = newRef();
    setAmount(v);
  }
  function changeMode(m: Mode) {
    ref.current = newRef();
    setMode(m);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    const res = mode === "sale" ? await agent.recordSale(customer, ref.current) : await agent.addCredits(customer, value, ref.current);
    setBusy(false);
    if (res.ok) {
      setLastAmount(res.txn.amount);
      setStep("done");
    } else {
      setError(res.reason);
      setStep("error");
    }
  }

  function reset() {
    ref.current = newRef();
    setCustomer("");
    setCustomerName("");
    setCode("");
    setAmount("");
    setMode("topup");
    setStep("scan");
  }

  const dark = step === "scan";
  const corner = "absolute h-9 w-9 border-lime";
  const title = step === "scan" ? "Scan customer" : step === "amount" ? "Cash received" : step === "confirm" ? "Confirm" : step === "done" ? "Done" : "Couldn't send";

  return (
    <div className={cn("anim-fade fixed inset-0 z-[60] flex flex-col", dark ? "bg-black text-white" : "bg-bg text-fg")}>
      <div className="flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="font-heading text-xl font-bold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className={cn("grid h-10 w-10 place-items-center rounded-full", dark ? "bg-white/10 text-white" : "bg-raised text-muted")}
        >
          <X size={20} />
        </button>
      </div>

      {/* 1. scan */}
      {step === "scan" && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
            <div className="relative aspect-square w-full max-w-xs">
              <span className={`${corner} left-0 top-0 rounded-tl-2xl border-l-4 border-t-4`} />
              <span className={`${corner} right-0 top-0 rounded-tr-2xl border-r-4 border-t-4`} />
              <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
              <span className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4`} />
              <span className="anim-scan absolute inset-x-3 h-0.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" />
            </div>
            <p className="text-center text-sm text-white/70">Scan the QR on the customer&apos;s phone (USER-XXXXXX).</p>
          </div>
          <div className="space-y-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <form onSubmit={submitCode} className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Or type the code, e.g. USER-482193"
                autoCapitalize="characters"
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-lime"
              />
              <button type="submit" disabled={busy} aria-label="Continue" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime text-ink disabled:opacity-60">
                <ArrowRight size={20} />
              </button>
            </form>
            {codeError && <p className="text-sm text-bad">{codeError}</p>}
            {agent.demoCustomers.length > 0 && (
              <>
                <p className="text-xs text-white/50">Development only: tap a code to simulate scanning that customer.</p>
                <div className="flex flex-wrap gap-2">
                  {agent.demoCustomers.map((c) => (
                    <button key={c} onClick={() => void pick(c)} className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-xs font-semibold text-white hover:bg-white/20">
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* 2. amount */}
      {step === "amount" && (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-4">
            <div className="flex items-center justify-between rounded-3xl border border-line bg-surface p-4">
              <div>
                <p className="text-xs text-muted">Customer</p>
                <p className="text-lg font-bold">{customerName}</p>
                <p className="font-mono text-sm text-muted">{customer}</p>
              </div>
              <button onClick={reset} className="rounded-full border border-line px-4 py-2 text-sm font-bold">Change</button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-full bg-raised p-1 text-sm font-bold">
              {(["topup", "sale"] as const).map((m) => (
                <button key={m} onClick={() => changeMode(m)} aria-pressed={mode === m} className={cn("rounded-full py-2.5", mode === m ? "bg-lime text-ink" : "text-muted")}>
                  {m === "topup" ? "Cash top-up" : `Outright sale ${money(RULES.outrightPrice)}`}
                </button>
              ))}
            </div>

            {mode === "topup" ? (
              <>
                <div className="rounded-3xl border border-line bg-surface p-5 text-center">
                  <p className="text-sm text-muted">Cash handed to you</p>
                  <p className="font-heading text-5xl font-bold tabular-nums">${amount || "0"}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      onClick={() => changeAmount(String(q))}
                      className={cn("rounded-2xl border py-2.5 font-heading text-lg font-bold", amount === String(q) ? "border-lime bg-lime text-ink" : "border-line bg-surface")}
                    >
                      ${q}
                    </button>
                  ))}
                </div>
                <Keypad value={amount} onChange={changeAmount} />
              </>
            ) : (
              <div className="rounded-3xl border border-line bg-surface p-5 text-center">
                <p className="text-sm text-muted">Cash handed to you</p>
                <p className="font-heading text-5xl font-bold">{money(RULES.outrightPrice)}</p>
                <p className="mt-2 text-sm text-muted">The customer keeps the power bank. No credits needed.</p>
              </div>
            )}

            {overFloat && (
              <p className="rounded-2xl bg-bad/15 p-3 text-sm font-semibold text-bad" role="alert">
                That&apos;s more than your float. You have {agent.float.toFixed(2)} credits left.
              </p>
            )}
            {mode === "topup" && amount !== "" && !amountOk && (
              <p className="text-sm text-bad">Enter an amount from $1 to $200.</p>
            )}
          </div>
          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button
              disabled={!valid || overFloat}
              onClick={() => setStep("confirm")}
              className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink disabled:bg-raised disabled:text-muted"
            >
              Continue
            </button>
          </div>
        </>
      )}

      {/* 3. confirm */}
      {step === "confirm" && (
        <>
          <div className="flex-1 space-y-4 px-5 pt-4">
            <div className="rounded-3xl border-2 border-lime bg-surface p-5">
              <p className="text-lg">
                Receive <span className="font-heading text-3xl font-bold">{money(cash)}</span> cash
              </p>
              <p className="mt-2 text-lg">
                {mode === "sale" ? "Record an outright power bank sale for " : <>Send <span className="font-bold">{cash} credits</span> to </>}
                <span className="font-bold">{customerName}</span> <span className="font-mono text-sm text-muted">({customer})</span>
              </p>
            </div>
            <div className="space-y-2 rounded-3xl border border-line bg-surface p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted">Your float after</span><span className="font-semibold">{(agent.float - cash).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">You earn</span><span className="font-semibold text-lime">+{money(commission)}</span></div>
            </div>
            <p className="text-sm text-muted">Only confirm once the cash is in your hand.</p>
          </div>
          <div className="space-y-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button onClick={() => void confirm()} disabled={busy} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink disabled:opacity-60">{busy ? "Sending…" : "Confirm"}</button>
            <button onClick={() => setStep("amount")} className="w-full py-3 text-sm font-semibold text-muted">Back</button>
          </div>
        </>
      )}

      {/* 4. done */}
      {step === "done" && (
        <div className="relative flex flex-1 flex-col">
          <Confetti />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <Mascot size={88} />
            <h3 className="font-heading text-3xl font-bold">{mode === "sale" ? "Sale recorded" : `${lastAmount} credits sent`}</h3>
            <p className="text-sm text-muted">
              {mode === "sale" ? "Tell the customer to pick their power bank." : <>The customer can tap Unlock now.</>} Your float: <span className="font-bold text-fg">{agent.float.toFixed(2)}</span>
            </p>
          </div>
          <div className="space-y-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button onClick={reset} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">Next customer</button>
            <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-muted">Close</button>
          </div>
        </div>
      )}

      {/* 5. error */}
      {step === "error" && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <Mascot size={88} mood="sleepy" />
            <h3 className="font-heading text-2xl font-bold">That didn&apos;t work</h3>
            <p className="max-w-xs text-sm text-muted">{error}</p>
          </div>
          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button onClick={() => setStep("amount")} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
