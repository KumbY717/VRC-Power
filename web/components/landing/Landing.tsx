"use client";

import { useState } from "react";
import { ChevronDown, MapPin, QrCode, ShieldCheck, Timer, Zap } from "lucide-react";
import Logo from "@/components/shared/Logo";
import Mascot from "@/components/shared/Mascot";
import { cn } from "@/lib/cn";
import { RULES } from "@/lib/mock";

function PowerBankArt() {
  return (
    <svg viewBox="0 0 320 360" className="w-full max-w-xs" aria-hidden="true">
      {/* soft shapes */}
      <circle cx="160" cy="190" r="140" fill="var(--raised)" />
      <circle cx="268" cy="62" r="22" fill="var(--violet)" />
      <circle cx="46" cy="300" r="14" fill="var(--sky)" />
      <path d="M44 70 L30 96 H44 L38 122 L62 88 H48 Z" fill="var(--sun)" />
      {/* sticker shadow */}
      <rect x="96" y="58" width="150" height="250" rx="34" fill="var(--bg)" opacity="0.9" transform="translate(10 12)" />
      {/* body */}
      <rect x="96" y="58" width="150" height="250" rx="34" fill="var(--lime)" stroke="var(--ink)" strokeWidth="5" />
      <rect x="122" y="84" width="98" height="22" rx="11" fill="var(--ink)" />
      <circle cx="136" cy="95" r="4" fill="var(--lime)" />
      <circle cx="152" cy="95" r="4" fill="var(--lime)" />
      <circle cx="168" cy="95" r="4" fill="var(--lime)" />
      <circle cx="184" cy="95" r="4" fill="var(--ink)" stroke="var(--lime)" strokeWidth="1.5" />
      <path d="M176 140 L134 214 H164 L154 262 L206 188 H176 Z" fill="var(--ink)" />
      <rect x="140" y="288" width="62" height="10" rx="5" fill="var(--ink)" opacity="0.85" />
    </svg>
  );
}

const STEPS = [
  { icon: QrCode, title: "Scan", text: "Scan the QR sticker on any VRC station with your phone." },
  { icon: Zap, title: "Unlock", text: "A fully charged power bank pops out of its slot." },
  { icon: MapPin, title: "Return", text: "Plug it into any free slot, at any station. Billing stops." },
];

const FAQ: [string, string][] = [
  ["Why do I need 15 credits to rent?", `It's a security hold. You need at least ${RULES.minBalance} credits in your wallet, and the hours you use are deducted when you return the power bank.`],
  ["What if I don't return it?", `After ${RULES.overdueHours} hours the rental becomes a purchase and ${RULES.outrightPrice} credits are used to cover the power bank.`],
  ["I only have cash. Can I still use it?", "Yes. At events a VRC agent takes your cash and adds credits to your account on the spot."],
  ["Can I just buy one?", `Yes. Buy outright for a flat $${RULES.outrightPrice}. The slot opens and the power bank is yours.`],
];

export default function Landing({
  onLogin,
  onSignup,
  onApply,
}: {
  onLogin: () => void;
  onSignup: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex" aria-label="Sections">
            <a href="#how" className="text-muted hover:text-fg">How it works</a>
            <a href="#pricing" className="text-muted hover:text-fg">Pricing</a>
            <a href="#faq" className="text-muted hover:text-fg">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={onLogin} className="rounded-full px-4 py-2.5 text-sm font-bold hover:bg-raised">Log in</button>
            <button onClick={onSignup} className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink hover:brightness-105">Get started</button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-10 md:grid-cols-2 md:pt-16">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-lime" /> Portable power, on your terms
          </p>
          <h1 className="font-heading text-5xl font-extrabold leading-[1.02] sm:text-6xl md:text-7xl">
            Keep your day <span className="text-lime">moving.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Grab a fully charged power bank at a VRC station, power up wherever life takes you, then drop it at any station.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={onSignup} className="rounded-full bg-lime px-7 py-4 text-base font-bold text-ink hover:brightness-105">
              Find a power bank
            </button>
            <button onClick={onApply} className="rounded-full border-2 border-line bg-surface px-7 py-4 text-base font-bold hover:border-lime">
              Become an agent
            </button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
            <li className="flex items-center gap-2"><MapPin size={18} className="text-lime" /> Stations across Zimbabwe</li>
            <li className="flex items-center gap-2"><ShieldCheck size={18} className="text-lime" /> Return at any station</li>
            <li className="flex items-center gap-2"><Timer size={18} className="text-lime" /> ${RULES.ratePerHour} per hour</li>
          </ul>
        </div>
        <div className="relative mx-auto flex w-full max-w-sm justify-center">
          <PowerBankArt />
          <Mascot size={96} className="absolute -bottom-2 -left-2 sm:left-0" />
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-y border-line bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">Three simple steps</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="rounded-3xl border border-line bg-bg p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-ink"><Icon size={24} /></span>
                  <span className="font-heading text-3xl font-bold text-muted">0{i + 1}</span>
                </div>
                <h3 className="font-heading text-2xl font-bold">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-heading text-3xl font-bold md:text-4xl">Simple pricing</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border-2 border-lime bg-surface p-7">
            <p className="text-sm font-bold uppercase tracking-wider text-lime">Rent</p>
            <p className="mt-2 font-heading text-5xl font-bold">${RULES.ratePerHour}<span className="text-2xl text-muted"> / hour</span></p>
            <ul className="mt-5 space-y-2 text-muted">
              <li>Keep {RULES.minBalance} VRC Credits in your wallet to rent</li>
              <li>Pay only for the hours you use</li>
              <li>Return to any station within {RULES.overdueHours} hours</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-7">
            <p className="text-sm font-bold uppercase tracking-wider text-muted">Buy outright</p>
            <p className="mt-2 font-heading text-5xl font-bold">${RULES.outrightPrice}<span className="text-2xl text-muted"> flat</span></p>
            <ul className="mt-5 space-y-2 text-muted">
              <li>The power bank is yours to keep</li>
              <li>Pay with credits or cash with an agent</li>
              <li>No wallet balance or returns needed</li>
            </ul>
          </div>
        </div>
      </section>

      {/* agents */}
      <section className="border-y border-line bg-surface py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-heading text-3xl font-bold">Only have cash?</h2>
            <p className="mt-2 max-w-xl text-muted">
              Find a VRC agent at the event. Hand over cash, show your QR code, and your credits arrive instantly.
            </p>
          </div>
          <button onClick={onApply} className="rounded-full border-2 border-line bg-bg px-7 py-4 font-bold hover:border-lime">
            Work as an agent
          </button>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="font-heading text-3xl font-bold md:text-4xl">Questions</h2>
        <div className="mt-6 space-y-2">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="rounded-3xl border border-line bg-surface">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="flex w-full items-center justify-between gap-3 p-5 text-left font-bold"
              >
                {q}
                <ChevronDown size={20} className={cn("shrink-0 transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i && <p className="px-5 pb-5 text-muted">{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-4 py-8 text-center text-sm text-muted">
        <div className="mb-3 flex justify-center"><Logo /></div>
        <p>VRC Power · Zimbabwe</p>
        <p className="mt-1 text-xs">Credits are non-transferable store credit for VRC Power services.</p>
      </footer>
    </div>
  );
}
