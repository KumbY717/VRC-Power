import { randomInt } from "node:crypto";
import type {
  AdminAgentDto,
  AdminAuditDto,
  AdminCommandDto,
  AdminCustomerDto,
  AdminPaymentDto,
  AdminRentalDto,
  AdminRulesDto,
  AdminSessionDto,
  AdminStateDto,
  AdminStationDto,
  AdminTopupDto,
} from "@/lib/appTypes";
import { isPlaceholder, positionProblem } from "@/lib/geo";
import { hashPassword, randomToken } from "./crypto";
import { audit } from "./audit";
import { db } from "./db";
import { lockAgent } from "./agents";
import { ApiError } from "./http";
import { passwordProblem } from "./policy";
import type { Rules } from "./rules";
import { RULES } from "./rules";
import { convertRental } from "./rentals";
import type { Tx } from "./wallet";
import { creditPromo, debit, lockWallet, refundCash, totalCents } from "./wallet";

const dollars = (c: number) => c / 100;
const fail = (code: string, message: string) => new ApiError(400, code, message);
const DAY = 86_400_000;

type Admin = { id: string };
const A = (a: Admin) => ({ actorId: a.id, actorRole: "admin" });

/* ------------------------------------------------------------------ reading */

const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare" }).format(ms);

function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return os ? `${br} on ${os}` : br;
}

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  login_failed: "Failed login",
  logout: "Logout",
  signup: "Sign-up",
  signup_existing_number: "Sign-up on existing number",
  otp_failed: "Wrong code",
  reset_requested: "Password reset asked",
  password_reset: "Password reset",
  shift_start: "Shift started",
  shift_closed: "Shift closed",
  shift_mismatch: "Cash mismatch",
  agent_credit: "Credits handed out",
  agent_created: "Agent created",
  agent_profile: "Agent details changed",
  float_added: "Float added",
  float_removed: "Float taken back",
  agent_suspended: "Agent suspended",
  agent_reactivated: "Agent reactivated",
  payout: "Agent paid",
  wallet_promo: "Promo credit added",
  wallet_refund: "Cash credit refunded",
  wallet_deduct: "Credit deducted",
  customer_suspended: "Customer suspended",
  customer_reactivated: "Customer reactivated",
  rental_converted: "Rental converted",
  rules_changed: "Pricing rules changed",
  session_revoked: "Session revoked",
  remote_unlock: "Remote unlock",
  station_status: "Station status changed",
  station_created: "Station added",
  station_updated: "Station details changed",
  payment_credited: "Paynow payment credited",
  payment_flagged: "Paynow payment flagged",
  payment_checked: "Paynow payment checked",
};
const FLAG_TEXT: Record<string, string> = {
  amount_mismatch: "Paynow reported a different amount than we asked for. Nothing was credited. Check with Paynow.",
  reversed_after_credit: "Paynow refunded or disputed this payment after credits were added. Check the customer's wallet.",
};
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const rulesDto = (): AdminRulesDto => ({
  ratePerHour: dollars(RULES.ratePerHourCents),
  minBalance: dollars(RULES.minBalanceCents),
  outrightPrice: dollars(RULES.outrightCents),
  overdueHours: RULES.overdueHours,
  commissionPct: RULES.agentCommissionBps / 100,
  baseAllowance: dollars(RULES.agentAllowanceCents),
  saleBonus: dollars(RULES.agentSaleBonusCents),
});

type UserRow = { id: string; code: string | null; name: string; phone: string | null; status: string; createdAt: Date };

