import { db } from "./db";
import { ApiError } from "./http";
import { randomToken, sha256Hex } from "./crypto";

export type Role = "customer" | "agent" | "admin";
export type PublicUser = {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  mustChangePassword: boolean;
};
export type AuthedSession = { sessionId: string; user: PublicUser };

const PROD = process.env.NODE_ENV === "production";
// "__Host-" makes the browser refuse the cookie unless it is Secure, path "/" and has no Domain.
// It needs https, so development (plain http) uses a normal name.
const COOKIE = PROD ? "__Host-vrc" : "vrc_session";

const DAY = 86_400_000;
const TTL: Record<Role, number> = { customer: 30 * DAY, agent: 14 * DAY, admin: 12 * 3_600_000 };
const ADMIN_IDLE_MS = 60 * 60_000; // admins are signed out after an hour of no activity

export const toPublicUser = (u: { id: string; role: string; name: string; phone: string | null; email: string | null; mustChangePassword: boolean }): PublicUser => ({
  id: u.id,
  role: u.role as Role,
  name: u.name,
  phone: u.phone,
  email: u.email,
  mustChangePassword: u.mustChangePassword,
});

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Always makes a brand-new session at login (never reuses one), which blocks session fixation. */
export async function createSession(userId: string, role: Role, ip: string, userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TTL[role]);
  await db.session.create({
    data: { id: sha256Hex(token), userId, expiresAt, ip, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  if (Math.random() < 0.05) await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${PROD ? "; Secure" : ""}`;
}

export const clearedCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${PROD ? "; Secure" : ""}`;

export async function getSession(req: Request): Promise<AuthedSession | null> {
  const token = readCookie(req, COOKIE);
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = sha256Hex(token);
  const row = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!row) return null;
  const now = Date.now();
  const role = row.user.role as Role;
  const expired = row.expiresAt.getTime() <= now;
  const idle = role === "admin" && now - row.lastSeenAt.getTime() > ADMIN_IDLE_MS;
  if (expired || idle || row.user.status !== "active") {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (now - row.lastSeenAt.getTime() > 60_000) await db.session.update({ where: { id }, data: { lastSeenAt: new Date(now) } });
  return { sessionId: id, user: toPublicUser(row.user) };
}

/** For routes that need a signed-in user. Pass the roles allowed in. */
export async function requireSession(req: Request, roles?: Role[]): Promise<AuthedSession> {
  const s = await getSession(req);
  if (!s) throw new ApiError(401, "unauthenticated", "Please log in.");
  if (roles && !roles.includes(s.user.role)) throw new ApiError(403, "forbidden", "You don't have access to that.");
  return s;
}

export async function destroySession(req: Request): Promise<void> {
  const token = readCookie(req, COOKIE);
  if (token) await db.session.deleteMany({ where: { id: sha256Hex(token) } });
}
