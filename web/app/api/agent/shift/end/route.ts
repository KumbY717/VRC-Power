import { agentRoute } from "@/lib/server/agentApi";
import { endShift } from "@/lib/server/agents";
import { bad } from "@/lib/server/http";

// Body: { counted: 85.5 } (dollars the agent counted). The server compares it with the credits handed out.
export const POST = agentRoute(async ({ userId, body }) => {
  const counted = (await body()).counted;
  if (typeof counted !== "number" || !Number.isFinite(counted)) throw bad("Enter the cash you counted.");
  const cents = Math.round(counted * 100);
  if (Math.abs(cents - counted * 100) > 1e-6) throw bad("Enter the cash you counted, for example 85.00.");
  return { report: await endShift(userId, cents) };
});