async function customerRows(users: UserRow[]): Promise<AdminCustomerDto[]> {
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const [wallets, rentals] = await Promise.all([
    db.wallet.findMany({ where: { userId: { in: ids } } }),
    db.rental.findMany({ where: { userId: { in: ids } } }),
  ]);
  return users.map((u) => {
    const w = wallets.find((x: { userId: string }) => x.userId === u.id);
    const mine = rentals.filter((r: { userId: string }) => r.userId === u.id);
    return {
      id: u.id,
      code: u.code ?? "",
      name: u.name,
      phone: u.phone ?? "",
      cash: dollars(w?.cashCents ?? 0),
      promo: dollars(w?.promoCents ?? 0),
      rentals: mine.length,
      flagged: mine.some((r: { status: string }) => r.status === "converted"),
      active: u.status === "active",
      joinedAt: u.createdAt.getTime(),
    };
  });
}

export async function searchCustomers(q: string): Promise<AdminCustomerDto[]> {
  const s = q.trim();
  if (s.length < 2 || s.length > 40) throw fail("bad_request", "Type at least 2 characters to search.");
  const users = await db.user.findMany({
    where: { role: "customer", OR: [{ name: { contains: s } }, { phone: { contains: s.replace(/[\s-]/g, "") } }, { code: { contains: s.toUpperCase() } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return customerRows(users);
}

async function agentRows(): Promise<AdminAgentDto[]> {
  const users = await db.user.findMany({ where: { role: "agent" }, orderBy: { createdAt: "asc" } });
  if (!users.length) return [];
  const ids = users.map((u: { id: string }) => u.id);
  const [profiles, shifts, payouts] = await Promise.all([
    db.agentProfile.findMany({ where: { userId: { in: ids } } }),
    db.shift.findMany({ where: { agentId: { in: ids } }, orderBy: { startedAt: "desc" } }),
    db.payout.findMany({ where: { agentId: { in: ids } }, orderBy: { at: "desc" } }),
  ]);
  return users.map((u: UserRow) => {
    const p = profiles.find((x: { userId: string }) => x.userId === u.id);
    const mine = shifts.filter((s: { agentId: string }) => s.agentId === u.id);
    const open = mine.find((s: { status: string }) => s.status === "open");
    const closed = mine.filter((s: { status: string }) => s.status === "closed");
    const pays = payouts.filter((x: { agentId: string }) => x.agentId === u.id);
    const earned = closed.reduce((n: number, s: { earnedCents: number | null }) => n + (s.earnedCents ?? 0), 0);
    const paid = pays.reduce((n: number, x: { amountCents: number }) => n + x.amountCents, 0);
    const floatLeft = p?.floatCents ?? 0;
    const lastStart = (open ?? closed[0])?.floatAtStartCents ?? 0;
    return {
      id: u.id,
      name: u.name,
      phone: u.phone ?? "",
      venue: p?.venue || "Unassigned",
      event: p?.event ?? "",
      stationIds: p?.stationIds ? p.stationIds.split(",").map((x: string) => x.trim()).filter(Boolean) : [],
      active: u.status === "active",
      onShift: !!open,
      floatLeft: dollars(floatLeft),
      floatAssigned: dollars(Math.max(floatLeft, lastStart)),
      recon: closed.slice(0, 5).map((s: { diffCents: number | null }) => dollars(s.diffCents ?? 0)),
      earnedTotal: dollars(earned),
      paidTotal: dollars(paid),
      owed: dollars(earned - paid),
      payouts: pays.slice(0, 10).map((x: { id: string; at: Date; amountCents: number; note: string }) => ({ id: x.id, at: x.at.getTime(), amount: dollars(x.amountCents), note: x.note })),
    };
  });
}

export async function buildAdminState(currentSessionId: string): Promise<AdminStateDto> {
  const now = Date.now();
  const [agents, newest, customerCount, activeCount, sums] = await Promise.all([
    agentRows(),
    db.user.findMany({ where: { role: "customer" }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.user.count({ where: { role: "customer" } }),
    db.rental.count({ where: { status: "active" } }),
    db.wallet.aggregate({ _sum: { cashCents: true, promoCents: true } }),
  ]);
  const customers = await customerRows(newest);

  // rentals: every active one, plus the most recent others
  const [activeRentals, recentRentals] = await Promise.all([
    db.rental.findMany({ where: { status: "active" }, orderBy: { startedAt: "desc" } }),
    db.rental.findMany({ orderBy: { startedAt: "desc" }, take: 100 }),
  ]);
  const seen = new Set<string>();
  const rentalRows = [...activeRentals, ...recentRentals].filter((r: { id: string }) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  const paymentRows = await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const topupRows = await db.ledgerEntry.findMany({ where: { kind: "topup" }, orderBy: { at: "desc" }, take: 100 });
  const since = new Date(now - 14 * DAY);
  const topups14 = await db.ledgerEntry.findMany({ where: { kind: "topup", at: { gte: since } } });
  const auditRows = await db.auditLog.findMany({ orderBy: { at: "desc" }, take: 200 });
  const stationRows = await db.station.findMany({ orderBy: { id: "asc" } });
  const banks = await db.powerBank.findMany({ where: { status: "docked" } });
  const commandRows = await db.stationCommand.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const staff = await db.user.findMany({ where: { role: { in: ["admin", "agent"] } } });

  // names for everything we show
  const wanted = new Set<string>();
  for (const r of rentalRows) wanted.add(r.userId);
  for (const t of topupRows) wanted.add(t.userId);
  for (const p of paymentRows) wanted.add(p.userId);
  for (const a of auditRows) if (a.actorId) wanted.add(a.actorId);
  for (const c of commandRows) wanted.add(c.requestedBy);
  const people = wanted.size ? await db.user.findMany({ where: { id: { in: Array.from(wanted) } } }) : [];
  const who = (id: string | null | undefined) => people.find((u: { id: string }) => u.id === id) as UserRow | undefined;

  const stationName = (id: string) => stationRows.find((s: { id: string }) => s.id === id)?.name ?? id;
  const bankIds = Array.from(new Set(rentalRows.map((r: { powerBankId: string }) => r.powerBankId)));
  const bankRows = bankIds.length ? await db.powerBank.findMany({ where: { id: { in: bankIds } } }) : [];

  const rentals: AdminRentalDto[] = rentalRows.map((r: any) => ({
    id: r.code,
    customer: who(r.userId)?.code ?? "",
    customerName: who(r.userId)?.name ?? "",
    station: stationName(r.fromStationId),
    slot: r.fromSlot + 1,
    serial: bankRows.find((b: { id: string }) => b.id === r.powerBankId)?.serial ?? "",
    startedAt: r.startedAt.getTime(),
    endedAt: r.endedAt ? r.endedAt.getTime() : undefined,
    returnedAt: r.returnedStationId ? stationName(r.returnedStationId) : undefined,
    status: r.status,
    overdueHours: r.overdueHours,
    outright: dollars(r.outrightCents),
  }));

  const topups: AdminTopupDto[] = topupRows.map((t: any) => ({
    id: t.id,
    ref: t.refId ?? "",
    customer: who(t.userId)?.code ?? "",
    customerName: who(t.userId)?.name ?? "",
    method: t.title.replace(/^Top up · /, ""),
    amount: dollars(t.amountCents),
    at: t.at.getTime(),
  }));

  const METHODS: Record<string, string> = { ecocash: "EcoCash", onemoney: "OneMoney", card: "Visa / Mastercard" };
  const payments: AdminPaymentDto[] = paymentRows.map((p: any) => ({
    ref: p.reference,
    paynowRef: p.paynowReference ?? "",
    customer: who(p.userId)?.code ?? "",
    customerName: who(p.userId)?.name ?? "",
    method: METHODS[p.method] ?? p.method,
    amount: dollars(p.amountCents),
    status: p.status,
    paynowStatus: p.paynowStatus,
    flag: p.flag ? (FLAG_TEXT[p.flag] ?? p.flag) : null,
    error: p.error ?? null,
    at: p.createdAt.getTime(),
  }));

  const revenue = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(now - (13 - i) * DAY);
    return dollars(topups14.filter((t: any) => dayKey(t.at.getTime()) === key).reduce((n: number, t: any) => n + t.cashCents, 0));
  });

  const auditOut: AdminAuditDto[] = auditRows.map((a: any) => ({
    id: a.id,
    at: a.at.getTime(),
    actor: who(a.actorId)?.name ?? (a.actorRole === "system" ? "System" : a.actorRole === "anonymous" ? "Visitor" : a.actorRole),
    action: actionLabel(a.action),
    target: a.target,
    detail: a.detail,
  }));

  const staffIds = staff.map((u: { id: string }) => u.id);
  const sessionRows = staffIds.length
    ? await db.session.findMany({ where: { userId: { in: staffIds }, expiresAt: { gt: new Date(now) } }, orderBy: { lastSeenAt: "desc" }, take: 50 })
    : [];
  const sessions: AdminSessionDto[] = sessionRows.map((s: any) => {
    const u = staff.find((x: { id: string }) => x.id === s.userId);
    return {
      id: s.id,
      who: u?.name ?? "",
      role: u?.role === "admin" ? "Super Admin" : "Agent",
      device: s.id === currentSessionId ? "This browser" : deviceName(s.userAgent),
      ip: s.ip ?? "",
      lastSeen: s.lastSeenAt.getTime(),
      current: s.id === currentSessionId,
    };
  });

  const stations: AdminStationDto[] = stationRows.map((s: any) => {
    const slots: AdminStationDto["slots"] = Array.from({ length: s.slotCount }, () => null);
    for (const b of banks) if (b.stationId === s.id && b.slot !== null && b.slot < s.slotCount) slots[b.slot] = { serial: b.serial, charge: b.charge };
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      venue: s.venue,
      address: s.address ?? "",
      lat: s.lat,
      lng: s.lng,
      placed: !isPlaceholder({ lat: s.lat, lng: s.lng }),
      status: s.status === "online" ? "online" : "offline",
      slots,
    };
  });

  const commands: AdminCommandDto[] = commandRows.map((c: any) => ({
    id: c.id,
    station: stationName(c.stationId),
    slot: c.slot,
    status: c.status,
    reason: c.reason,
    by: who(c.requestedBy)?.name ?? "Admin",
    at: c.createdAt.getTime(),
  }));

  return {
    now,
    rules: rulesDto(),
    counts: { customers: customerCount, activeRentals: activeCount, agentsOnShift: agents.filter((a) => a.onShift && a.active).length, agentsActive: agents.filter((a) => a.active).length },
    outstanding: dollars((sums._sum?.cashCents ?? 0) + (sums._sum?.promoCents ?? 0)),
    revenue,
    agents,
    customers,
    rentals,
    topups,
    payments,
    audit: auditOut,
    sessions,
    stations,
    commands,
  };
}

/* ------------------------------------------------------------------ agents */

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function tempPassword(): string {
  for (;;) {
    let p = "";
    for (let i = 0; i < 10; i++) p += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
    if (!passwordProblem(p)) return p;
  }
}

async function validStationIds(ids: string[]): Promise<string> {
  const unique = Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
  if (unique.length > 12) throw fail("bad_request", "Too many stations.");
  if (unique.length) {
    const found = await db.station.findMany({ where: { id: { in: unique } } });
    if (found.length !== unique.length) throw fail("bad_request", "One of those stations doesn't exist.");
  }
  return unique.join(",");
}

export async function createAgent(admin: Admin, input: { name: string; phone: string; venue: string; event: string; stationIds: string[] }): Promise<{ agentId: string; tempPassword: string }> {
  const stationIds = await validStationIds(input.stationIds);
  const password = tempPassword();
  const passwordHash = await hashPassword(password);
  try {
    const user = await db.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { phone: input.phone } })) throw fail("phone_taken", "That phone number already has an account.");
      const u = await tx.user.create({ data: { role: "agent", name: input.name, phone: input.phone, passwordHash, mustChangePassword: true } });
      await tx.agentProfile.create({ data: { userId: u.id, venue: input.venue, event: input.event, stationIds } });
      await audit({ ...A(admin), action: "agent_created", target: input.name, detail: `${input.venue || "No venue yet"}` }, tx);
      return u;
    });
    return { agentId: user.id, tempPassword: password };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw fail("phone_taken", "That phone number already has an account.");
    throw e;
  }
}

