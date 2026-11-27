import { agentRoute } from "@/lib/server/agentApi";
import { startShift } from "@/lib/server/agents";

export const POST = agentRoute(async ({ userId }) => {
  await startShift(userId);
});
