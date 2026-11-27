import { randomBytes } from "node:crypto";
import type { RentalDto, ReceiptDto } from "@/lib/appTypes";
import { db } from "./db";
import { ApiError } from "./http";
import { HOUR_MS, RULES } from "./rules";
import type { Tx } from "./wallet";
import { debit, lockWallet, totalCents } from "./wallet";

const dollars = (cents: number) => cents / 100;
const fail = (code: string, message: string) => new ApiError(400, code, message);
const newCode = () => `R-${randomBytes(3).toString("hex").toUpperCase()}`;

type RentalRow = {
  id: string;
  code: string;
  powerBankId: string;
  fromStationId: string;
  fromSlot: number;
  startCharge: number;
  startedAt: Date;
  rateCents: number;
  overdueHours: number;
  outrightCents: number;
};

export async function toRentalDto(tx: Tx, r: RentalRow): Promise<RentalDto> {
  const [st, bank] = await Promise.all([
    tx.station.findUnique({ where: { id: r.fromStationId } }),
    tx.powerBank.findUnique({ where: { id: r.powerBankId } }),
  ]);
  return {
    id: r.code,
    stationId: r.fromStationId,
    stationName: st?.name ?? "VRC station",
    slot: r.fromSlot + 1,
    serial: bank?.serial ?? "",
    startCharge: r.startCharge,
    startedAt: r.startedAt.getTime(),
    rate: dollars(r.rateCents),
    overdueHours: r.overdueHours,
    outright: dollars(r.outrightCents),
  };
}

/**
 * The 24-hour rule: a rental that is still out after the limit becomes a purchase and the outright
 * price is taken from the wallet (or whatever is left, if less). Runs whenever the customer opens the
 * app or acts; a scheduled job will also run sweepAll() so it happens even if they never come back.
 */
export async function sweepUser(tx: Tx, userId: string, now = Date.now()): Promise<number> {
  await lockWallet(tx, userId); // lock before reading, so two sweeps can never both convert the same rental
  // each rental is judged by the limit it started with, not by today's rules
  const open = await tx.rental.findMany({ where: { userId, status: "active" } });
  let done = 0;
  for (const r of open) {
    if (r.startedAt.getTime() > now - r.overdueHours * HOUR_MS) continue;
    if (await convertRental(tx, r, now, "Converted to a purchase")) done++;
  }
  return done;
}

type ConvertibleRental = { id: string; code: string; userId: string; powerBankId: string; fromStationId: string; outrightCents: number };

/**
 * Turns an active rental into a purchase: the outright price is taken from the wallet (or what is left, if less)
 * and the power bank is written off as sold. Safe to call twice: only the first call wins.
 * The caller must already hold the customer's wallet lock.
 */
export async function convertRental(tx: Tx, r: ConvertibleRental, now: number, note: string): Promise<boolean> {
  const claim = await tx.rental.updateMany({ where: { id: r.id, status: "active" }, data: { status: "converted", endedAt: new Date(now) } });
  if (claim.count !== 1) return false;
  const st = await tx.station.findUnique({ where: { id: r.fromStationId } });
  const charged = await debit(
    tx,
    r.userId,
    r.outrightCents,
    { kind: "overdue", title: `Not returned · ${st?.name ?? "VRC station"}`, note, refId: r.code },
    { upTo: true }
  );
  await tx.rental.update({ where: { id: r.id }, data: { chargedCents: charged } });
  await tx.powerBank.updateMany({ where: { id: r.powerBankId }, data: { status: "sold" } });
  return true;
}

/** For a scheduled job: converts every overdue rental in the system. */
export async function sweepAll(): Promise<number> {
  const now = Date.now();
  const open = await db.rental.findMany({ where: { status: "active" } });
  const late = open.filter((r: { startedAt: Date; overdueHours: number }) => r.startedAt.getTime() <= now - r.overdueHours * HOUR_MS);
  const users = Array.from(new Set(late.map((r: { userId: string }) => r.userId)));
  let n = 0;
  for (const userId of users) n += await db.$transaction((tx) => sweepUser(tx, userId));
  return n;
}

async function stationFor(tx: Tx, stationId: string) {
  const st = await tx.station.findUnique({ where: { id: stationId } });
  if (!st) throw fail("no_station", "We couldn't find that station.");
  return st;
}

/** Takes the best-charged docked power bank. Safe when two people grab at once: only one claim succeeds. */
async function claimBank(tx: Tx, stationId: string, newStatus: "rented" | "sold") {
  const banks = await tx.powerBank.findMany({ where: { stationId, status: "docked" }, orderBy: { charge: "desc" } });
  for (const b of banks) {
    const c = await tx.powerBank.updateMany({ where: { id: b.id, status: "docked" }, data: { status: newStatus, stationId: null, slot: null } });
    if (c.count === 1) return b;
  }
  return null;
}

