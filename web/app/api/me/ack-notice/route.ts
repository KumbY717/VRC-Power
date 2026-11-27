import { db } from "@/lib/server/db";
import { customerRoute } from "@/lib/server/customerApi";

// The customer has seen the "your rental became a purchase" message.
export const POST = customerRoute(async ({ userId }) => {
  await db.rental.updateMany({ where: { userId, status: "converted", acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
});
