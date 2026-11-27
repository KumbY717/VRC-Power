import type { Prisma } from "@prisma/client";
import { ApiError } from "./http";

// All money moves through this file. Rules:
//  - amounts are whole cents
//  - every change writes exactly one ledger row, in the same transaction as the balance change
//  - a balance can never go below zero (the whole transaction is rolled back if it would)
//  - promo credits are spent before cash credits

export type Tx = Prisma.TransactionClient;
export type LedgerKind = "topup" | "rental" | "purchase" | "overdue" | "refund" | "adjust";
export type WalletRow = { cashCents: number; promoCents: number };
type Meta = { kind: LedgerKind; title: string; note?: string; refId?: string | null };

export const totalCents = (w: WalletRow) => w.cashCents + w.promoCents;

/**
 * Creates the wallet if needed and takes a row lock on it. Call this FIRST in every transaction that
 * touches a user's money or rental, so two requests for the same person run one after the other
 * (Postgres makes the second wait here; SQLite already runs one write at a time).
 */
export async function lockWallet(tx: Tx, userId: string): Promise<WalletRow> {
  return tx.wallet.upsert({ where: { userId }, create: { userId }, update: { updatedAt: new Date() } });
}

async function post(tx: Tx, userId: string, cashCents: number, promoCents: number, m: Meta) {
  const w = await tx.wallet.update({
    where: { userId },
    data: { cashCents: { increment: cashCents }, promoCents: { increment: promoCents } },
  });
  if (w.cashCents < 0 || w.promoCents < 0) throw new ApiError(400, "low_balance", "Not enough credits.");
  await tx.ledgerEntry.create({
    data: { userId, kind: m.kind, title: m.title, note: m.note ?? "", amountCents: cashCents + promoCents, cashCents, promoCents, refId: m.refId ?? null },
  });
}

/** Adds money that was really paid (a verified Paynow payment, or cash handed to an agent). */
export async function creditCash(tx: Tx, userId: string, cents: number, m: Meta): Promise<void> {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("creditCash needs a positive whole number of cents");
  await lockWallet(tx, userId);
  await post(tx, userId, cents, 0, m);
}

/** Adds promo credit. Spent first, never refundable. */
export async function creditPromo(tx: Tx, userId: string, cents: number, m: Meta): Promise<void> {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("creditPromo needs a positive whole number of cents");
  await lockWallet(tx, userId);
  await post(tx, userId, 0, cents, m);
}

/** Takes money back out of the cash credits only (a refund). Never touches promo credits. */
export async function refundCash(tx: Tx, userId: string, cents: number, m: Meta): Promise<void> {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("refundCash needs a positive whole number of cents");
  const w = await lockWallet(tx, userId);
  if (w.cashCents < cents) throw new ApiError(400, "low_balance", "Only unspent cash credits can be refunded.");
  await post(tx, userId, -cents, 0, m);
}

/**
 * Takes `cents` from the wallet (promo first). With upTo it takes what is there when the balance is lower.
 * Returns how much was actually taken.
 */
export async function debit(tx: Tx, userId: string, cents: number, m: Meta, opts: { upTo?: boolean } = {}): Promise<number> {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("debit needs a whole number of cents");
  const w = await lockWallet(tx, userId);
  const avail = totalCents(w);
  const take = opts.upTo ? Math.min(cents, avail) : cents;
  if (take > avail) throw new ApiError(400, "low_balance", "Not enough credits.");
  if (take === 0) return 0;
  const promo = Math.min(w.promoCents, take);
  await post(tx, userId, -(take - promo), -promo, m);
  return take;
}
