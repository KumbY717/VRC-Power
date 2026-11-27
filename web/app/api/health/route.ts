import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

// Used by uptime checks. Confirms the server can reach the database.
// Reading the request makes Next treat this as a live endpoint, not something to build once.
export const GET = route(async (req) => {
  req.headers.get("host");
  await db.rateLimit.count();
  return json({ ok: true });
});
