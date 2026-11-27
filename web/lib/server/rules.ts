// Business rules, in cents. The values below are the starting point; the admin dashboard changes them
// (stored in the database, see rulesStore.ts). Everything reads RULES, which is updated in place.
export type Rules = {
  ratePerHourCents: number;
  minBalanceCents: number;
  outrightCents: number;
  overdueHours: number;
  // agent pay
  agentAllowanceCents: number; // per shift
  agentCommissionBps: number; // 500 = 5% of every cash top-up
  agentSaleBonusCents: number; // per outright sale facilitated
};

export const DEFAULT_RULES: Readonly<Rules> = {
  ratePerHourCents: 100,
  minBalanceCents: 1500,
  outrightCents: 1500,
  overdueHours: 24,
  agentAllowanceCents: 500,
  agentCommissionBps: 500,
  agentSaleBonusCents: 100,
};

export const RULES: Rules = { ...DEFAULT_RULES };

export const HOUR_MS = 3_600_000;

const int = (v: unknown) => typeof v === "number" && Number.isInteger(v);

/** Checks a full set of rules. Returns the problem in plain words, or null if it is fine. */
export function rulesProblem(r: Rules): string | null {
  const keys = Object.keys(DEFAULT_RULES) as (keyof Rules)[];
  for (const k of keys) if (!int(r[k])) return "Every value must be a number.";
  if (r.ratePerHourCents < 1 || r.ratePerHourCents > 5000) return "The hourly rate must be between $0.01 and $50.";
  if (r.minBalanceCents < 100 || r.minBalanceCents > 50_000) return "The minimum balance must be between $1 and $500.";
  if (r.outrightCents < 100 || r.outrightCents > 50_000) return "The outright price must be between $1 and $500.";
  if (r.overdueHours < 1 || r.overdueHours > 168) return "Overdue hours must be between 1 and 168.";
  if (r.agentCommissionBps < 0 || r.agentCommissionBps > 3000) return "Commission can't be above 30%.";
  if (r.agentAllowanceCents < 0 || r.agentAllowanceCents > 10_000) return "The agent allowance must be between $0 and $100.";
  if (r.agentSaleBonusCents < 0 || r.agentSaleBonusCents > 5000) return "The sale bonus must be between $0 and $50.";
  if (r.minBalanceCents < r.outrightCents) return "The minimum balance can't be lower than the outright price, or an overdue rental couldn't be covered.";
  return null;
}
