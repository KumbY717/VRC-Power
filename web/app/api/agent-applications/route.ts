import { db } from "@/lib/server/db";
import { bad, clientIp, json, readJson, route, str } from "@/lib/server/http";
import { enforce } from "@/lib/server/rateLimit";
import { isZwMobile, normalizePhone } from "@/lib/validate";

// Public form: someone who wants to become an agent. Our team follows up; no account is created here.
export const POST = route(async (req) => {
  const body = await readJson(req);
  const name = str(body.name, 2, 60);
  const phoneRaw = str(body.phone, 9, 20);
  const area = str(body.area, 2, 120);
  const note = body.note === undefined || body.note === "" ? "" : str(body.note, 0, 500);
  if (!name || !phoneRaw || !isZwMobile(phoneRaw) || !area || note === null) throw bad();
  const ip = clientIp(req);
  await enforce(`apply-ip:${ip}`, 5, 24 * 3_600_000);
  await db.agentApplication.create({ data: { name, phone: normalizePhone(phoneRaw), area, note, ip } });
  return json({ ok: true });
});
