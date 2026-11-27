import { adminRoute, idOf, toCents } from "@/lib/server/adminApi";
import { recordPayout } from "@/lib/server/admin";
import { bad } from "@/lib/server/http";

// Records that the agent has been paid (outside the app, e.g. EcoCash). Cannot be more than what they have earned and not yet been paid.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const cents = toCents(b.amount);
  if (cents === null || cents < 1) throw bad("Enter an amount, for example 25.50.");
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 100) : "";
  await recordPayout({ id: userId }, idOf(b.agentId), cents, note);
});
