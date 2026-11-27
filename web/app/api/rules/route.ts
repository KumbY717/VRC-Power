import { RULES } from "@/lib/server/rules";
import { ensureRules } from "@/lib/server/rulesStore";
import { json, route } from "@/lib/server/http";

// Public: the prices the app shows (also used on the landing page before anyone logs in). Nothing private here.
export const GET = route(async (req) => {
  req.headers.get("host"); // reading the request makes Next treat this as a live endpoint, not something built once
  await ensureRules();
  return json({
    rules: {
      ratePerHour: RULES.ratePerHourCents / 100,
      minBalance: RULES.minBalanceCents / 100,
      outrightPrice: RULES.outrightCents / 100,
      overdueHours: RULES.overdueHours,
    },
  });
});
