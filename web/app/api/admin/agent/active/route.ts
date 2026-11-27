import { adminRoute, idOf, reasonOf } from "@/lib/server/adminApi";
import { setUserActive } from "@/lib/server/admin";
import { bad } from "@/lib/server/http";

export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  if (typeof b.active !== "boolean") throw bad();
  await setUserActive({ id: userId }, "agent", idOf(b.agentId), b.active, reasonOf(b.reason));
});