async function agentUser(tx: Tx, agentId: string) {
  const u = await tx.user.findUnique({ where: { id: agentId } });
  if (!u || u.role !== "agent") throw fail("no_agent", "Agent not found.");
  return u;
}

export async function updateAgentProfile(admin: Admin, agentId: string, input: { venue: string; event: string; stationIds: string[] }): Promise<void> {
  const stationIds = await validStationIds(input.stationIds);
  await db.$transaction(async (tx) => {
    const u = await agentUser(tx, agentId);
    await tx.agentProfile.upsert({
      where: { userId: agentId },
      create: { userId: agentId, venue: input.venue, event: input.event, stationIds },
      update: { venue: input.venue, event: input.event, stationIds },
    });
    await audit({ ...A(admin), action: "agent_profile", target: u.name, detail: `${input.venue || "No venue"} · ${stationIds || "no stations"}` }, tx);
  });
}

const MAX_FLOAT_CENTS = 500_000;

/** Adds (positive) or takes back (negative) credits from an agent's float. */
export async function adjustFloat(admin: Admin, agentId: string, cents: number, note: string): Promise<void> {
  if (!Number.isInteger(cents) || cents === 0 || Math.abs(cents) > 50_000) throw fail("bad_amount", "Enter an amount from 1 to 500.");
  await db.$transaction(async (tx) => {
    const u = await agentUser(tx, agentId);
    if (cents > 0 && u.status !== "active") throw fail("suspended", "This agent is suspended.");
    const p = await lockAgent(tx, agentId);
    if (p.floatCents + cents < 0) throw fail("low_float", `Only ${dollars(p.floatCents).toFixed(2)} credits are left in the float.`);
    if (p.floatCents + cents > MAX_FLOAT_CENTS) throw fail("too_much", "A float can't be more than 5,000 credits.");
    await tx.agentProfile.update({ where: { userId: agentId }, data: { floatCents: { increment: cents } } });
    await tx.floatEntry.create({ data: { agentId, kind: cents > 0 ? "issue" : "adjust", amountCents: cents, refId: `adm-${randomToken(9)}`, note } });
    await audit(
      { ...A(admin), action: cents > 0 ? "float_added" : "float_removed", target: u.name, detail: `${cents > 0 ? "+" : "−"}${dollars(Math.abs(cents)).toFixed(2)} credits${note ? `. ${note}` : ""}` },
      tx
    );
  });
}

