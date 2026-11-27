import { auditSafe } from "@/lib/server/audit";
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { ApiError, bad, clientIp, json, oneOf, readJson, route, str, tooMany } from "@/lib/server/http";
import { blockedFor, clearLimit, consume, enforce } from "@/lib/server/rateLimit";
import { createSession, sessionCookie, toPublicUser } from "@/lib/server/session";
import { normalizePhone } from "@/lib/validate";

const MIN = 60_000;
const MAX_FAILS = 5;

export const POST = route(async (req) => {
  const body = await readJson(req);
  const role = oneOf(body.role, ["customer", "agent", "admin"] as const);
  const rawId = str(body.id, 3, 120);
  const password = str(body.password, 1, 128, { trim: false });
  if (!role || !rawId || password === null) throw bad("Enter your details.");

  const id = role === "admin" ? rawId.toLowerCase() : normalizePhone(rawId);
  const ip = clientIp(req);

  // 1. Limits come first, so a blocked client costs us almost nothing.
  await enforce(`login-ip:${ip}`, 30, 15 * MIN);
  const failKey = `login-fail:${role}:${id}`;
  const wait = await blockedFor(failKey, MAX_FAILS);
  if (wait) throw tooMany(wait);

  // 2. Look the account up and always do the same amount of work, whether or not it exists.
  const user = await db.user.findUnique({ where: role === "admin" ? { email: id } : { phone: id } });
  let passwordOk = false;
  if (user) passwordOk = await verifyPassword(password, user.passwordHash);
  else await verifyAgainstDummy(password);

  if (!user || !passwordOk || user.role !== role || user.status !== "active") {
    await consume(failKey, MAX_FAILS, 15 * MIN);
    await auditSafe({ actorId: user?.id ?? null, actorRole: role, action: "login_failed", target: id, ip });
    // One message for every kind of failure: never say which part was wrong.
    throw new ApiError(401, "invalid", "That phone/email or password isn't right.");
  }

  // 3. Success.
  await clearLimit(failKey);
  if (needsRehash(user.passwordHash)) await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const { token, expiresAt } = await createSession(user.id, role, ip, req.headers.get("user-agent"));
  await auditSafe({ actorId: user.id, actorRole: role, action: "login", ip });
  return json({ session: toPublicUser(user) }, { cookies: [sessionCookie(token, expiresAt)] });
});
