import { createHash } from "node:crypto";
import { ApiError } from "./http";
import { safeEqualHex } from "./crypto";

/**
 * Talking to Paynow (https://developers.paynow.co.zw). Two modes:
 *  - live:      the real Paynow. Needs PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY, PAYNOW_AUTH_EMAIL and APP_URL.
 *  - simulated: no network. Pretends to be Paynow using its documented test numbers. Development only.
 * Which one is used comes from PAYNOW_MODE; if unset it is "simulated" in development and "live" in production.
 * Simulated mode is refused in production, so a forgotten setting can never hand out free credits.
 */

export type Fields = [string, string][];

const PAYNOW_HOST = /(^|\.)paynow\.co\.zw$/i;
const INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const REMOTE_URL = "https://www.paynow.co.zw/interface/remotetransaction";

/** SHA-512 of the values joined with nothing between them, then the integration key, as upper-case hex. */
export function makeHash(values: string[], key: string): string {
  return createHash("sha512").update(values.join("") + key, "utf8").digest("hex").toUpperCase();
}

/** Splits "a=1&b=2" into decoded pairs, keeping Paynow's order (the order matters for the hash). */
export function parseForm(text: string): Fields {
  return Array.from(new URLSearchParams(text).entries());
}

/** Checks a message from Paynow: hash of every value except "hash" (in order) + key, compared in constant time. */
export function hashIsValid(fields: Fields, key: string): boolean {
  const sent = fields.find(([k]) => k.toLowerCase() === "hash")?.[1];
  if (!sent || !key) return false;
  const expected = makeHash(fields.filter(([k]) => k.toLowerCase() !== "hash").map(([, v]) => v), key);
  return safeEqualHex(expected, sent.toUpperCase());
}

const get = (f: Fields, name: string) => f.find(([k]) => k.toLowerCase() === name)?.[1];

export type PaynowConfig =
  | { mode: "simulated" }
  | { mode: "live"; id: string; key: string; authEmail: string; appUrl: string };

/** Reads the settings fresh each time. Throws a 503 (customer-safe message, real reason in the server log) if payments aren't set up. */
export function paynowConfig(): PaynowConfig {
  const prod = process.env.NODE_ENV === "production";
  const mode = (process.env.PAYNOW_MODE || (prod ? "live" : "simulated")).toLowerCase();
  const unavailable = (why: string) => {
    console.error("[paynow] payments unavailable:", why);
    return new ApiError(503, "payments_unavailable", "Card and mobile payments aren't available right now. Please try again later.");
  };
  if (mode === "simulated") {
    if (prod) throw unavailable("PAYNOW_MODE=simulated is not allowed in production");
    return { mode: "simulated" };
  }
  if (mode !== "live") throw unavailable(`PAYNOW_MODE must be "live" or "simulated", got "${mode}"`);
  const id = process.env.PAYNOW_INTEGRATION_ID ?? "";
  const key = process.env.PAYNOW_INTEGRATION_KEY ?? "";
  const authEmail = process.env.PAYNOW_AUTH_EMAIL ?? "";
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const missing = [!id && "PAYNOW_INTEGRATION_ID", !key && "PAYNOW_INTEGRATION_KEY", !authEmail && "PAYNOW_AUTH_EMAIL", !appUrl && "APP_URL"].filter(Boolean);
  if (missing.length) throw unavailable(`missing ${missing.join(", ")}`);
  if (prod && !appUrl.startsWith("https://")) throw unavailable("APP_URL must be https in production");
  return { mode: "live", id, key, authEmail, appUrl };
}

export const isSimulated = () => paynowConfig().mode === "simulated";

export type PayMethod = "ecocash" | "onemoney" | "card";
export type PaymentLike = { reference: string; method: string; phone: string | null; amountCents: number; pollUrl: string | null; createdAt: Date };

export type Initiated =
  | { ok: true; status: string; pollUrl: string; browserUrl: string | null; instructions: string | null; paynowReference: string | null }
  | { ok: false; error: string };

export type Polled = { reference: string; paynowReference: string | null; amount: string; status: string };

const SIM_PHONES = { delayed: "0772222222", cancelled: "0773333333", broke: "0774444444" };

const httpsPaynow = (u: string | null | undefined): u is string => {
  if (!u) return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" && PAYNOW_HOST.test(p.hostname);
  } catch {
    return false;
  }
};

async function post(url: string, fields: Fields): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  return await res.text();
}

