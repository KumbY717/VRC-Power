import { adminRoute, idOf } from "@/lib/server/adminApi";
import { adminConvertRental } from "@/lib/server/admin";

export const POST = adminRoute(async ({ userId, body }) => {
  await adminConvertRental({ id: userId }, idOf((await body()).code));
});
