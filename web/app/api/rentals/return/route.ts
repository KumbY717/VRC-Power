import { customerRoute, requireDevTools } from "@/lib/server/customerApi";
import { bad, str } from "@/lib/server/http";
import { returnBank } from "@/lib/server/rentals";

// SIMULATION. In real life the station reports the returned power bank and the server closes the rental
// by itself. This lets the app's Return button pretend that, while no hardware is connected.
export const POST = customerRoute(async ({ userId, body }) => {
  requireDevTools();
  const stationId = str((await body()).stationId, 1, 40);
  if (!stationId) throw bad("Choose a station.");
  return { receipt: await returnBank(userId, stationId) };
});
