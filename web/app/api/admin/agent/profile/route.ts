import { adminRoute, idOf } from "@/lib/server/adminApi";
import { updateAgentProfile } from "@/lib/server/admin";
import { bad } from "@/lib/server/http";

export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const venue = typeof b.venue === "string" ? b.venue.trim() : null;
  const event = typeof b.event === "string" ? b.event.trim() : null;
  const stations = Array.isArray(b.stationIds) ? b.stationIds : null;
  if (venue === null || event === null || !stations || venue.length > 80 || event.length > 80 || stations.some((s) => typeof s !== "string")) throw bad();
  await updateAgentProfile({ id: userId }, idOf(b.agentId), { venue, event, stationIds: stations as string[] });
});