export async function setUserActive(admin: Admin, role: "agent" | "customer", userId: string, active: boolean, reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u || u.role !== role) throw fail("not_found", role === "agent" ? "Agent not found." : "Customer not found.");
    await tx.user.update({ where: { id: userId }, data: { status: active ? "active" : "suspended" } });
    if (!active) await tx.session.deleteMany({ where: { userId } }); // signed out everywhere, right now
    await audit({ ...A(admin), action: `${role}_${active ? "reactivated" : "suspended"}`, target: `${u.name}${u.code ? ` (${u.code})` : ""}`, detail: reason }, tx);
  });
}

export async function recordPayout(admin: Admin, agentId: string, cents: number, note: string): Promise<void> {
  if (!Number.isInteger(cents) || cents <= 0 || cents > 500_000) throw fail("bad_amount", "Enter an amount from $0.01 to $5,000.");
  await db.$transaction(async (tx) => {
    const u = await agentUser(tx, agentId);
    await lockAgent(tx, agentId); // one payout at a time per agent
    const closed = await tx.shift.findMany({ where: { agentId, status: "closed" } });
    const paid = await tx.payout.findMany({ where: { agentId } });
    const owed =
      closed.reduce((n: number, s: { earnedCents: number | null }) => n + (s.earnedCents ?? 0), 0) - paid.reduce((n: number, x: { amountCents: number }) => n + x.amountCents, 0);
    if (cents > owed) throw fail("too_much", `Only $${dollars(Math.max(0, owed)).toFixed(2)} is owed to this agent.`);
    await tx.payout.create({ data: { agentId, amountCents: cents, note } });
    await audit({ ...A(admin), action: "payout", target: u.name, detail: `$${dollars(cents).toFixed(2)}${note ? `. ${note}` : ""}` }, tx);
  });
}