/** Starts a payment. Never throws for a Paynow-side problem: returns { ok: false } so the caller can record it. */
export async function paynowInitiate(p: { reference: string; amountCents: number; method: PayMethod; phone: string | null }): Promise<Initiated> {
  const cfg = paynowConfig();

  if (cfg.mode === "simulated") {
    if (p.phone === SIM_PHONES.broke) return { ok: false, error: "Insufficient balance (simulated test number)" };
    return {
      ok: true,
      status: "Sent",
      pollUrl: `sim://${p.reference}`,
      browserUrl: p.method === "card" ? `/?paynow=${p.reference}&sim=1` : null,
      instructions: p.method === "card" ? null : "Simulated payment: it approves itself in a few seconds.",
      paynowReference: `SIM-${p.reference}`,
    };
  }

  const mobile = p.method !== "card";
  const fields: Fields = [
    ["id", cfg.id],
    ["reference", p.reference],
    ["amount", (p.amountCents / 100).toFixed(2)],
    ["additionalinfo", "VRC Power credits"],
    ["returnurl", `${cfg.appUrl}/?paynow=${encodeURIComponent(p.reference)}`],
    ["resulturl", `${cfg.appUrl}/api/paynow/result`],
    ["authemail", cfg.authEmail],
  ];
  if (mobile) fields.push(["phone", p.phone ?? ""], ["method", p.method]);
  fields.push(["status", "Message"]);
  fields.push(["hash", makeHash(fields.map(([, v]) => v), cfg.key)]);

  let text: string;
  try {
    text = await post(mobile ? REMOTE_URL : INITIATE_URL, fields);
  } catch (e) {
    return { ok: false, error: `Could not reach Paynow: ${(e as Error).message}` };
  }
  const back = parseForm(text);
  const status = get(back, "status") ?? "";
  if (status.toLowerCase() === "error") return { ok: false, error: get(back, "error") ?? "Paynow refused the request" };
  if (status.toLowerCase() !== "ok") return { ok: false, error: "Unexpected answer from Paynow" };
  if (!hashIsValid(back, cfg.key)) return { ok: false, error: "Paynow's answer failed the security check" };

  const pollUrl = get(back, "pollurl");
  const browserUrl = get(back, "browserurl") ?? null;
  if (!httpsPaynow(pollUrl)) return { ok: false, error: "Paynow gave an unexpected status address" };
  if (!mobile && !httpsPaynow(browserUrl)) return { ok: false, error: "Paynow gave an unexpected payment page address" };
  return { ok: true, status, pollUrl, browserUrl: mobile ? null : browserUrl, instructions: get(back, "instructions") ?? null, paynowReference: get(back, "paynowreference") ?? null };
}

/** Asks Paynow what really happened. Returns null if it can't be reached or the answer isn't trustworthy. */
export async function paynowPoll(p: PaymentLike): Promise<Polled | null> {
  const cfg = paynowConfig();

  if (cfg.mode === "simulated") {
    const age = Date.now() - p.createdAt.getTime();
    let status: string;
    if (p.method === "card" || !p.phone) status = age >= 5000 ? "Paid" : "Created";
    else if (p.phone === SIM_PHONES.delayed) status = age >= 30_000 ? "Paid" : "Sent";
    else if (p.phone === SIM_PHONES.cancelled) status = age >= 30_000 ? "Cancelled" : "Sent";
    else status = age >= 5000 ? "Paid" : "Sent";
    return { reference: p.reference, paynowReference: `SIM-${p.reference}`, amount: (p.amountCents / 100).toFixed(2), status };
  }

  if (!httpsPaynow(p.pollUrl)) return null; // only ever poll an address Paynow itself gave us, and that we stored
  let text: string;
  try {
    text = await post(p.pollUrl, []);
  } catch {
    return null;
  }
  const back = parseForm(text);
  if (!hashIsValid(back, cfg.key)) return null;
  const reference = get(back, "reference");
  const status = get(back, "status");
  const amount = get(back, "amount");
  if (!reference || !status || amount === undefined) return null;
  return { reference, paynowReference: get(back, "paynowreference") ?? null, amount, status };
}

/** "15.00" -> 1500. Null for anything that isn't a plain amount with at most 2 decimals. */
export function amountToCents(s: string | null | undefined): number | null {
  if (!s || !/^\d{1,7}(\.\d{1,2})?$/.test(s.trim())) return null;
  return Math.round(Number(s.trim()) * 100);
}
