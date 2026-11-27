import { ApiError, bad, json, readJson, route, str } from "./http";
import { buildAdminState } from "./admin";
import { enforce } from "./rateLimit";
import { ensureRules } from "./rulesStore";
import { requireSession } from "./session";

type Ctx = { userId: string; name: string; sessionId: string; body: () => Promise<Record<string, unknown>> };

/**
 * Wraps an admin-only endpoint: must be a signed-in admin, rate limited per person, and every answer
 * carries the dashboard's fresh state. Admin sessions already expire after 12 hours or 1 hour idle.
 */
export function adminRoute(fn: (ctx: Ctx, req: Request) => Promise<Record<string, unknown> | void>) {
  return route(async (req) => {
    const s = await requireSession(req, ["admin"]);
    await enforce(`admin-act:${s.user.id}`, 120, 60_000);
    await ensureRules();
    const extra = (await fn({ userId: s.user.id, name: s.user.name, sessionId: s.sessionId, body: () => readJson(req) }, req)) ?? {};
    return json({ ...extra, state: await buildAdminState(s.sessionId) });
  });
}

/** Dollars typed by a person -> whole cents. Null if it isn't a number with at most 2 decimals. */
export function toCents(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const c = Math.round(v * 100);
  return Math.abs(c - v * 100) < 1e-6 ? c : null;
}

/** A reason that goes in the audit log. */
export function reasonOf(v: unknown): string {
  const r = str(v, 5, 200);
  if (!r) throw bad("Give a reason (at least 5 characters).");
  return r;
}

export function idOf(v: unknown): string {
  const s = str(v, 1, 100);
  if (!s) throw bad();
  return s;
}

export { ApiError };
