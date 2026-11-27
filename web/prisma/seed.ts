// Creates starter accounts. Run with:  ./vrc db
//  - Development: the three demo accounts shown on the login screen, a $22.50 starting balance for the
//    demo customer, and the six demo stations with their power banks.
//  - Production (NODE_ENV=production): only the first admin, from ADMIN_EMAIL and ADMIN_PASSWORD.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { isPlaceholder } from "../lib/geo";
import { DEMO_STATIONS } from "./demoStations";
import { hashPassword } from "../lib/server/crypto";
import { passwordProblem } from "../lib/server/policy";
import { creditCash } from "../lib/server/wallet";

const db = new PrismaClient();
const PROD = process.env.NODE_ENV === "production";

async function upsertUser(u: { role: string; name: string; phone?: string; email?: string; password: string }) {
  const where = u.email ? { email: u.email } : { phone: u.phone };
  const existing = await db.user.findFirst({ where });
  if (existing) {
    console.log(`  exists   ${u.role.padEnd(8)} ${u.email ?? u.phone}`);
    return existing;
  }
  const created = await db.user.create({
    data: { role: u.role, name: u.name, phone: u.phone ?? null, email: u.email ?? null, passwordHash: await hashPassword(u.password) },
  });
  console.log(`  created  ${u.role.padEnd(8)} ${u.email ?? u.phone}`);
  return created;
}

async function seedStations() {
  for (const m of DEMO_STATIONS) {
    const have = await db.station.findUnique({ where: { id: m.id } });
    if (have) {
      // stations from before real positions existed get their demo position (only if nobody has set one)
      if (isPlaceholder({ lat: have.lat, lng: have.lng })) {
        await db.station.update({ where: { id: m.id }, data: { lat: m.lat, lng: m.lng, address: have.address || m.address } });
        console.log(`  placed   station  ${m.id}`);
      } else {
        console.log(`  exists   station  ${m.id}`);
      }
      continue;
    }
    await db.station.create({ data: { id: m.id, code: m.code, name: m.name, venue: m.venue, address: m.address, lat: m.lat, lng: m.lng, status: m.status, slotCount: m.slots.length } });
    for (let i = 0; i < m.slots.length; i++) {
      const charge = m.slots[i];
      if (charge === null) continue;
      const serial = `PB-${m.code.slice(4)}-${i + 1}${randomBytes(2).toString("hex").toUpperCase()}`;
      await db.powerBank.create({ data: { serial, status: "docked", stationId: m.id, slot: i, charge } });
    }
    console.log(`  created  station  ${m.id}`);
  }
}

/** Gives the demo agent a venue and $100 of float, once. (Real agents get theirs from the admin dashboard.) */
async function seedAgent(userId: string) {
  if (await db.agentProfile.findUnique({ where: { userId } })) {
    console.log("  exists   agent profile");
    return;
  }
  await db.$transaction(async (tx) => {
    await tx.agentProfile.create({
      data: { userId, venue: "HICC Main Stage", event: "Harare Tech Expo", stationIds: "hicc,kopje", floatCents: 10_000 },
    });
    await tx.floatEntry.create({ data: { agentId: userId, kind: "issue", amountCents: 10_000, refId: "seed-float", note: "Starting float (demo)" } });
  });
  console.log("  created  agent profile with $100.00 float");
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const problem = passwordProblem(password);
    if (problem || password.length < 12) throw new Error("ADMIN_PASSWORD must be 12+ characters with letters and numbers, and not a common password.");
    await upsertUser({ role: "admin", name: "Super Admin", email, password });
  } else if (PROD) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin.");
  }

  if (!PROD) {
    const customer = await upsertUser({ role: "customer", name: "Tendai", phone: "0771234567", password: "Customer123" });
    if (!(await db.ledgerEntry.findFirst({ where: { userId: customer.id } }))) {
      await db.$transaction((tx) => creditCash(tx, customer.id, 2250, { kind: "topup", title: "Top up · EcoCash (demo)", refId: "seed-demo" }));
      console.log("  credited demo customer $22.50");
    }
    const agent = await upsertUser({ role: "agent", name: "Rudo", phone: "0782345678", password: "Agent1234" });
    await seedAgent(agent.id);
    await upsertUser({ role: "admin", name: "Super Admin", email: "admin@vrcpower.test", password: "Admin1234" });
    await seedStations();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
