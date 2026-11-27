import { auditSafe } from "@/lib/server/audit";
import { hashPassword } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { ApiError, bad, clientIp, json, readJson, route, str } from "@/lib/server/http";
import { passwordProblem } from "@/lib/server/policy";
import { clearLimit, enforce } from "@/lib/server/rateLimit";
import { sendSms } from "@/lib/server/sms";

const MIN = 60_000;

// Step 3 of a reset: the number was verified by SMS code, now set the new password.
export const POST = route(async (req) => {
  const body = await readJson(req);
  const id = str(body.challengeId, 20, 80);
  const password = str(body.password, 1, 200, { trim: false });
  if (!id || password === null) throw bad();
  const ip = clientIp(req);
  await enforce(`reset-ip:${ip}`, 20, 15 * MIN);

  const row = await db.challenge.findUnique({ where: { id } });
  const stale = new ApiError(400, "expired", "That reset has expired. Start again.");
  if (!row || row.purpose !== "reset" || !row.verifiedAt || row.usedAt || row.expiresAt.getTime() <= Date.now()) throw stale;
  const problem = passwordProblem(password, row.phone);
  if (problem) throw bad(problem);

  // One use only.
  const claim = await db.challenge.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
  if (claim.count !== 1) throw stale;

  const user = await db.user.findUnique({ where: { phone: row.phone } });
  if (!user || user.status !== "active" || user.role === "admin") throw stale;

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  await db.session.deleteMany({ where: { userId: user.id } }); // sign out everywhere
  await clearLimit(`login-fail:${user.role}:${row.phone}`);
  await auditSafe({ actorId: user.id, actorRole: user.role, action: "password_reset", ip });
  try {
    await sendSms(row.phone, "VRC Power: your password was just changed. If this wasn't you, contact support now.");
  } catch (e) {
    console.error("[sms] notice failed", e);
  }
  return json({ ok: true });
});
