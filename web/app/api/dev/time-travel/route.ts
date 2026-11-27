import { customerRoute, requireDevTools } from "@/lib/server/customerApi";
import { bad } from "@/lib/server/http";
import { timeTravel } from "@/lib/server/rentals";

// SIMULATION for development: makes the current rental look `hours` older.
export const POST = customerRoute(async ({ userId, body }) => {
  requireDevTools();
  const hours = (await body()).hours;
  if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 48) throw bad();
  await timeTravel(userId, hours);
});
