import { auditSafe } from "@/lib/server/audit";
import { hashPassword, makeOtp, otpHash, randomToken } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { bad, clientIp, json, readJson, route, str } from "@/lib/server/http";
import { passwordProblem } from "@/lib/server/policy";
import { enforce } from "@/lib/server/rateLimit";
import { sendSms, smsConsoleMode } from "@/lib/server/sms";
import { isEmail, isZwMobile, normalizePhone } from "@/lib/validate";

const HOUR = 3_600_000;

// Step 1 of signing up: check the details, then text a code. The account is only created after the code is confirmed.
export const POST = route(async (req) => {
  const body = await readJson(req);
  const name = str(body.name, 2, 60);
  const phoneRaw = str(body.phone, 9, 20);
  const emailRaw = body.email === undefined || body.email === "" ? "" : str(body.email, 3, 120);
  const password = str(body.password, 1, 200, { trim: false });
  if (!name || !phoneRaw || !isZwMobile(phoneRaw) || emailRaw === null || (emailRaw && !isEmail(emailRaw)) || password === null) throw bad();
  const phone = normalizePhone(phoneRaw);
  const problem = passwordProblem(password, phone);
  if (problem) throw bad(problem);

  const ip = clientIp(req);
  // SMS costs money and can be abused, so sends are limited per address and per phone number.
  await enforce(`sms-ip:${ip}`, 10, HOUR);
  await enforce(`sms-phone:${phone}`, 5, HOUR);

  // Same work and same response whether or not the number already has an account, so this
  // can't be used to find out who is registered. The owner is told by SMS instead.
  const exists = await db.user.findUnique({ where: { phone } });
  const passwordHash = await hashPassword(password);
  const code = makeOtp();
  const challengeId = randomToken(24);
  await db.challenge.create({
    data: {
      id: challengeId,
      purpose: "signup",
      phone,
      codeHash: otpHash(code, challengeId),
      payload: JSON.stringify({ name, email: emailRaw.toLowerCase(), passwordHash }),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  if (exists) {
    await sendSms(phone, "VRC Power: a sign-up was started with this number, but it already has an account. Log in, or use Forgot password.");
    await auditSafe({ actorId: exists.id, actorRole: "anonymous", action: "signup_existing_number", target: phone, ip });
  } else {
    await sendSms(phone, `Your VRC Power code is ${code}. It expires in 10 minutes. Never share it with anyone.`);
  }
  return json({ challengeId, devCode: smsConsoleMode() && !exists ? code : undefined });
});
