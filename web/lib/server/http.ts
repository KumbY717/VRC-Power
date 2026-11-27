// Small helpers shared by every API route. Standard Request/Response only, so routes are easy to test.

export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const tooMany = (retryAfter: number) =>
  new ApiError(429, "rate_limited", `Too many attempts. Try again in ${retryAfter}s.`, { retryAfter });

type JsonInit = { status?: number; cookies?: string[]; headers?: Record<string, string> };

export function json(body: unknown, init: JsonInit = {}): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", ...init.headers });
  for (const c of init.cookies ?? []) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

/** Browsers always send Origin on POSTs. A request from another site is refused (CSRF defence). */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host).split(",")[0].trim();
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host : "";
  } catch {
    /* falls through */
  }
  if (!originHost || !host || originHost !== host) throw new ApiError(403, "forbidden", "Request blocked.");
}

/**
 * Wraps a route: blocks cross-site writes, turns ApiError into a clean JSON error, and hides
 * unexpected errors behind a generic message (details go to the server log only).
 * Server-to-server callers (Paynow webhook, stations) pass { csrf: false } and authenticate another way.
 */
export function route(fn: (req: Request) => Promise<Response>, opts: { csrf?: boolean } = {}) {
  return async (req: Request): Promise<Response> => {
    try {
      if (opts.csrf !== false && !["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await fn(req);
    } catch (e) {
      if (e instanceof ApiError) {
        const headers: Record<string, string> = {};
        if (typeof e.extra.retryAfter === "number") headers["Retry-After"] = String(e.extra.retryAfter);
        return json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status, headers });
      }
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return json({ error: { code: "server", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  };
}

export async function readJson(req: Request, maxBytes = 16_000): Promise<Record<string, unknown>> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new ApiError(415, "bad_request", "Send JSON.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "bad_request", "Request too large.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(400, "bad_request", "That request wasn't valid.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "bad_request", "That request wasn't valid.");
  return data as Record<string, unknown>;
}

/** A trimmed string of min..max characters, or null. */
export function str(v: unknown, min: number, max: number, opts: { trim?: boolean } = {}): string | null {
  if (typeof v !== "string") return null;
  const s = opts.trim === false ? v : v.trim();
  return s.length >= min && s.length <= max ? s : null;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Behind a proxy (Vercel, Nginx) the real address is in a header. */
export function clientIp(req: Request): string {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  return ip.trim().slice(0, 64);
}

export const bad = (message = "Please check the details and try again.") => new ApiError(400, "bad_request", message);
