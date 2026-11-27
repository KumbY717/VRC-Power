import { ApiError, json, readJson, route } from "./http";
import { enforce } from "./rateLimit";
import { ensureRules } from "./rulesStore";
import { requireSession } from "./session";
import { buildState } from "./state";

/** Development-only tools (fake payments, simulated station return, time travel). Never on in production. */
export function requireDevTools() {
  if (process.env.NODE_ENV === "production" || process.env.DEV_TOOLS !== "1") throw new ApiError(404, "not_found", "Not found.");
}

type Ctx = { userId: string; body: () => Promise<Record<string, unknown>> };

/**
 * Wraps a customer-only endpoint: must be a signed-in customer, rate limited per person,
 * and every answer includes the customer's fresh state so the screen never shows stale money.
 */
export function customerRoute(fn: (ctx: Ctx, req: Request) => Promise<Record<string, unknown> | void>) {
  return route(async (req) => {
    const s = await requireSession(req, ["customer"]);
    await enforce(`act:${s.user.id}`, 60, 60_000);
    await ensureRules();
    const extra = (await fn({ userId: s.user.id, body: () => readJson(req) }, req)) ?? {};
    return json({ ...extra, state: await buildState(s.user.id) });
  });
}