/* ------------------------------------------------------------------ customers */

export type AdjustKind = "promo" | "refund" | "deduct";

export async function adjustCustomer(admin: Admin, customerId: string, kind: AdjustKind, cents: number, reason: string): Promise<void> {
  if (!Number.isInteger(cents) || cents <= 0 || cents > 50_000) throw fail("bad_amount", "Enter an amount from 0.01 to 500.");
  await db.$transaction(async (tx) => {
    const c = await tx.user.findUnique({ where: { id: customerId } });
    if (!c || c.role !== "customer") throw fail("not_found", "Customer not found.");
    const w = await lockWallet(tx, customerId);
    const ref = `adm-${randomToken(9)}`;
    const label = `${c.name}${c.code ? ` (${c.code})` : ""}`;
    const amt = `$${dollars(cents).toFixed(2)}`;
    if (kind === "promo") {
      await creditPromo(tx, customerId, cents, { kind: "adjust", title: "Goodwill credit", note: reason, refId: ref });
    } else if (kind === "refund") {
      if (cents > w.cashCents)
        throw fail("not_refundable", `Only unspent cash credits can be refunded. This customer has $${dollars(w.cashCents).toFixed(2)} of them. Promo credits are never refundable.`);
      await refundCash(tx, customerId, cents, { kind: "refund", title: "Refund", note: reason, refId: ref });
    } else {
      if (cents > totalCents(w)) throw fail("low_balance", "That is more than the customer's balance.");
      await debit(tx, customerId, cents, { kind: "adjust", title: "Correction", note: reason, refId: ref });
    }
    await audit({ ...A(admin), action: `wallet_${kind}`, target: label, detail: `${amt}. ${reason}` }, tx);
  });
}

