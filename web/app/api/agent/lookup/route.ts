import { agentRoute } from "@/lib/server/agentApi";
import { lookupCustomer } from "@/lib/server/agents";
import { bad, str } from "@/lib/server/http";
import { enforce } from "@/lib/server/rateLimit";

// Shows the customer's first name so the agent can check they have the right person before taking cash.
export const POST = agentRoute(async ({ userId, body }) => {
  await enforce(`agent-lookup:${userId}`, 20, 60_000); // codes can't be guessed in bulk
  const code = str((await body()).code, 8, 20);
  if (!code) throw bad("Enter the customer's code.");
  return { customer: await lookupCustomer(code.toUpperCase()) };
});
