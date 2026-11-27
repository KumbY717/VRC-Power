import { adminRoute } from "@/lib/server/adminApi";
import { createAgent } from "@/lib/server/admin";
import { bad, str } from "@/lib/server/http";
import { isZwMobile, normalizePhone } from "@/lib/validate";

// Makes an agent account with a one-time password. The password is shown once, to the admin, and never stored in readable form.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const name = str(b.name, 2, 60);
  const phoneRaw = str(b.phone, 9, 20);
  const venue = typeof b.venue === "string" ? b.venue.trim() : "";
  const event = typeof b.event === "string" ? b.event.trim() : "";
  const stations = Array.isArray(b.stationIds) ? b.stationIds : [];
  if (!name || !phoneRaw || !isZwMobile(phoneRaw) || venue.length > 80 || event.length > 80 || stations.some((s) => typeof s !== "string")) throw bad("Check the name and phone number.");
  const r = await createAgent({ id: userId }, { name, phone: normalizePhone(phoneRaw), venue, event, stationIds: stations as string[] });
  return { agentId: r.agentId, tempPassword: r.tempPassword };
});