/* ------------------------------------------------------------------ rentals */

/** Turns an active rental into a purchase now, the same way the 24-hour rule would. */
export async function adminConvertRental(admin: Admin, code: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const first = await tx.rental.findFirst({ where: { code } });
    if (!first || first.status !== "active") throw fail("not_active", "Only active rentals can be converted.");
    await lockWallet(tx, first.userId); // same lock order as the customer's own actions
    const r = await tx.rental.findFirst({ where: { code } });
    if (!r || r.status !== "active") throw fail("not_active", "Only active rentals can be converted.");
    if (!(await convertRental(tx, r, Date.now(), "Converted by admin"))) throw fail("not_active", "Only active rentals can be converted.");
    const done = await tx.rental.findFirst({ where: { code } });
    const cust = await tx.user.findUnique({ where: { id: r.userId } });
    await audit({ ...A(admin), action: "rental_converted", target: code, detail: `${cust?.code ?? ""} turned into a purchase. $${dollars(done?.chargedCents ?? 0).toFixed(2)} forfeited.` }, tx);
  });
}

/* ------------------------------------------------------------------ stations */

export async function queueUnlock(admin: Admin, stationId: string, slot: number, reason: string): Promise<void> {
  const st = await db.station.findUnique({ where: { id: stationId } });
  if (!st) throw fail("no_station", "Station not found.");
  if (!Number.isInteger(slot) || slot < 1 || slot > st.slotCount) throw fail("bad_slot", `Choose a slot from 1 to ${st.slotCount}.`);
  await db.$transaction(async (tx) => {
    await tx.stationCommand.create({ data: { stationId, slot, kind: "unlock", reason, requestedBy: admin.id } });
    await audit({ ...A(admin), action: "remote_unlock", target: `${st.name} slot ${slot}`, detail: reason }, tx);
  });
}

