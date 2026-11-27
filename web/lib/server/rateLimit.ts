import { db } from "./db";
import { tooMany } from "./http";

/**
 * Counts an attempt against `key`. The first `limit` attempts in a window pass; the rest are refused
 * until the window ends. Stored in the database so it works across restarts and several servers.
 */
export async function consume(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  if (Math.random() < 0.02) await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now) } } });
  return db.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key } });
    if (!row || row.resetAt.getTime() <= now) {
      const resetAt = new Date(now + windowMs);
      await tx.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: 1, resetAt } });
      return { ok: true, retryAfter: 0 };
    }
    if (row.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000)) };
    await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true, retryAfter: 0 };
  });
}

/** Counts an attempt and throws 429 when over the limit. */
export async function enforce(key: string, limit: number, windowMs: number): Promise<void> {
  const r = await consume(key, limit, windowMs);
  if (!r.ok) throw tooMany(r.retryAfter);
}

/** Seconds left on a block (0 = not blocked). Does not count an attempt. */
export async function blockedFor(key: string, limit: number): Promise<number> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.count < limit || row.resetAt.getTime() <= Date.now()) return 0;
  return Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
}

export async function clearLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
