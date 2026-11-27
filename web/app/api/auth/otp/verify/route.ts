import { auditSafe } from "@/lib/server/audit";
import { otpHash, safeEqualHex } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { ApiError, bad, clientIp, json, readJson, route, str } from "@/lib/server/http";
import { enforce } from "@/lib/server/rateLimit";
import { createSession, sessionCookie, toPublicUser } from "@/lib/server/session";

const MAX_TRIES = 5;
const MIN = 60_000;

// Step 2: check the 6-digit code. For sign-up this creates the account and signs the person in.
// For a reset it only marks the number as verified; the new password is set in /api/auth/reset.
export const POST = route(async (req) => {
  const body = await readJson(req);
  const id = str(body.challengeId, 20, 80);
  const code = str(body.code, 6, 6);
  if (!id || !code || !/^\d{6}$/.test(code)) throw bad("Enter the 6-digit code.");
  const ip = clientIp(req);
  await enforce(`otp-verify-ip:${ip}`, 40, 15 * MIN);

  const row = await db.challenge.findUnique({ where: { id } });
  const expired = new ApiError(400, "expired", "That code has expired. Ask for a new one.");
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) throw expired;
  if (row.attempts >= MAX_TRIES) throw new ApiError(429, "too_many", "Too many wrong codes. Ask for a new one.", { triesLeft: 0 });

  // Count the guess BEFORE checking it, so parallel guesses can't sneak extra tries in.
  const updated = await db.challenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  if (updated.attempts > MAX_TRIES) throw new ApiError(429, "too_many", "Too many wrong codes. Ask for a new one.", { triesLeft: 0 });
  if (!safeEqualHex(otpHash(code, id), row.codeHash)) {
    await auditSafe({ actorRole: "anonymous", action: "otp_failed", target: row.phone, detail: row.purpose, ip });
    throw new ApiError(400, "invalid_code", "That code isn't right.", { triesLeft: Math.max(0, MAX_TRIES - updated.attempts) });
  }

  if (row.purpose === "reset") {
    await db.challenge.updateMany({ where: { id, usedAt: null }, data: { verifiedAt: new Date(), expiresAt: new Date(Date.now() + 10 * MIN) } });
    return json({ ok: true });
  }

  // Sign-up. Claim the challenge first so a code can only ever create one account.
  const claim = await db.challenge.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date(), verifiedAt: new Date() } });
  if (claim.count !== 1 || !row.payload) throw expired;
  const p = JSON.parse(row.payload) as { name: string; email: string; passwordHash: string };

  const emailTaken = p.email ? await db.user.findUnique({ where: { email: p.email } }) : null;
  let user;
  try {
    user = await db.user.create({
      data: { role: "customer", name: p.name, phone: row.phone, email: emailTaken || !p.email ? null : p.email, passwordHash: p.passwordHash },
    });
  } catch {
    // most likely a unique-phone clash from a parallel request
    throw new ApiError(409, "exists", "We couldn't create that account. Try logging in.");
  }
  const { token, expiresAt } = await createSession(user.id, "customer", ip, req.headers.get("user-agent"));
  await auditSafe({ actorId: user.id, actorRole: "customer", action: "signup", target: user.phone ?? "", ip });
  return json({ session: toPublicUser(user) }, { cookies: [sessionCookie(token, expiresAt)] });
});
