import { bad, json, route } from "@/lib/server/http";
import { paymentStatusFor } from "@/lib/server/payments";
import { enforce } from "@/lib/server/rateLimit";
import { requireSession } from "@/lib/server/session";
import { buildState } from "@/lib/server/state";

// The customer's own payment, checked with Paynow if it is still waiting. Returns fresh wallet state too.
export const GET = route(async (req) => {
  const s = await requireSession(req, ["customer"]);
  await enforce(`pay-status:${s.user.id}`, 90, 60_000);
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  if (!/^VRC-[A-Z0-9]{12}$/.test(ref)) throw bad("Payment not found.");
  const payment = await paymentStatusFor(s.user.id, ref);
  return json({ payment, state: await buildState(s.user.id) });
});
