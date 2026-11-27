import { adminRoute } from "@/lib/server/adminApi";
import { bad, str } from "@/lib/server/http";
import { adminCheckPayment } from "@/lib/server/payments";

// Ask Paynow right now what happened to a payment (for one that looks stuck).
export const POST = adminRoute(async ({ userId, body }) => {
  const ref = str((await body()).ref, 4, 64);
  if (!ref) throw bad();
  await adminCheckPayment(userId, ref);
});
