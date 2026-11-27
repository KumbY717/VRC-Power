import { customerRoute } from "@/lib/server/customerApi";
import { bad, str } from "@/lib/server/http";
import { buyOutright } from "@/lib/server/rentals";

export const POST = customerRoute(async ({ userId, body }) => {
  const stationId = str((await body()).stationId, 1, 40);
  if (!stationId) throw bad("Choose a station.");
  return buyOutright(userId, stationId);
});
