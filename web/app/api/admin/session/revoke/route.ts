import { adminRoute, idOf } from "@/lib/server/adminApi";
import { revokeSession } from "@/lib/server/admin";

export const POST = adminRoute(async ({ userId, sessionId, body }) => {
  await revokeSession({ id: userId }, sessionId, idOf((await body()).id));
});
