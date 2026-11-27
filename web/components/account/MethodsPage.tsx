"use client";

import { useState } from "react";
import { Banknote, CreditCard, Smartphone, Trash2 } from "lucide-react";
import SubPage from "@/components/shared/SubPage";
import { MethodType, useAccount } from "@/lib/account";
import { cn } from "@/lib/cn";
import { isEcocash, isOnemoney, maskNumber } from "@/lib/validate";

const NAME: Record<MethodType, string> = { ecocash: "EcoCash", onemoney: "OneMoney" };

export default function MethodsPage({
  onBack,
  onShowQr,
  onToast,
}: {
  onBack: () => void;
  onShowQr: () => void;
  onToast: (m: string) => void;
}) {
  const { methods, defaultMethodId, addMethod, removeMethod, setDefaultMethod } = useAccount();
  const [type, setType] = useState<MethodType>("ecocash");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function add() {
    const ok = type === "ecocash" ? isEcocash(number) : isOnemoney(number);
    if (!ok) return setError(type === "ecocash" ? "EcoCash numbers start with 077 or 078." : "OneMoney numbers start with 071.");
    const clean = number.replace(/[\s-]/g, "");
    if (methods.some((m) => m.type === type && m.number === clean)) return setError("That number is already saved.");
    addMethod(type, number);
    setNumber("");
    setError("");
    onToast(`${NAME[type]} number saved`);
  }

  return (
    <SubPage title="Payment methods" onBack={onBack}>
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Saved mobile money</h3>
        {methods.length === 0 && (
          <p className="rounded-3xl border border-dashed border-line p-4 text-sm text-muted">
            No saved numbers yet. Add one below to top up faster.
          </p>
        )}
        {methods.map((m) => (
          <div key={m.id} className="rounded-3xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-raised"><Smartphone size={20} /></span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-bold">{NAME[m.type]}</p>
                <p className="text-sm text-muted">{maskNumber(m.number)}</p>
              </div>
              {defaultMethodId === m.id ? (
                <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">Default</span>
              ) : (
                <button onClick={() => setDefaultMethod(m.id)} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold">
                  Make default
                </button>
              )}
              <button
                onClick={() => setConfirmId(confirmId === m.id ? null : m.id)}
                aria-label={`Remove ${NAME[m.type]} number`}
                className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-bad"
              >
                <Trash2 size={18} />
              </button>
            </div>
            {confirmId === m.id && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-raised p-3 text-sm">
                <span>Remove this number?</span>
                <span className="flex gap-2">
                  <button onClick={() => setConfirmId(null)} className="rounded-full border border-line px-3 py-1.5 font-bold">Keep</button>
                  <button
                    onClick={() => {
                      removeMethod(m.id);
                      setConfirmId(null);
                      onToast("Number removed");
                    }}
                    className="rounded-full bg-bad px-3 py-1.5 font-bold text-ink"
                  >
                    Remove
                  </button>
                </span>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-3xl border border-line bg-surface p-4">
        <h3 className="font-heading text-lg font-bold">Add a number</h3>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-raised p-1 text-sm font-bold">
          {(["ecocash", "onemoney"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setError(""); }}
              aria-pressed={type === t}
              className={cn("rounded-full py-2.5", type === t ? "bg-lime text-ink" : "text-muted")}
            >
              {NAME[t]}
            </button>
          ))}
        </div>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="tel"
          placeholder={type === "ecocash" ? "077 123 4567" : "071 123 4567"}
          aria-label={`${NAME[type]} number`}
          className="w-full rounded-2xl border border-line bg-raised px-4 py-3 text-base outline-none focus:border-lime"
        />
        {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
        <button onClick={add} className="w-full rounded-full bg-lime py-3.5 font-bold text-ink">
          Save number
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Other ways to pay</h3>
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-raised"><CreditCard size={20} /></span>
          <div className="leading-tight">
            <p className="font-bold">Visa / Mastercard</p>
            <p className="text-sm text-muted">Entered on Paynow&apos;s secure page each time. We never store card details.</p>
          </div>
        </div>
        <button onClick={onShowQr} className="flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-raised"><Banknote size={20} /></span>
          <span className="leading-tight">
            <span className="block font-bold">Cash with an agent</span>
            <span className="block text-sm text-muted">Show your QR code to a VRC agent</span>
          </span>
        </button>
      </section>

      <p className="rounded-2xl bg-raised p-4 text-xs text-muted">
        Online payments are processed by Paynow Zimbabwe. VRC Power never sees or stores your PIN.
      </p>
    </SubPage>
  );
}
