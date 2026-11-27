/** Vertical tank showing how much float (digital credits) the agent has left. */
export default function FloatTank({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const tone = pct < 10 ? "var(--bad)" : pct < 25 ? "var(--warn)" : "var(--lime)";
  return (
    <div
      role="meter"
      aria-label="Float remaining"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={remaining}
      className="relative h-44 w-24 shrink-0 overflow-hidden rounded-3xl border-4 border-fg/70 bg-raised"
    >
      <div className="absolute inset-x-0 bottom-0 transition-[height] duration-500" style={{ height: `${pct}%`, background: tone }}>
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute -top-2 h-2.5 w-full" aria-hidden="true">
          <path d="M0 10 Q12.5 0 25 5 T50 5 T75 5 T100 5 V10 Z" fill={tone} />
        </svg>
      </div>
      {/* tick marks */}
      {[25, 50, 75].map((t) => (
        <span key={t} className="absolute right-0 h-0.5 w-3 bg-fg/60" style={{ bottom: `${t}%` }} />
      ))}
    </div>
  );
}
