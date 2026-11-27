import { adminRoute, idOf, reasonOf, toCents } from "@/lib/server/adminApi";
import { adjustFloat } from "@/lib/server/admin";
import { bad, oneOf } from "@/lib/server/http";

// Body: { agentId, amount (credits), mode: "add" | "take", note }. Taking credits back needs a reason.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const mode = oneOf(b.mode, ["add", "take"] as const);
  const cents = toCents(b.amount);
  if (!mode || cents === null || cents < 100 || cents > 50_000) throw bad("Enter an amount from 1 to 500.");
  const note = mode === "take" ? reasonOf(b.note) : typeof b.note === "string" ? b.note.trim().slice(0, 200) : "";
  await adjustFloat({ id: userId }, idOf(b.agentId), mode === "add" ? cents : -cents, note);
});
