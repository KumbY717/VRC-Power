import type { AgentEntryDto, AgentStateDto, ReportDto } from "@/lib/appTypes";
import { audit } from "./audit";
import { db } from "./db";
import { buildInventory } from "./inventory";
import { ApiError } from "./http";
import { RULES } from "./rules";
import type { Tx } from "./wallet";
import { creditCash } from "./wallet";

const dollars = (c: number) => c / 100;
const fail = (code: string, message: string) => new ApiError(400, code, message);

/** Takes a row lock on the agent's float, so two credits can never spend the same float. Always taken before a customer's wallet. */
export async function lockAgent(tx: Tx, userId: string) {
  const p = await tx.agentProfile.findUnique({ where: { userId } });
  if (!p) throw new ApiError(403, "no_profile", "This agent account isn't set up yet. Contact support.");
  return tx.agentProfile.update({ where: { userId }, data: { updatedAt: new Date() } });
}

export async function startShift(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await lockAgent(tx, userId);
    if (await tx.shift.findFirst({ where: { agentId: userId, status: "open" } })) throw fail("has_shift", "You already have a shift open.");
    const s = await tx.shift.create({ data: { agentId: userId, floatAtStartCents: p.floatCents } });
    await audit({ actorId: userId, actorRole: "agent", action: "shift_start", target: s.id, detail: `float ${dollars(p.floatCents).toFixed(2)}` }, tx);
  });
}

/** Lets the agent confirm who they are crediting. Gives the first name only. */
export async function lookupCustomer(code: string): Promise<{ name: string }> {
  if (!/^USER-\d{6}$/.test(code)) throw fail("bad_code", "That doesn't look like a customer code. It should be like USER-482193.");
  const c = await db.user.findUnique({ where: { code } });
  if (!c || c.role !== "customer" || c.status !== "active") throw fail("no_customer", "We couldn't find a customer with that code.");
  return { name: c.name.split(" ")[0] };
}

type CreditInput = { code: string; kind: "topup" | "sale"; amountCents: number; ref: string };

const entryDto = (t: { id: string; kind: string; customerCode: string; customerName: string; amountCents: number; commissionCents: number; at: Date }): AgentEntryDto => ({
  id: t.id,
  kind: t.kind === "sale" ? "sale" : "topup",
  customer: t.customerCode,
  customerName: t.customerName,
  amount: dollars(t.amountCents),
  commission: dollars(t.commissionCents),
  at: t.at.getTime(),
});

/**
 * The agent has taken cash from a customer: move that many credits from the agent's float to the customer's wallet.
 * `ref` is chosen by the phone for each attempt. Sending the same ref again (a retry after a bad connection)
 * returns the first result and never credits twice.
 */
export async function giveCredits(userId: string, input: CreditInput): Promise<AgentEntryDto> {
  return db.$transaction(async (tx) => {
    const agent = await lockAgent(tx, userId);
    const dup = await tx.agentTxn.findFirst({ where: { agentId: userId, clientRef: input.ref } });
    if (dup) return entryDto(dup);

    const shift = await tx.shift.findFirst({ where: { agentId: userId, status: "open" } });
    if (!shift) throw fail("no_shift", "Start your shift first.");
    const customer = await tx.user.findUnique({ where: { code: input.code } });
    if (!customer || customer.role !== "customer" || customer.status !== "active") throw fail("no_customer", "We couldn't find a customer with that code.");

    const cents = input.kind === "sale" ? RULES.outrightCents : input.amountCents;
    if (!Number.isInteger(cents) || cents < 100 || cents > 20_000) throw fail("bad_amount", "Enter an amount from $1 to $200.");
    if (cents > agent.floatCents) throw fail("low_float", `Not enough float. You have ${dollars(agent.floatCents).toFixed(2)} credits left.`);

    const commission = input.kind === "sale" ? RULES.agentSaleBonusCents : Math.round((cents * RULES.agentCommissionBps) / 10_000);
    const txn = await tx.agentTxn.create({
      data: {
        shiftId: shift.id, agentId: userId, customerId: customer.id, customerCode: input.code, customerName: customer.name.split(" ")[0],
        kind: input.kind, amountCents: cents, commissionCents: commission, clientRef: input.ref,
      },
    });
    const after = await tx.agentProfile.update({ where: { userId }, data: { floatCents: { decrement: cents } } });
    if (after.floatCents < 0) throw fail("low_float", "Not enough float.");
    await tx.floatEntry.create({ data: { agentId: userId, kind: "given", amountCents: -cents, refId: txn.id, note: input.code } });
    await creditCash(tx, customer.id, cents, { kind: "topup", title: "Top up · Cash with an agent", refId: `agent-${txn.id}` });
    await tx.shift.update({ where: { id: shift.id }, data: { txnCount: { increment: 1 } } });
    await audit({ actorId: userId, actorRole: "agent", action: "agent_credit", target: input.code, detail: `${input.kind} $${dollars(cents).toFixed(2)}` }, tx);
    return entryDto(txn);
  });
}

