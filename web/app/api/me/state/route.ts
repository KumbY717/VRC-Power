import { db } from "@/lib/server/db";
import { customerRoute } from "@/lib/server/customerApi";
import { settlePending } from "@/lib/server/payments";
import { sweepUser } from "@/lib/server/rentals";

// The customer's whole picture: balance, rental, history, station availability.
// Also settles any payment still waiting on Paynow, and applies the 24-hour rule if their rental has run out.
export const GET = customerRoute(async ({ userId }) => {
  await settlePending(userId);
  await db.$transaction((tx) => sweepUser(tx, userId));
});
