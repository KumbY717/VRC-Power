import { ApiError, clientIp, json, route } from "@/lib/server/http";
import { handlePaynowResult } from "@/lib/server/payments";
import { enforce } from "@/lib/server/rateLimit";

// Paynow's server calls this when a payment changes. There is no login or CSRF token here: instead the message's
// hash is checked, and then we ask Paynow directly what happened before anything is credited.
export const POST = route(
  async (req) => {
    await enforce(`paynow-result:${clientIp(req)}`, 600, 60_000);
    const text = await req.text();
    if (text.length > 10_000) throw new ApiError(413, "too_large", "Too large.");
    await handlePaynowResult(text);
    return json({ ok: true });
  },
  { csrf: false },
);
