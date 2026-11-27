"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Confetti from "@/components/shared/Confetti";
import Mascot from "@/components/shared/Mascot";
import { useAccount } from "@/lib/account";
import { callApi } from "@/lib/api";
import type { PaymentDto } from "@/lib/appTypes";
import { cn } from "@/lib/cn";
import { RULES, money } from "@/lib/mock";
import { useApp } from "@/lib/store";
import { isEcocash, isOnemoney, maskNumber } from "@/lib/validate";

type Step = "amount" | "method" | "agent" | "pending" | "success" | "failed";
type Kind = "ecocash" | "onemoney" | "card" | "agent";

const CHIPS = [5, 10, 15, 20, 30, 50];
const LABEL: Record<Kind, string> = {
  ecocash: "EcoCash",
  onemoney: "OneMoney",
  card: "Visa / Mastercard",
  agent: "Cash with an agent",
};

export default function TopUp({ onClose, resumeRef = null }: { onClose: () => void; resumeRef?: string | null }) {
  const { balance, accountCode, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const { methods, addMethod } = useAccount();
  const [step, setStep] = useState<Step>(resumeRef ? "pending" : "amount");
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [ref, setRef] = useState<string | null>(resumeRef);
  const [slow, setSlow] = useState(false);
  const [amount, setAmount] = useState("15");
  const [kind, setKind] = useState<Kind | null>(null);
  const [number, setNumber] = useState("");
  const [save, setSave] = useState(true);
  const [error, setError] = useState("");

  const typed = Number(amount);
  const amountOk = amount.trim() !== "" && Number.isFinite(typed) && typed >= 1 && typed <= 200 && /^\d+(\.\d{1,2})?$/.test(amount.trim());
  // once a payment exists, the server's amount is the truth
  const value = payment ? payment.amount : typed;
  const after = balance + (amountOk ? value : 0);

  function choose(k: Kind) {
    setKind(k);
    setError("");
    if (k === "ecocash" || k === "onemoney") {
      setNumber(methods.find((m) => m.type === k)?.number ?? "");
    }
  }

  async function continueFromMethod() {
    if (busy) return;
    if (!kind) return setError("Choose how you want to pay.");
    if (kind === "agent") return setStep("agent");
    if (kind === "ecocash" && !isEcocash(number)) return setError("Enter a valid EcoCash number (077 or 078).");
    if (kind === "onemoney" && !isOnemoney(number)) return setError("Enter a valid OneMoney number (071).");
    setError("");
    setBusy(true);
    const r = await callApi<{ payment: PaymentDto }>("/api/payments/start", { amount: typed, method: kind, phone: kind === "card" ? undefined : number });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if ((kind === "ecocash" || kind === "onemoney") && save && !methods.some((m) => m.number === number.replace(/[\s-]/g, "") && m.type === kind)) {
      addMethod(kind, number);
    }
    const p = r.data.payment;
    setPayment(p);
    setRef(p.ref);
    setSlow(false);
    setStep("pending");
    // card: Paynow's own page takes the card details. Only follow a link that is Paynow's (or our own test page).
    if (p.method === "card" && p.redirectUrl && (p.redirectUrl.startsWith("https://") || p.redirectUrl.startsWith("/?paynow="))) {
      window.location.href = p.redirectUrl;
    }
  }

  // while a payment is waiting, ask the server every few seconds (the server asks Paynow)
  useEffect(() => {
    if (step !== "pending" || !ref) return;
    let alive = true;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      const r = await callApi<{ payment: PaymentDto }>(`/api/payments/status?ref=${encodeURIComponent(ref!)}`);
      if (!alive) return;
      if (r.ok) {
        const p = r.data.payment;
        setPayment(p);
        if (p.status === "paid") {
          await refresh();
          if (alive) setStep("success");
          return;
        }
        if (p.status === "failed" || p.status === "cancelled") {
          setError(p.message ?? "");
          setStep("failed");
          return;
        }
      } else if (r.status === 404) {
        setError("We couldn't find that payment.");
        setStep("failed");
        return;
      }
      if (Date.now() - started > 60_000) setSlow(true);
      timer = setTimeout(check, 3000);
    }
    timer = setTimeout(check, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [step, ref, refresh]);

  const heading =
    step === "amount" ? "Top up credits" : step === "method" ? "Pay with" : step === "agent" ? "Pay cash" : step === "pending" ? "Approve payment" : step === "success" ? "Top-up complete" : "Payment failed";

  return (
    <div className="anim-fade fixed inset-0 z-[56] flex flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="font-heading text-2xl font-bold">{heading}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="mx-auto max-w-xl space-y-4">
          {/* 1. amount */}
          {step === "amount" && (
            <>
              <div className="rounded-3xl border border-line bg-surface p-5">
                <p className="text-sm text-muted">Amount (USD = credits)</p>
                <div className="mt-1 flex items-baseline gap-1 font-heading text-5xl font-bold">
                  <span className="text-muted">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    aria-label="Top-up amount"
                    className="w-full bg-transparent outline-none"
                  />
                </div>
                {!amountOk && amount !== "" && (
                  <p className="mt-2 text-sm text-bad">Enter an amount from $1 to $200.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAmount(String(c))}
                    aria-pressed={amount === String(c)}
                    className={cn(
                      "rounded-2xl border py-3.5 font-heading text-xl font-bold",
                      amount === String(c) ? "border-lime bg-lime text-ink" : "border-line bg-surface"
                    )}
                  >
                    ${c}
                  </button>
                ))}
              </div>
              <div className="space-y-2 rounded-3xl border border-line bg-surface p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted">Current balance</span><span className="font-semibold">{money(balance)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Balance after</span><span className="font-semibold">{money(after)}</span></div>
                {amountOk && after < RULES.minBalance && (
                  <p className="pt-1 text-warn">You&apos;ll still be under the {RULES.minBalance}-credit minimum needed to rent.</p>
                )}
              </div>
              <button
                disabled={!amountOk}
                onClick={() => setStep("method")}
                className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink disabled:bg-raised disabled:text-muted"
              >
                Continue
              </button>
            </>
          )}

          {/* 2. method */}
          {step === "method" && (
            <>
              <p className="text-sm text-muted">
                Adding <span className="font-bold text-fg">{money(value)}</span> in VRC Credits.
              </p>
              {([
                { k: "ecocash", icon: Smartphone, sub: "Pay with your Econet wallet" },
                { k: "onemoney", icon: Smartphone, sub: "Pay with your NetOne wallet" },
                { k: "card", icon: CreditCard, sub: "Entered securely on Paynow's page" },
                { k: "agent", icon: Banknote, sub: "Hand cash to a VRC agent at an event" },
              ] as const).map(({ k, icon: Icon, sub }) => (
                <div
                  key={k}
                  className={cn("rounded-3xl border bg-surface", kind === k ? "border-lime" : "border-line")}
                >
                  <button
                    onClick={() => choose(k)}
                    aria-pressed={kind === k}
                    className="flex w-full items-center gap-4 p-4 text-left"
                  >
                    <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", kind === k ? "bg-lime text-ink" : "bg-raised")}>
                      <Icon size={22} />
                    </span>
                    <span className="leading-tight">
                      <span className="block font-bold">{LABEL[k]}</span>
                      <span className="block text-sm text-muted">{sub}</span>
                    </span>
                  </button>
                  {kind === k && (k === "ecocash" || k === "onemoney") && (
                    <div className="space-y-3 border-t border-line p-4">
                      <label className="block text-sm font-semibold">
                        {LABEL[k]} number
                        <input
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          inputMode="tel"
                          placeholder={k === "ecocash" ? "077 123 4567" : "071 123 4567"}
                          className="mt-1.5 w-full rounded-2xl border border-line bg-raised px-4 py-3 text-base outline-none focus:border-lime"
                        />
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-5 w-5 accent-[var(--lime)]" />
                        Save this number for next time
                      </label>
                    </div>
                  )}
                </div>
              ))}
              {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
              <button onClick={continueFromMethod} disabled={busy} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink disabled:opacity-60">
                {kind === "agent" ? "Show my QR code" : busy ? "Starting…" : `Pay ${money(value)}`}
              </button>
              <button onClick={() => setStep("amount")} className="w-full py-2 text-sm font-semibold text-muted">
                Change amount
              </button>
            </>
          )}

          {/* cash with agent */}
          {step === "agent" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-fit rounded-2xl bg-white p-4">
                <QRCodeSVG value={accountCode} size={200} level="M" bgColor="#ffffff" fgColor="#0b0d0a" />
              </div>
              <p className="font-mono text-2xl font-bold tracking-widest">{accountCode}</p>
              <ol className="space-y-2 rounded-3xl border border-line bg-surface p-4 text-left text-sm">
                <li><span className="font-bold">1.</span> Hand {money(value)} in cash to the VRC agent.</li>
                <li><span className="font-bold">2.</span> Show this QR code. The agent scans it.</li>
                <li><span className="font-bold">3.</span> Your credits arrive instantly. Tap Unlock.</li>
              </ol>
              <button onClick={onClose} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
                Done
              </button>
            </div>
          )}

          {/* 3. waiting for Paynow */}
          {step === "pending" && (
            <div className="space-y-5 pt-6 text-center">
              <Mascot size={88} className="mx-auto" />
              <h3 className="font-heading text-2xl font-bold">
                {(payment?.method ?? kind) === "card" ? "Complete payment on Paynow" : "Check your phone"}
              </h3>
              <p className="mx-auto max-w-sm text-sm text-muted">
                {(payment?.method ?? kind) === "card"
                  ? `Paynow's secure page takes your card details for ${payment ? money(value) : "this payment"}. If it didn't open, go back and try again.`
                  : payment?.instructions ||
                    `We sent a request for ${payment ? money(value) : "this payment"}${kind && number ? ` to ${maskNumber(number)}` : ""}. Enter your PIN on your phone to approve.`}
              </p>
              <div className="mx-auto h-2 w-56 overflow-hidden rounded-full bg-raised">
                <div className="h-full w-1/3 rounded-full bg-lime" />
              </div>
              <p className="text-xs text-muted">Waiting for approval…</p>
              {slow && (
                <p className="mx-auto max-w-xs text-sm text-warn">
                  This is taking a while. If you already approved, your credits will still arrive. You can close this and check your balance later.
                </p>
              )}
              {payment?.simulated && (
                <p className="mx-auto max-w-xs rounded-2xl border border-dashed border-line p-3 text-xs text-muted">
                  Test mode: no real money moves. The payment completes by itself after a few seconds.
                </p>
              )}
              <button onClick={onClose} className="py-2 text-sm font-semibold text-muted">
                Close and keep waiting in the background
              </button>
            </div>
          )}

          {/* 4a. success */}
          {step === "success" && (
            <div className="relative space-y-4 pt-8 text-center">
              <Confetti />
              <Mascot size={96} className="mx-auto" />
              <h3 className="font-heading text-3xl font-bold">{money(value)} added</h3>
              <p className="text-muted">
                New balance <span className="font-bold text-fg">{money(balance)}</span>
              </p>
              {balance >= RULES.minBalance ? (
                <p className="mx-auto max-w-xs text-sm text-muted">You&apos;re ready to rent. Tap Scan on the map.</p>
              ) : (
                <p className="mx-auto max-w-xs text-sm text-warn">
                  You need {RULES.minBalance} credits to rent, so you&apos;re {money(RULES.minBalance - balance)} short.
                </p>
              )}
              <button onClick={onClose} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
                Done
              </button>
            </div>
          )}

          {/* 4b. failed */}
          {step === "failed" && (
            <div className="space-y-4 pt-8 text-center">
              <Mascot size={96} mood="sleepy" className="mx-auto" />
              <h3 className="font-heading text-2xl font-bold">Payment didn&apos;t go through</h3>
              <p className="mx-auto max-w-xs text-sm text-muted">
                {error || "It was declined or timed out. You haven't been charged. Check your balance and PIN, then try again."}
              </p>
              <button onClick={() => { setError(""); setPayment(null); setRef(null); setStep(resumeRef ? "amount" : "method"); }} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
                Try again
              </button>
              <button onClick={onClose} className="w-full py-2 text-sm font-semibold text-muted">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