const reportDto = (s: { id: string; startedAt: Date; endedAt: Date | null; floatAtStartCents: number; txnCount: number; expectedCents: number | null; countedCents: number | null; diffCents: number | null; earnedCents: number | null }): ReportDto => ({
  id: s.id,
  startedAt: s.startedAt.getTime(),
  endedAt: (s.endedAt ?? s.startedAt).getTime(),
  assigned: dollars(s.floatAtStartCents),
  given: dollars(s.expectedCents ?? 0),
  expectedCash: dollars(s.expectedCents ?? 0),
  countedCash: dollars(s.countedCents ?? 0),
  diff: dollars(s.diffCents ?? 0),
  txnCount: s.txnCount,
  earned: dollars(s.earnedCents ?? 0),
});

/** Closes the shift: compares the cash the agent counted with the credits they handed out, and records the difference. */
export async function endShift(userId: string, countedCents: number): Promise<ReportDto> {
  if (!Number.isInteger(countedCents) || countedCents < 0 || countedCents > 5_000_000) throw fail("bad_amount", "Enter the cash you counted, for example 85.00.");
  return db.$transaction(async (tx) => {
    await lockAgent(tx, userId);
    const shift = await tx.shift.findFirst({ where: { agentId: userId, status: "open" } });
    if (!shift) throw fail("no_shift", "You don't have a shift open.");
    const txns = await tx.agentTxn.findMany({ where: { shiftId: shift.id } });
    const given = txns.reduce((n: number, t: { amountCents: number }) => n + t.amountCents, 0);
    const commission = txns.reduce((n: number, t: { commissionCents: number }) => n + t.commissionCents, 0);
    const earned = RULES.agentAllowanceCents + commission;
    const diff = countedCents - given;
    const claim = await tx.shift.updateMany({
      where: { id: shift.id, status: "open" },
      data: { status: "closed", endedAt: new Date(), expectedCents: given, countedCents, diffCents: diff, earnedCents: earned, txnCount: txns.length },
    });
    if (claim.count !== 1) throw fail("no_shift", "You don't have a shift open.");
    await audit({ actorId: userId, actorRole: "agent", action: "shift_closed", target: shift.id, detail: `expected $${dollars(given).toFixed(2)}, counted $${dollars(countedCents).toFixed(2)}` }, tx);
    if (diff !== 0)
      await audit({ actorId: userId, actorRole: "agent", action: "shift_mismatch", target: shift.id, detail: `${diff < 0 ? "short" : "over"} $${dollars(Math.abs(diff)).toFixed(2)}` }, tx);
    const closed = await tx.shift.findUnique({ where: { id: shift.id } });
    return reportDto(closed!);
  });
}

const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare" }).format(ms);
const dayName = (ms: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", weekday: "short" }).format(ms);

/** Everything the agent app shows, in one read. */
export async function buildAgentState(userId: string, name: string): Promise<AgentStateDto> {
  const profile = await db.agentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError(403, "no_profile", "This agent account isn't set up yet. Contact support.");
  const open = await db.shift.findFirst({ where: { agentId: userId, status: "open" } });

  let shift: AgentStateDto["shift"] = null;
  if (open) {
    const txns = await db.agentTxn.findMany({ where: { shiftId: open.id }, orderBy: { at: "desc" } });
    const given = txns.reduce((n, t) => n + t.amountCents, 0);
    const commission = txns.reduce((n, t) => n + t.commissionCents, 0);
    shift = {
      id: open.id,
      startedAt: open.startedAt.getTime(),
      assigned: dollars(open.floatAtStartCents),
      entries: txns.map(entryDto),
      given: dollars(given),
      commissionTotal: dollars(commission),
      earned: dollars(RULES.agentAllowanceCents + commission),
    };
  }

  const closed = await db.shift.findMany({ where: { agentId: userId, status: "closed" }, orderBy: { endedAt: "desc" }, take: 30 });
  const now = Date.now();
  const week = [6, 5, 4, 3, 2, 1].map((n) => {
    const t = now - n * 86_400_000;
    const key = dayKey(t);
    const sum = closed.filter((s) => s.endedAt && dayKey(s.endedAt.getTime()) === key).reduce((a, s) => a + (s.earnedCents ?? 0), 0);
    return { d: dayName(t), v: dollars(sum) };
  });

  const payouts = await db.payout.findMany({ where: { agentId: userId }, orderBy: { at: "desc" }, take: 20 });

  let demoCustomers: string[] = [];
  if (process.env.NODE_ENV !== "production" && process.env.DEV_TOOLS === "1") {
    const some = await db.user.findMany({ where: { role: "customer", status: "active" }, take: 8 });
    demoCustomers = some.map((u) => u.code).filter((c): c is string => !!c).slice(0, 4);
  }

  const assignedIds = profile.stationIds ? profile.stationIds.split(",").map((x) => x.trim()).filter(Boolean) : [];
  return {
    now,
    profile: {
      name,
      venue: profile.venue,
      event: profile.event,
      stationIds: assignedIds,
      baseAllowance: dollars(RULES.agentAllowanceCents),
      commissionRate: RULES.agentCommissionBps / 10_000,
      saleBonus: dollars(RULES.agentSaleBonusCents),
    },
    float: dollars(profile.floatCents),
    shift,
    reports: closed.map(reportDto),
    week,
    payouts: payouts.map((p) => ({ id: p.id, at: p.at.getTime(), amount: dollars(p.amountCents), note: p.note })),
    demoCustomers,
    stations: assignedIds.length ? await buildInventory(assignedIds) : [],
  };
}
