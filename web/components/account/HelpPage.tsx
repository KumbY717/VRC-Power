"use client";

import { useState } from "react";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import SubPage from "@/components/shared/SubPage";
import { cn } from "@/lib/cn";
import { RULES } from "@/lib/mock";

const FAQ: [string, string][] = [
  [
    "How does renting work?",
    `Scan the QR sticker on a station and a power bank pops out. It costs $${RULES.ratePerHour} per hour. Return it to any VRC station and billing stops.`,
  ],
  [
    "Why do I need 15 credits?",
    `Your balance is a security hold. You need at least ${RULES.minBalance} credits to rent, and the hours you use are deducted when you return the power bank.`,
  ],
  [
    "What if I don't return it?",
    `After ${RULES.overdueHours} hours the rental becomes a purchase and ${RULES.outrightPrice} credits are used to cover the power bank.`,
  ],
  [
    "Can I get a refund?",
    "Unused credits from cash or mobile money top-ups can be refunded to where they came from. Promo credits are non-refundable and can only be used on VRC services. Credits can't be sent to other people.",
  ],
  [
    "I only have cash.",
    "Find a VRC agent at the event. Give them cash, show your QR code from Account, and your credits arrive straight away.",
  ],
  [
    "Can I just buy one?",
    `Yes. Choose Buy outright for a flat $${RULES.outrightPrice}. The slot opens and the power bank is yours.`,
  ],
];

export default function HelpPage({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <SubPage title="Help and support" onBack={onBack}>
      <div className="space-y-2">
        {FAQ.map(([q, a], i) => (
          <div key={q} className="rounded-3xl border border-line bg-surface">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center justify-between gap-3 p-4 text-left font-bold"
            >
              {q}
              <ChevronDown size={20} className={cn("shrink-0 transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="px-4 pb-4 text-sm text-muted">{a}</p>}
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Still stuck?</h3>
        {/* placeholder contact details: replace before launch */}
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-raised"><MessageCircle size={20} /></span>
          <div className="leading-tight">
            <p className="font-bold">WhatsApp support</p>
            <p className="text-sm text-muted">+263 77 000 0000 (placeholder)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-raised"><Mail size={20} /></span>
          <div className="leading-tight">
            <p className="font-bold">Email</p>
            <p className="text-sm text-muted">support@example.com (placeholder)</p>
          </div>
        </div>
      </section>
    </SubPage>
  );
}
