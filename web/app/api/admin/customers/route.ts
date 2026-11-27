import { searchCustomers } from "@/lib/server/admin";
import { bad, json, route } from "@/lib/server/http";
import { enforce } from "@/lib/server/rateLimit";
import { requireSession } from "@/lib/server/session";

// GET /api/admin/customers?q=tendai  → up to 50 matches by name, phone or code.
export const GET = route(async (req) => {
  const s = await requireSession(req, ["admin"]);
  await enforce(`admin-search:${s.user.id}`, 60, 60_000);
  const q = new URL(req.url).searchParams.get("q");
  if (q === null) throw bad();
  return json({ customers: await searchCustomers(q) });
});
