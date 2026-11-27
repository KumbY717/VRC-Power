import { adminRoute, idOf, reasonOf } from "@/lib/server/adminApi";
import { queueUnlock } from "@/lib/server/admin";
import { bad } from "@/lib/server/http";

// Queues an "open this slot" command for the station. The station server sends it to the hardware.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  if (typeof b.slot !== "number") throw bad();
  await queueUnlock({ id: userId }, idOf(b.stationId), b.slot, reasonOf(b.reason));
});
