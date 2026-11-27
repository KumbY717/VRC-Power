import { audit } from "./audit";
import { db } from "./db";
import { ApiError } from "./http";
import type { Rules } from "./rules";
import { DEFAULT_RULES, RULES, rulesProblem } from "./rules";

const TTL_MS = 5_000;
let loadedAt = 0;

/** The rules as stored, merged over the defaults. A damaged or invalid stored value is ignored. */
function parse(value: string | null | undefined): Rules {
  if (!value) return { ...DEFAULT_RULES };
  try {
    const raw = JSON.parse(value) as Partial<Rules>;
    const merged = { ...DEFAULT_RULES, ...raw } as Rules;
    return rulesProblem(merged) ? { ...DEFAULT_RULES } : merged;
  } catch {
    return { ...DEFAULT_RULES };
  }
}

/**
 * Brings RULES up to date with the database. Cheap: reads at most once every few seconds per server,
 * so a change made in the dashboard reaches every server within seconds.
 */
export async function ensureRules(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - loadedAt < TTL_MS) return;
  const row = await db.setting.findUnique({ where: { key: "rules" } });
  Object.assign(RULES, parse(row?.value));
  loadedAt = now;
}

/** For tests: forget the cache so the next ensureRules() reads the database. */
export function forgetRulesCache() {
  loadedAt = 0;
}

const LABELS: Record<keyof Rules, string> = {
  ratePerHourCents: "rate per hour",
  minBalanceCents: "minimum balance",
  outrightCents: "outright price",
  overdueHours: "overdue hours",
  agentAllowanceCents: "agent allowance",
  agentCommissionBps: "agent commission",
  agentSaleBonusCents: "agent sale bonus",
};
const show = (k: keyof Rules, v: number) =>
  k === "overdueHours" ? `${v}h` : k === "agentCommissionBps" ? `${v / 100}%` : `$${(v / 100).toFixed(2)}`;

/** Saves new rules. Applies to rentals started from now on; rentals already out keep the terms they started with. */
export async function saveRules(next: Rules, actor: { id: string }): Promise<void> {
  const problem = rulesProblem(next);
  if (problem) throw new ApiError(400, "bad_request", problem);
  await ensureRules(true);
  const changes = (Object.keys(DEFAULT_RULES) as (keyof Rules)[]).filter((k) => next[k] !== RULES[k]);
  if (!changes.length) throw new ApiError(400, "bad_request", "Nothing changed.");
  const detail = changes.map((k) => `${LABELS[k]}: ${show(k, RULES[k])} → ${show(k, next[k])}`).join(", ");
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key: "rules" }, create: { key: "rules", value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
    await audit({ actorId: actor.id, actorRole: "admin", action: "rules_changed", target: "Rules", detail }, tx);
  });
  Object.assign(RULES, next);
  loadedAt = Date.now();
}