export async function unlockBank(userId: string, stationId: string): Promise<{ slot: number }> {
  return db.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    await sweepUser(tx, userId);
    const st = await stationFor(tx, stationId);
    if (await tx.rental.findFirst({ where: { userId, status: "active" } }))
      throw fail("has_rental", "You already have a power bank out. Return it first.");
    if (st.status !== "online") throw fail("offline", "This station is offline right now.");
    if ((await tx.powerBank.count({ where: { stationId, status: "docked" } })) === 0)
      throw fail("empty", "No power banks are ready at this station.");
    const w = await lockWallet(tx, userId);
    if (totalCents(w) < RULES.minBalanceCents) throw fail("low_balance", `You need at least ${dollars(RULES.minBalanceCents)} credits to rent.`);
    const bank = await claimBank(tx, stationId, "rented");
    if (!bank) throw fail("empty", "No power banks are ready at this station.");
    await tx.rental.create({
      data: {
        code: newCode(), userId, powerBankId: bank.id, fromStationId: stationId, fromSlot: bank.slot ?? 0, startCharge: bank.charge, status: "active",
        rateCents: RULES.ratePerHourCents, overdueHours: RULES.overdueHours, outrightCents: RULES.outrightCents,
      },
    });
    // TODO(stations bundle): send the unlock command to the station and wait for its confirmation here.
    return { slot: (bank.slot ?? 0) + 1 };
  });
}

export async function buyOutright(userId: string, stationId: string): Promise<{ slot: number }> {
  return db.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    await sweepUser(tx, userId);
    const st = await stationFor(tx, stationId);
    if (st.status !== "online") throw fail("offline", "This station is offline right now.");
    if ((await tx.powerBank.count({ where: { stationId, status: "docked" } })) === 0)
      throw fail("empty", "No power banks are ready at this station.");
    const w = await lockWallet(tx, userId);
    if (totalCents(w) < RULES.outrightCents) throw fail("low_balance", `You need ${dollars(RULES.outrightCents)} credits to buy outright.`);
    const bank = await claimBank(tx, stationId, "sold");
    if (!bank) throw fail("empty", "No power banks are ready at this station.");
    await debit(tx, userId, RULES.outrightCents, { kind: "purchase", title: `Bought outright · ${st.name}`, refId: bank.id });
    return { slot: (bank.slot ?? 0) + 1 };
  });
}

/**
 * Closes the rental and bills it. When stations are connected, the station calls this itself when it
 * detects a power bank going back in. Until then the app's Return button simulates that (development only).
 */
export async function returnBank(userId: string, targetStationId: string): Promise<ReceiptDto> {
  return db.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    await sweepUser(tx, userId);
    const rental = await tx.rental.findFirst({ where: { userId, status: "active" } });
    if (!rental) throw fail("no_rental", "You don't have a power bank out right now.");
    const target = await stationFor(tx, targetStationId);
    if (target.status !== "online") throw fail("offline", "That station is offline right now.");
    const docked = await tx.powerBank.findMany({ where: { stationId: target.id, status: "docked" } });
    const used = new Set(docked.map((b) => b.slot));
    let free = -1;
    for (let i = 0; i < target.slotCount; i++) if (!used.has(i)) { free = i; break; }
    if (free < 0) throw fail("full", "That station has no free slot.");

    const now = Date.now();
    const durationMs = now - rental.startedAt.getTime();
    const hours = Math.max(1, Math.ceil(durationMs / HOUR_MS));
    const dto = await toRentalDto(tx, rental);

    const claim = await tx.rental.updateMany({
      where: { id: rental.id, status: "active" },
      data: { status: "returned", endedAt: new Date(now), returnedStationId: target.id },
    });
    if (claim.count !== 1) throw fail("no_rental", "You don't have a power bank out right now.");
    const back = await tx.powerBank.updateMany({
      where: { id: rental.powerBankId, status: "rented" },
      data: { status: "docked", stationId: target.id, slot: free, charge: 8 },
    });
    if (back.count !== 1) throw new ApiError(500, "server", "Something went wrong. Please try again.");

    const charged = await debit(
      tx,
      userId,
      hours * rental.rateCents,
      { kind: "rental", title: `Rental · ${dto.stationName}`, note: `${hours} hour${hours > 1 ? "s" : ""}`, refId: rental.code },
      { upTo: true }
    );
    await tx.rental.update({ where: { id: rental.id }, data: { chargedCents: charged } });
    const w = await lockWallet(tx, userId);
    return { rental: dto, hours, durationMs, charged: dollars(charged), returnedAt: target.name, balanceAfter: dollars(totalCents(w)) };
  });
}

/** Development only: pretend the rental started `hours` earlier, to test billing and the 24-hour rule. */
export async function timeTravel(userId: string, hours: number): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    const r = await tx.rental.findFirst({ where: { userId, status: "active" } });
    if (r) await tx.rental.update({ where: { id: r.id }, data: { startedAt: new Date(r.startedAt.getTime() - hours * HOUR_MS) } });
    await sweepUser(tx, userId);
  });
}
