export const cleanPhone = (s: string) => s.replace(/[\s-]/g, "");

/** Any accepted spelling (+263 77..., 077...) as national format: 0771234567. */
export const normalizePhone = (s: string) => {
  const c = cleanPhone(s);
  return c.startsWith("+263") ? `0${c.slice(4)}` : c;
};

/** Zimbabwe mobile: 07x xxx xxxx or +263 7x xxx xxxx */
export const isZwMobile = (s: string) => /^(?:\+263|0)7[1-9]\d{7}$/.test(cleanPhone(s));
/** EcoCash is Econet: 077 / 078 */
export const isEcocash = (s: string) => /^(?:\+263|0)7[78]\d{7}$/.test(cleanPhone(s));
/** OneMoney is NetOne: 071 */
export const isOnemoney = (s: string) => /^(?:\+263|0)71\d{7}$/.test(cleanPhone(s));

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function maskNumber(s: string) {
  const c = cleanPhone(s);
  const head = c.startsWith("+263") ? "+263" : c.slice(0, 3);
  return `${head} ••• ${c.slice(-4)}`;
}

/** 0 (empty) to 4 (strong) */
export function passwordScore(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, Math.max(1, s));
}

/** "14 Nov 2026" and "15:40" in Harare time (CAT), regardless of the device zone. */
export const fmtDate = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", day: "numeric", month: "short", year: "numeric" }).format(ms);
export const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", hour: "2-digit", minute: "2-digit" }).format(ms);
