import { randomInt } from "node:crypto";
import type { StateDto, TxnDto, TxnKind } from "@/lib/appTypes";
import { db } from "./db";
import { buildInventory } from "./inventory";
import { toRentalDto } from "./rentals";

/** A short public ID for the customer's QR code. Created the first time it's needed. */
async function ensureCode(userId: string, current: string | null): Promise<string> {
  if (current) return current;
  for (let i = 0; i < 8; i++) {
    const code = `USER-${randomInt(100000, 1000000)}`;
    try {
      await db.user.update({ where: { id: userId }, data: { code } });
      return code;
    } catch {
      /* code already taken: try another */
    }
  }
  throw new Error("could not assign a user code");
}

/** Everything the customer app needs, in one read. Money converted from cents to dollars here. */
export async function buildState(userId: string): Promise<StateDto> {
  const wallet = await db.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
  const user = await db.user.findUnique({ where: { id: userId } });
  const accountCode = await ensureCode(userId, user?.code ?? null);

  const active = await db.rental.findFirst({ where: { userId, status: "active" } });
  const rental = active ? await toRentalDto(db, active) : null;

  const ledger = await db.ledgerEntry.findMany({ where: { userId }, orderBy: { at: "desc" }, take: 100 });
  const history: TxnDto[] = ledger.map((e) => ({
    id: e.id,
    kind: e.kind as TxnKind,
    title: e.title,
    amount: e.amountCents / 100,
    at: e.at.getTime(),
    note: e.note || undefined,
  }));

  const conv = await db.rental.findFirst({ where: { userId, status: "converted", acknowledgedAt: null }, orderBy: { endedAt: "desc" } });
  const convStation = conv ? await db.station.findUnique({ where: { id: conv.fromStationId } }) : null;

  const inventory = await buildInventory();

  return {
    now: Date.now(),
    accountCode,
    balance: (wallet.cashCents + wallet.promoCents) / 100,
    cash: wallet.cashCents / 100,
    promo: wallet.promoCents / 100,
    rental,
    history,
    stations: inventory,
    notice: conv ? { stationName: convStation?.name ?? "VRC station", amount: conv.chargedCents / 100 } : null,
  };
}
