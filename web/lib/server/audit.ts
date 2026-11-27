import { db } from "./db";
import type { Tx } from "./wallet";

export type AuditInput = {
  actorId?: string | null;
  actorRole: string; // "customer" | "agent" | "admin" | "system" | "anonymous"
  action: string;
  target?: string;
  detail?: string;
  ip?: string | null;
};

/**
 * Append-only. Nothing in the app edits or deletes these rows.
 * Inside a transaction, pass that transaction so the entry commits (or rolls back) together with the change it describes.
 */
export async function audit(e: AuditInput, client: Tx = db): Promise<void> {
  await client.auditLog.create({
    data: { actorId: e.actorId ?? null, actorRole: e.actorRole, action: e.action, target: e.target ?? "", detail: e.detail ?? "", ip: e.ip ?? null },
  });
}

/** For security events where failing to log must not break the user's request. */
export async function auditSafe(e: AuditInput): Promise<void> {
  try {
    await audit(e);
  } catch (err) {
    console.error("[audit] could not write", e.action, err);
  }
}
