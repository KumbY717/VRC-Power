// The browser's way to call our own server. Never throws: always returns ok or a described failure.

export type ApiOk<T> = { ok: true; data: T };
export type ApiFail = { ok: false; status: number; code: string; message: string; retryAfter?: number; triesLeft?: number };

function readError(json: unknown): { code?: string; message?: string; retryAfter?: number; triesLeft?: number } {
  if (!json || typeof json !== "object") return {};
  const e = (json as { error?: unknown }).error;
  if (!e || typeof e !== "object") return {};
  const o = e as Record<string, unknown>;
  return {
    code: typeof o.code === "string" ? o.code : undefined,
    message: typeof o.message === "string" ? o.message : undefined,
    retryAfter: typeof o.retryAfter === "number" ? o.retryAfter : undefined,
    triesLeft: typeof o.triesLeft === "number" ? o.triesLeft : undefined,
  };
}

export async function callApi<T = unknown>(path: string, body?: unknown): Promise<ApiOk<T> | ApiFail> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (res.ok) return { ok: true, data: json as T };
    const e = readError(json);
    return { ok: false, status: res.status, code: e.code ?? "server", message: e.message ?? "Something went wrong. Please try again.", retryAfter: e.retryAfter, triesLeft: e.triesLeft };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Can't reach the server. Check your connection and try again." };
  }
}
