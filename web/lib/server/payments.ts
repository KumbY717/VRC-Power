import { randomInt } from "node:crypto";
import type { PaymentDto } from "@/lib/appTypes";
import { isEcocash, isOnemoney, normalizePhone } from "@/lib/validate";
import { audit } from "./audit";
import { db } from "./db";
import { ApiError } from "./http";
import { amountToCents, hashIsValid, isSimulated, paynowConfig, paynowInitiate, paynowPoll, parseForm } from "./paynow";
import type { PayMethod, Polled } from "./paynow";
import { enforce } from "./rateLimit";
import { creditCash, lockWallet } from "./wallet";

export const METHOD_LABEL: Record<PayMethod, string> = { ecocash: "EcoCash", onemoney: "OneMoney", card: "Visa / Mastercard" };

const fail = (code: string, message: string) => new ApiError(400, code, message);
const PAID = new Set(["paid", "awaiting delivery", "delivered"]);
const FAILED = new Set(["cancelled", "failed"]);
const REVERSED = new Set(["refunded", "disputed"]);

type PaymentRow = {
  id: string; reference: string; userId: string; method: string; phone: string | null; amountCents: number; status: string; paynowStatus: string;
  paynowReference: string | null; pollUrl: string | null; browserUrl: string | null; instructions: string | null; error: string | null;
  flag: string | null; createdAt: Date; lastCheckedAt: Date | null; creditedAt: Date | null;
};

export function paymentDto(p: PaymentRow, simulated = false): PaymentDto {
  const status = (["pending", "paid", "failed", "cancelled"].includes(p.status) ? p.status : "pending") as PaymentDto["status"];
  return {
    ref: p.reference,
    status,
    amount: p.amountCents / 100,
    method: p.method as PaymentDto["method"],
    instructions: status === "pending" ? p.instructions : null,
    redirectUrl: status === "pending" && p.method === "card" ? p.browserUrl : null,
    message:
      status === "failed" ? "The payment didn't go through. You haven't been charged." : status === "cancelled" ? "The payment was cancelled. You haven't been charged." : null,
    simulated,
  };
}

const newReference = () => {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += A[randomInt(A.length)];
  return `VRC-${s}`;
};

/** Customer-safe wording for a Paynow refusal. The real reason is kept for the admin. */
const friendly = (raw: string) =>
  /insufficient|balance|funds/i.test(raw) ? "That wallet doesn't have enough money for this payment." : "We couldn't start that payment. Check the number and try again.";

/** Begins a payment: records it, asks Paynow to take the money, and returns what the customer should see next. */
export async function startPayment(userId: string, input: { amountCents: number; method: PayMethod; phone: string | null }): Promise<PaymentDto> {
  const { amountCents, method } = input;
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 20_000) throw fail("bad_amount", "Enter an amount from $1 to $200.");
  let phone: string | null = null;
  if (method !== "card") {
    const raw = input.phone ?? "";
    if (method === "ecocash" && !isEcocash(raw)) throw fail("bad_phone", "Enter a valid EcoCash number (077 or 078).");
    if (method === "onemoney" && !isOnemoney(raw)) throw fail("bad_phone", "Enter a valid OneMoney number (071).");
    phone = normalizePhone(raw);
  }
  const cfg = paynowConfig(); // refuses early (503) if payments aren't set up
  await enforce(`pay-start:${userId}`, 8, 3_600_000); // each attempt can pop up a request on a phone

  const recent = await db.payment.count({ where: { userId, status: "pending", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } } });
  if (recent >= 3) throw fail("too_many_pending", "You already have payments waiting. Finish or wait for them before starting another.");

  const reference = newReference();
  const row = await db.payment.create({ data: { reference, userId, method, phone, amountCents } });
  const r = await paynowInitiate({ reference, amountCents, method, phone });
  if (!r.ok) {
    await db.payment.update({ where: { id: row.id }, data: { status: "failed", error: r.error.slice(0, 300), paynowStatus: "Error" } });
    console.error("[paynow] initiate failed for", reference, r.error);
    throw fail("payment_failed", friendly(r.error));
  }
  const updated = await db.payment.update({
    where: { id: row.id },
    data: { pollUrl: r.pollUrl, browserUrl: r.browserUrl, instructions: r.instructions, paynowReference: r.paynowReference, paynowStatus: r.status },
  });
  return paymentDto(updated, cfg.mode === "simulated");
}

/**
 * Applies what Paynow says about a payment. This is the ONLY place credits are added for a Paynow payment.
 * - The wallet is locked first (same order as everything else), then the payment is re-read.
 * - Credits are added once: the claim (creditedAt null -> set) and the ledger entry are in one transaction.
 * - The amount Paynow reports must equal the amount we asked for.
 */
