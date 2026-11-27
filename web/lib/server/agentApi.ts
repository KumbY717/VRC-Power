import { json, readJson, route } from "./http";
import { buildAgentState } from "./agents";
import { enforce } from "./rateLimit";
import { ensureRules } from "./rulesStore";
import { requireSession } from "./session";

type Ctx = { userId: string; name: string; body: () => Promise<Record<string, unknown>> };

/**
 * Wraps an agent-only endpoint: must be a signed-in, active agent, rate limited per person,
 * and every answer carries the agent's fresh state (float, shift, entries).
 */
export function agentRoute(fn: (ctx: Ctx, req: Request) => Promise<Record<string, unknown> | void>) {
  return route(async (req) => {
    const s = await requireSession(req, ["agent"]);
    await enforce(`agent-act:${s.user.id}`, 60, 60_000);
    await ensureRules();
    const extra = (await fn({ userId: s.user.id, name: s.user.name, body: () => readJson(req) }, req)) ?? {};
    return json({ ...extra, state: await buildAgentState(s.user.id, s.user.name) });
  });
}
