const pad = (n: number) => String(n).padStart(2, "0");

/** 7384000 -> "02:03:04" */
export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Remaining time as "21h 12m" or "42m". */
export function fmtLeft(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** Elapsed time as "2h 03m" or "14m". */
export function fmtSpan(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${pad(m % 60)}m` : `${m}m`;
}

export const HOUR = 3_600_000;
