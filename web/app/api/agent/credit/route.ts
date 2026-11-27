import { agentRoute } from "@/lib/server/agentApi";
import { giveCredits } from "@/lib/server/agents";
import { bad, oneOf, str } from "@/lib/server/http";

// Body: { code, kind: "topup" | "sale", amount (dollars, topup only), ref }
// `ref` is a random value the phone makes for each attempt; retrying with the same ref can never credit twice.
export const POST = agentRoute(async ({ userId, body }) => {
  const b = await body();
  const code = str(b.code, 8, 20)?.toUpperCase();
  const kind = oneOf(b.kind, ["topup", "sale"] as const);
  const ref = str(b.ref, 8, 64);
  if (!code || !kind || !ref) throw bad();
  let amountCents = 0;
  if (kind === "topup") {
    const amount = b.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount)) throw bad("Enter an amount from $1 to $200.");
    amountCents = Math.round(amount * 100);
    if (Math.abs(amountCents - amount * 100) > 1e-6) throw bad("Enter an amount from $1 to $200.");
  }
  return { entry: await giveCredits(userId, { code, kind, amountCents, ref }) };
});
