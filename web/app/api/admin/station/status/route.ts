import { adminRoute, idOf, reasonOf } from "@/lib/server/adminApi";
import { setStationStatus } from "@/lib/server/admin";
import { bad, oneOf } from "@/lib/server/http";

// Takes a station out of service (customers can't rent from or return to it) or puts it back.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const status = oneOf(b.status, ["online", "offline"] as const);
  if (!status) throw bad();
  await setStationStatus({ id: userId }, idOf(b.stationId), status, reasonOf(b.reason));
});
