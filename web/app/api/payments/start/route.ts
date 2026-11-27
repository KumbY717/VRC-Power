import { customerRoute } from "@/lib/server/customerApi";
import { bad, oneOf } from "@/lib/server/http";
import { startPayment } from "@/lib/server/payments";

const METHODS = ["ecocash", "onemoney", "card"] as const;

// Begins a Paynow payment. Credits are only ever added later, when Paynow itself confirms the money arrived.
export const POST = customerRoute(async ({ userId, body }) => {
  const b = await body();
  const method = oneOf(b.method, METHODS);
  if (!method) throw bad("Choose how you want to pay.");
  const amount = typeof b.amount === "number" ? b.amount : NaN;
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || Math.abs(cents - amount * 100) > 1e-6) throw bad("Enter an amount from $1 to $200.");
  const phone = typeof b.phone === "string" ? b.phone.slice(0, 20) : null;
  const payment = await startPayment(userId, { amountCents: cents, method, phone });
  return { payment };
});