export async function applyStatus(paymentId: string, f: Polled): Promise<void> {
  await db.$transaction(async (tx) => {
    const first = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!first) return;
    await lockWallet(tx, first.userId);
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p || f.reference !== p.reference) return;
    const s = f.status.trim().toLowerCase();

    if (PAID.has(s)) {
      if (p.creditedAt) {
        await tx.payment.update({ where: { id: p.id }, data: { paynowStatus: f.status } });
        return;
      }
      if (amountToCents(f.amount) !== p.amountCents) {
        await tx.payment.update({ where: { id: p.id }, data: { paynowStatus: f.status, flag: "amount_mismatch" } });
        await audit({ actorRole: "system", action: "payment_flagged", target: p.reference, detail: `Paynow says paid "${f.amount}" but we asked for ${(p.amountCents / 100).toFixed(2)}. Not credited.` }, tx);
        return;
      }
      const now = new Date();
      const claim = await tx.payment.updateMany({
        where: { id: p.id, creditedAt: null },
        data: { creditedAt: now, paidAt: now, status: "paid", paynowStatus: f.status, paynowReference: f.paynowReference ?? p.paynowReference, flag: null },
      });
      if (claim.count !== 1) return;
      await creditCash(tx, p.userId, p.amountCents, { kind: "topup", title: `Top up · ${METHOD_LABEL[p.method as PayMethod] ?? p.method}`, refId: `paynow-${p.id}` });
      await audit({ actorId: p.userId, actorRole: "system", action: "payment_credited", target: p.reference, detail: `$${(p.amountCents / 100).toFixed(2)} via ${p.method}` }, tx);
      return;
    }

    if (FAILED.has(s)) {
      if (!p.creditedAt && p.status === "pending") await tx.payment.update({ where: { id: p.id }, data: { status: s === "cancelled" ? "cancelled" : "failed", paynowStatus: f.status } });
      return;
    }

    if (REVERSED.has(s)) {
      // money was taken back after we credited: a person decides what to do about the credits
      if (p.creditedAt && p.flag !== "reversed_after_credit") {
        await tx.payment.update({ where: { id: p.id }, data: { paynowStatus: f.status, flag: "reversed_after_credit" } });
        await audit({ actorRole: "system", action: "payment_flagged", target: p.reference, detail: `Paynow now says "${f.status}" after the credits were added. Check the customer's wallet.` }, tx);
      }
      return;
    }

    if (p.status === "pending" && p.paynowStatus !== f.status) await tx.payment.update({ where: { id: p.id }, data: { paynowStatus: f.status } });
  });
}

/** Asks Paynow about a pending payment and applies the answer. At most one check per `minGapMs`, however many callers ask. */
export async function refreshPayment(paymentId: string, minGapMs = 4000): Promise<void> {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status === "paid" || !p.pollUrl) return;
  if (p.status !== "pending" && Date.now() - p.createdAt.getTime() > 7 * 86_400_000) return; // stop chasing old failures
  const gate = new Date(Date.now() - minGapMs);
  const claim = await db.payment.updateMany({
    where: { id: p.id, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: gate } }] },
    data: { lastCheckedAt: new Date() },
  });
  if (claim.count !== 1) return;
  const polled = await paynowPoll(p);
  if (polled) await applyStatus(p.id, polled);
}

/** Customer-facing status of one of their own payments (after checking with Paynow if it is still waiting). */
export async function paymentStatusFor(userId: string, reference: string): Promise<PaymentDto> {
  const p = await db.payment.findUnique({ where: { reference } });
  if (!p || p.userId !== userId) throw new ApiError(404, "not_found", "Payment not found.");
  await refreshPayment(p.id);
  const fresh = await db.payment.findUnique({ where: { id: p.id } });
  return paymentDto(fresh ?? p, isSimulated());
}

/** Best-effort: settle this customer's waiting payments (used when their app loads, in case Paynow's message never reached us). */
export async function settlePending(userId: string): Promise<void> {
  try {
    const waiting = await db.payment.findMany({ where: { userId, status: "pending", createdAt: { gte: new Date(Date.now() - 6 * 3_600_000) } }, orderBy: { createdAt: "desc" }, take: 3 });
    for (const p of waiting) await refreshPayment(p.id, 15_000);
  } catch (e) {
    console.error("[payments] settlePending", e);
  }
}

/**
 * Paynow's message to our result URL. Never trusted on its own:
 *  1. the hash must match (only Paynow knows the key),
 *  2. then we ask Paynow directly, using the status address WE stored, what really happened,
 *  3. and only that answer is applied.
 * Unknown references are acknowledged and ignored. If Paynow can't be reached we answer with an error so it retries.
 */
export async function handlePaynowResult(body: string): Promise<void> {
  const cfg = paynowConfig();
  if (cfg.mode !== "live") throw new ApiError(404, "not_found", "Not found.");
  const fields = parseForm(body);
  if (!hashIsValid(fields, cfg.key)) throw new ApiError(400, "bad_request", "Invalid message.");
  const reference = fields.find(([k]) => k.toLowerCase() === "reference")?.[1];
  if (!reference || reference.length > 64) throw new ApiError(400, "bad_request", "Invalid message.");
  const p = await db.payment.findUnique({ where: { reference } });
  if (!p) return;
  const polled = await paynowPoll(p);
  if (!polled) throw new ApiError(503, "unavailable", "Try again shortly."); // Paynow will resend
  await applyStatus(p.id, polled);
}

/** Admin: check a payment with Paynow right now, whatever its age. */
export async function adminCheckPayment(adminId: string, reference: string): Promise<void> {
  const p = await db.payment.findUnique({ where: { reference } });
  if (!p) throw fail("not_found", "Payment not found.");
  if (!p.pollUrl) throw fail("no_poll", "This payment never reached Paynow, so there is nothing to check.");
  const polled = await paynowPoll(p);
  if (!polled) throw fail("unreachable", "Couldn't get an answer from Paynow. Try again in a minute.");
  await applyStatus(p.id, polled);
  await audit({ actorId: adminId, actorRole: "admin", action: "payment_checked", target: reference, detail: `Paynow says: ${polled.status}` });
}
