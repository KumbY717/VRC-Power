import { adminRoute } from "@/lib/server/adminApi";
import { saveStation } from "@/lib/server/admin";
import { bad, str } from "@/lib/server/http";

// Adds a station, or changes a station's name and position. The position is checked to be inside Zimbabwe.
export const POST = adminRoute(async ({ userId, body }) => {
  const b = await body();
  const name = str(b.name, 2, 60);
  const venue = str(b.venue, 2, 80);
  const address = str(b.address ?? "", 0, 120);
  if (!name) throw bad("Give the station a name (2 to 60 characters).");
  if (!venue) throw bad("Say where it is, like the venue or mall (2 to 80 characters).");
  if (address === null) throw bad("The address is too long (120 characters at most).");
  const id = b.id === undefined || b.id === null ? undefined : str(b.id, 1, 40) ?? undefined;
  if (b.id !== undefined && b.id !== null && !id) throw bad();
  const lat = typeof b.lat === "number" ? b.lat : NaN;
  const lng = typeof b.lng === "number" ? b.lng : NaN;
  const slotCount = b.slotCount === undefined || b.slotCount === null ? undefined : typeof b.slotCount === "number" ? b.slotCount : NaN;
  const code = typeof b.code === "string" ? b.code.slice(0, 20) : undefined;
  await saveStation({ id: userId }, { id, code, name, venue, address, lat, lng, slotCount });
});
