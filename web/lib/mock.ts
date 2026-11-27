// Mock data for the UI. Replaced by real API calls when the backend is built.

import type { StationInventory } from "./appTypes";

export type StationStatus = "online" | "offline";

/** A station as the customer's screens use it: what the server knows, plus the distance from this phone (if located). */
export type Station = StationInventory & { distanceM: number | null };

/**
 * The prices the app shows. These are only the starting values: the app asks the server for the real ones
 * (see RulesSync in AppShell) and updates this object, so a change made in the admin dashboard shows everywhere.
 */
export const RULES: { ratePerHour: number; minBalance: number; outrightPrice: number; overdueHours: number } = {
  ratePerHour: 1,
  minBalance: 15,
  outrightPrice: 15,
  overdueHours: 24,
};

export const USER = {
  name: "Tendai",
  phone: "+263 77 123 4567",
  qr: "USER-4821",
  balance: 22.5,
};

export const readyCount = (s: { slots: (number | null)[] }) => s.slots.filter((c) => c !== null).length;

export const avgCharge = (s: { slots: (number | null)[] }) => {
  const c = s.slots.filter((v): v is number => v !== null);
  return c.length ? Math.round(c.reduce((a, b) => a + b, 0) / c.length) : 0;
};

export const isAvailable = (s: { status: StationStatus; slots: (number | null)[] }) => s.status === "online" && readyCount(s) > 0;

export const money = (n: number) => `$${n.toFixed(2)}`;
