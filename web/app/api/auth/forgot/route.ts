import { auditSafe } from "@/lib/server/audit";
import { makeOtp, otpHash, randomToken } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { bad, clientIp, json, readJson, route, str } from "@/lib/server/http";
import { enforce } from "@/lib/server/rateLimit";
import { sendSms, smsConsoleMode } from "@/lib/server/sms";
import { isZwMobile, normalizePhone } from "@/lib/validate";

const HOUR = 3_600_000;

// Step 1 of resetting a password. Always answers the same way, whether or not the number has an account.
export const POST = route(async (req) => {
  const body = await readJson(req);
  const phoneRaw = str(body.phone, 9, 20);
  if (!phoneRaw || !isZwMobile(phoneRaw)) throw bad("Enter a Zimbabwe mobile number.");
  const phone = normalizePhone(phoneRaw);
  const ip = clientIp(req);
  await enforce(`sms-ip:${ip}`, 10, HOUR);
  await enforce(`sms-phone:${phone}`, 5, HOUR);

  const user = await db.user.findUnique({ where: { phone } });
  const eligible = !!user && user.status === "active" && user.role !== "admin";
  const code = makeOtp();
  const challengeId = randomToken(24);
  // A challenge row is stored even when there is no account, so every later step behaves identically.
  await db.challenge.create({
    data: { id: challengeId, purpose: "reset", phone, codeHash: otpHash(code, challengeId), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  if (eligible) {
    await sendSms(phone, `Your VRC Power password reset code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this message.`);
    await auditSafe({ actorId: user.id, actorRole: user.role, action: "reset_requested", ip });
  }
  return json({ challengeId, devCode: smsConsoleMode() && eligible ? code : undefined });
});
