import { Zap } from "lucide-react";
import { RULES, money } from "@/lib/mock";

/** Balance pill. The tinted fill shows progress toward the minimum rental balance. */
export default function BalanceChip({ balance }: { balance: number }) {
  const pct = Math.min(100, Math.round((balance / RULES.minBalance) * 100));
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-card"
      style={{
        backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--lime) 20%, transparent) ${pct}%, transparent ${pct}%)`,
      }}
      aria-label={`Balance ${money(balance)}`}
    >
      <Zap size={16} className="text-lime" fill="currentColor" />
      <span className="font-heading text-lg font-bold leading-none">{money(balance)}</span>
      <span className="hidden text-xs text-muted sm:inline">{balance.toFixed(2)} cr</span>
    </div>
  );
}