export async function setStationStatus(admin: Admin, stationId: string, status: "online" | "offline", reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const st = await tx.station.findUnique({ where: { id: stationId } });
    if (!st) throw fail("no_station", "Station not found.");
    await tx.station.update({ where: { id: stationId }, data: { status } });
    await audit({ ...A(admin), action: "station_status", target: st.name, detail: `${status}. ${reason}` }, tx);
  });
}

export type StationInput = { id?: string; code?: string; name: string; venue: string; address: string; lat: number; lng: number; slotCount?: number };

const slugOf = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "") || "station";

/**
 * Adds a station or changes where it is and what it is called. A new station starts out of service (customers can't
 * see it as usable) until the admin puts it in service. The number of slots is fixed when it is created.
 */
export async function saveStation(admin: Admin, i: StationInput): Promise<void> {
  const problem = positionProblem(i.lat, i.lng);
  if (problem) throw fail("bad_position", problem);
  const lat = Math.round(i.lat * 1e6) / 1e6;
  const lng = Math.round(i.lng * 1e6) / 1e6;
  if (i.id) {
    await db.$transaction(async (tx) => {
      const st = await tx.station.findUnique({ where: { id: i.id } });
      if (!st) throw fail("no_station", "Station not found.");
      await tx.station.update({ where: { id: st.id }, data: { name: i.name, venue: i.venue, address: i.address, lat, lng } });
      await audit({ ...A(admin), action: "station_updated", target: i.name, detail: `${st.code} at ${lat}, ${lng}` }, tx);
    });
    return;
  }
  const code = (i.code ?? "").trim().toUpperCase();
  if (!/^VRC-[A-Z0-9]{2,8}$/.test(code)) throw fail("bad_code", "The code is printed on the station's sticker, like VRC-HC03.");
  const slotCount = i.slotCount ?? 8;
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > 24) throw fail("bad_slots", "Slots must be a whole number from 1 to 24.");
  try {
    await db.$transaction(async (tx) => {
      if (await tx.station.findUnique({ where: { code } })) throw fail("code_taken", "A station with that code already exists.");
      const base = slugOf(i.name);
      let id = base;
      for (let n = 2; await tx.station.findUnique({ where: { id } }); n++) id = `${base}-${n}`;
      await tx.station.create({ data: { id, code, name: i.name, venue: i.venue, address: i.address, lat, lng, slotCount, status: "offline" } });
      await audit({ ...A(admin), action: "station_created", target: i.name, detail: `${code}, ${slotCount} slots, at ${lat}, ${lng}` }, tx);
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw fail("code_taken", "A station with that code already exists.");
    throw e;
  }
}

/* ------------------------------------------------------------------ sessions */

export async function revokeSession(admin: Admin, currentSessionId: string, sessionId: string): Promise<void> {
  if (sessionId === currentSessionId) throw fail("current", "That is the session you are using. Use Log out instead.");
  await db.$transaction(async (tx) => {
    const s = await tx.session.findUnique({ where: { id: sessionId } });
    if (!s) throw fail("not_found", "That session has already ended.");
    const u = await tx.user.findUnique({ where: { id: s.userId } });
    if (!u || (u.role !== "admin" && u.role !== "agent")) throw fail("not_found", "That session has already ended.");
    await tx.session.deleteMany({ where: { id: sessionId } });
    await audit({ ...A(admin), action: "session_revoked", target: u.name, detail: deviceName(s.userAgent) }, tx);
  });
}

export type { Rules };
