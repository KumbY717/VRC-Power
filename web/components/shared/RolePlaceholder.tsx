"use client";

import Mascot from "@/components/shared/Mascot";
import { Role, useAuth } from "@/lib/auth";

const COPY: Record<Exclude<Role, "customer">, { title: string; items: string[] }> = {
  agent: {
    title: "Agent app",
    items: ["Float tank and shift overview", "Scan a customer QR and add cash credits", "End-of-shift cash reconciliation", "Earnings and commission"],
  },
  admin: {
    title: "Admin dashboard",
    items: ["Agents, float assignment and suspensions", "Stations, slots and remote unlock", "Customers, rentals and tracking", "Payments, pricing rules and audit log"],
  },
};

/** PLACEHOLDER until the agent and admin bundles. Proves role routing works. */
export default function RolePlaceholder({ role }: { role: Exclude<Role, "customer"> }) {
  const { session, signOut } = useAuth();
  const c = COPY[role];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-bg p-5">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-surface p-6 text-center">
        <Mascot size={80} className="mx-auto" />
        <h1 className="font-heading text-3xl font-bold">{c.title}</h1>
        <p className="text-muted">Signed in as {session?.name} ({role}). This view is built in an upcoming bundle:</p>
        <ul className="space-y-2 text-left text-sm">
          {c.items.map((i) => (
            <li key={i} className="rounded-2xl bg-raised px-4 py-3 font-semibold">{i}</li>
          ))}
        </ul>
        <button onClick={signOut} className="w-full rounded-full bg-lime py-3.5 font-bold text-ink">
          Log out
        </button>
      </div>
    </div>
  );
}
