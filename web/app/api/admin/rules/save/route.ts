import { adminRoute, toCents } from "@/lib/server/adminApi";
import { bad } from "@/lib/server/http";
import type { Rules } from "@/lib/server/rules";
import { saveRules } from "@/lib/server/rulesStore";

// Body in dollars / hours / percent, as the dashboard shows them. Checked again here: the browser is never trusted.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const c = (v: unknown) => {
    const x = toCents(v);
    if (x === null) throw bad("Dollar amounts can have at most 2 decimals.");
    return x;
  };
  const pct = b.commissionPct;
  if (typeof pct !== "number" || !Number.isFinite(pct) || Math.abs(Math.round(pct * 100) - pct * 100) > 1e-6) throw bad("Commission can have at most 2 decimals.");
  const next: Rules = {
    ratePerHourCents: c(b.ratePerHour),
    minBalanceCents: c(b.minBalance),
    outrightCents: c(b.outrightPrice),
    overdueHours: typeof b.overdueHours === "number" ? b.overdueHours : NaN,
    agentAllowanceCents: c(b.baseAllowance),
    agentCommissionBps: Math.round(pct * 100),
    agentSaleBonusCents: c(b.saleBonus),
  };
  await saveRules(next, { id: userId });
});
