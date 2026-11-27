import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

/* ------------------------------------------------------------------ passwords
   scrypt with a random salt per password (OWASP-recommended parameters).
   Stored as  scrypt$N$r$p$salt$hash  so parameters can be raised later and old hashes still verify. */
const N = 32768;
const R = 8;
const P = 3;
const KEYLEN = 32;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r + 16 * 1024 * 1024 };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

function parse(stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return null;
  const nn = Number(n);
  const rr = Number(r);
  const pp = Number(p);
  if (![nn, rr, pp].every(Number.isInteger) || nn < 2 || nn > 2 ** 17 || (nn & (nn - 1)) !== 0 || rr < 1 || rr > 16 || pp < 1 || pp > 16) return null;
  return { n: nn, r: rr, p: pp, salt: Buffer.from(salt, "base64"), hash: Buffer.from(hash, "base64") };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const s = parse(stored);
  if (!s) return false;
  const key = await derive(password, s.salt, s.n, s.r, s.p);
  return key.length === s.hash.length && timingSafeEqual(key, s.hash);
}

export const needsRehash = (stored: string) => {
  const s = parse(stored);
  return !s || s.n !== N || s.r !== R || s.p !== P;
};

let dummy: Promise<string> | null = null;
/** Burns the same time as a real check, so "no such user" and "wrong password" look alike. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummy ??= hashPassword("not-a-real-password");
  await verifyPassword(password, await dummy);
}

/* ------------------------------------------------------------------ tokens and codes */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set to 32+ characters in production.");
  return "dev-only-secret-do-not-use-in-production-0000";
}

export const makeOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
/** The database keeps this, never the code. Bound to the challenge so a code can't be moved between challenges. */
export const otpHash = (code: string, challengeId: string) =>
  createHmac("sha256", authSecret()).update(`${challengeId}|${code}`).digest("hex");

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
