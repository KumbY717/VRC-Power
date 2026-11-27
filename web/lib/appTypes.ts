// The shapes the server sends and the app shows. Money here is in dollars (credits); the database keeps cents.

// refunds and admin adjustments are added when the admin dashboard goes live
export type TxnKind = "rental" | "topup" | "purchase" | "overdue";

export type TxnDto = {
  id: string;
  kind: TxnKind;
  title: string;
  /** positive = credits in, negative = credits out */
  amount: number;
  at: number;
  note?: string;
};

export type RentalDto = {
  id: string;
  stationId: string;
  stationName: string;
  /** 1-based slot number shown to the user */
  slot: number;
  serial: string;
  startCharge: number;
  startedAt: number;
  /** the terms this rental started under: dollars per hour, hours until it becomes a purchase, dollars forfeited */
  rate: number;
  overdueHours: number;
  outright: number;
};

export type StationInventory = {
  id: string;
  /** text on the QR sticker */
  code: string;
  name: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  status: "online" | "offline";
  /** one entry per slot: charge % of the docked power bank, or null when empty */
  slots: (number | null)[];
};

export type ReceiptDto = {
  rental: RentalDto;
  hours: number;
  durationMs: number;
  charged: number;
  returnedAt: string;
  balanceAfter: number;
};

export type StateDto = {
  /** server clock, so the timer is right even if the phone's clock is wrong */
  now: number;
  accountCode: string;
  balance: number;
  cash: number;
  promo: number;
  rental: RentalDto | null;
  history: TxnDto[];
  stations: StationInventory[];
  notice: { stationName: string; amount: number } | null;
};

/* ------------------------------------------------------------------ agent app */

export type AgentEntryDto = {
  id: string;
  kind: "topup" | "sale";
  /** customer code, e.g. USER-482193 */
  customer: string;
  customerName: string;
  /** cash received = credits sent */
  amount: number;
  commission: number;
  at: number;
};

export type ReportDto = {
  id: string;
  startedAt: number;
  endedAt: number;
  assigned: number;
  given: number;
  expectedCash: number;
  countedCash: number;
  diff: number;
  txnCount: number;
  earned: number;
};

export type AgentStateDto = {
  now: number;
  profile: {
    name: string;
    venue: string;
    event: string;
    stationIds: string[];
    baseAllowance: number;
    /** 0.05 = 5% of every cash top-up */
    commissionRate: number;
    saleBonus: number;
  };
  /** credits still available to hand out */
  float: number;
  shift: {
    id: string;
    startedAt: number;
    /** float when the shift started */
    assigned: number;
    entries: AgentEntryDto[];
    given: number;
    commissionTotal: number;
    earned: number;
  } | null;
  reports: ReportDto[];
  /** earnings for the 6 days before today */
  week: { d: string; v: number }[];
  payouts: { id: string; at: number; amount: number; note: string }[];
  /** development only: customer codes to try the scanner with */
  demoCustomers: string[];
  /** the stations this agent works at, with what is in them now */
  stations: StationInventory[];
};

/* ------------------------------------------------------------------ admin dashboard */

export type AdminRulesDto = {
  ratePerHour: number;
  minBalance: number;
  outrightPrice: number;
  overdueHours: number;
  /** percent of cash top-ups, e.g. 5 */
  commissionPct: number;
  baseAllowance: number;
  saleBonus: number;
};

export type AdminAgentDto = {
  id: string;
  name: string;
  phone: string;
  venue: string;
  event: string;
  stationIds: string[];
  active: boolean;
  onShift: boolean;
  floatLeft: number;
  /** the float the agent started the current (or last) shift with, for the bar */
  floatAssigned: number;
  /** cash count difference of the last shifts, newest first (0 = matched) */
  recon: number[];
  earnedTotal: number;
  paidTotal: number;
  /** earned but not yet paid */
  owed: number;
  payouts: { id: string; at: number; amount: number; note: string }[];
};

export type AdminCustomerDto = {
  id: string;
  code: string;
  name: string;
  phone: string;
  /** credits bought with real money (refundable) */
  cash: number;
  /** promo / voucher credits (never refundable) */
  promo: number;
  rentals: number;
  /** has had a power bank turned into a purchase */
  flagged: boolean;
  active: boolean;
  joinedAt: number;
};

export type AdminRentalDto = {
  id: string;
  customer: string;
  customerName: string;
  station: string;
  slot: number;
  serial: string;
  startedAt: number;
  endedAt?: number;
  returnedAt?: string;
  status: "active" | "returned" | "converted";
  overdueHours: number;
  outright: number;
};

export type AdminTopupDto = { id: string; ref: string; customer: string; customerName: string; method: string; amount: number; at: number };
export type AdminAuditDto = { id: string; at: number; actor: string; action: string; target: string; detail: string };
export type AdminSessionDto = { id: string; who: string; role: string; device: string; ip: string; lastSeen: number; current: boolean };

export type AdminStationDto = {
  id: string;
  code: string;
  name: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  /** false while the position is still the starting placeholder */
  placed: boolean;
  status: "online" | "offline";
  /** per slot: the power bank in it, or null when empty */
  slots: ({ serial: string; charge: number } | null)[];
};

export type AdminCommandDto = { id: string; station: string; slot: number; status: string; reason: string; by: string; at: number };

export type AdminStateDto = {
  now: number;
  rules: AdminRulesDto;
  counts: { customers: number; activeRentals: number; agentsOnShift: number; agentsActive: number };
  /** credits owed to customers, in dollars */
  outstanding: number;
  /** cash top-ups per day for the last 14 days, oldest first */
  revenue: number[];
  agents: AdminAgentDto[];
  /** the newest customers; use the search for the rest */
  customers: AdminCustomerDto[];
  rentals: AdminRentalDto[];
  topups: AdminTopupDto[];
  payments: AdminPaymentDto[];
  audit: AdminAuditDto[];
  sessions: AdminSessionDto[];
  stations: AdminStationDto[];
  commands: AdminCommandDto[];
};

/* ------------------------------------------------------------------ payments (Paynow) */

export type PaymentDto = {
  ref: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  amount: number;
  method: "ecocash" | "onemoney" | "card";
  /** what to tell the payer while they approve on their phone */
  instructions: string | null;
  /** card payments: the Paynow page to send the payer to */
  redirectUrl: string | null;
  /** plain-words reason when it failed */
  message: string | null;
  /** true only in development: Paynow is being pretended */
  simulated: boolean;
};

export type AdminPaymentDto = {
  ref: string;
  paynowRef: string;
  customer: string;
  customerName: string;
  method: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  paynowStatus: string;
  /** a problem a person should look at, in plain words */
  flag: string | null;
  error: string | null;
  at: number;
};
