import { adminRoute, idOf, reasonOf, toCents } from "@/lib/server/adminApi";
import { adjustCustomer } from "@/lib/server/admin";
import { bad, oneOf } from "@/lib/server/http";

// Body: { customerId, kind: "promo" | "refund" | "deduct", amount (dollars), reason }
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const kind = oneOf(b.kind, ["promo", "refund", "deduct"] as const);
  const cents = toCents(b.amount);
  if (!kind || cents === null || cents < 1 || cents > 50_000) throw bad("Enter an amount from 0.01 to 500.");
  await adjustCustomer({ id: userId }, idOf(b.customerId), kind, cents, reasonOf(b.reason));
});
