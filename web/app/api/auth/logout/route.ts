import { auditSafe } from "@/lib/server/audit";
import { clientIp, json, route } from "@/lib/server/http";
import { clearedCookie, destroySession, getSession } from "@/lib/server/session";

export const POST = route(async (req) => {
  const s = await getSession(req);
  await destroySession(req);
  if (s) await auditSafe({ actorId: s.user.id, actorRole: s.user.role, action: "logout", ip: clientIp(req) });
  return json({ ok: true }, { cookies: [clearedCookie()] });
});
