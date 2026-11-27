import type { StationInventory } from "@/lib/appTypes";
import { db } from "./db";

/** Every station (or just the given ones) with where it is and what is in it right now. */
export async function buildInventory(onlyIds?: string[]): Promise<StationInventory[]> {
  const [stations, banks] = await Promise.all([
    db.station.findMany({ orderBy: { id: "asc" } }),
    db.powerBank.findMany({ where: { status: "docked" } }),
  ]);
  return stations
    .filter((s: { id: string }) => !onlyIds || onlyIds.includes(s.id))
    .map((s: { id: string; code: string; name: string; venue: string; address: string; lat: number; lng: number; status: string; slotCount: number }) => {
      const slots: (number | null)[] = Array.from({ length: s.slotCount }, () => null);
      for (const b of banks) if (b.stationId === s.id && b.slot !== null && b.slot < s.slotCount) slots[b.slot] = b.charge;
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        venue: s.venue,
        address: s.address ?? "",
        lat: s.lat,
        lng: s.lng,
        status: (s.status === "online" ? "online" : "offline") as "online" | "offline",
        slots,
      };
    });
}
