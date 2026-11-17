// Seed data for the prototype — the single source of truth for this phase (kickoff §4.6).
// Ported from the original artifact and migrated to the 6-state tag lifecycle (§4.5):
//   Available (5) · Received (2) · Reserved (4) · Pending (3) · Shipped (2) · Discrepancy (2)
import type { ActivityEvent, ApprovalRequest, Client, FloorTask, SalesOrder, SalesOrderLineItem, SalesOrderStatus, Tag } from "./types";
import { DEFAULT_PRODUCT_TYPE, volumeOfTag } from "./products";

// ─── Rolling dates ────────────────────────────────────────────────────────────────
// The hand-written ("legacy") seed below was authored with fixed June 2026 dates. So the
// demo never goes stale — days-in-yard, "last 30 days" ranges and period-over-period
// comparisons all key off the real clock — every legacy date is shifted at load time so
// that SEED_ANCHOR (the legacy seed's "today") lands on the real today. The generated
// history further down is authored directly in "days ago" terms.
const SEED_ANCHOR = new Date(2026, 5, 5);
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();
const SHIFT_DAYS = Math.round((TODAY.getTime() - SEED_ANCHOR.getTime()) / 86_400_000);

const isoOf = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const stampOf = (d: Date, hhmm: string): string => `${MONTHS_SHORT[d.getMonth()]} ${pad2(d.getDate())} ${d.getFullYear()} ${hhmm}`;
function plusDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
// "days ago" helpers for the generated history (negative = in the future).
const agoIso = (n: number): string => isoOf(plusDays(TODAY, -n));
const agoStamp = (n: number, hhmm: string): string => stampOf(plusDays(TODAY, -n), hhmm);

// Legacy ISO date ("2026-06-01") → same offset from the real today.
function shiftIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(plusDays(new Date(y, m - 1, d), SHIFT_DAYS));
}
// Legacy display stamp ("Jun 01 2026 08:12") → same offset from the real today.
function shiftStamp(stamp: string): string {
  const m = stamp.match(/^([A-Za-z]{3}) (\d{2}) (\d{4}) (\d{2}:\d{2})$/);
  if (!m) return stamp;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return stamp;
  return stampOf(plusDays(new Date(Number(m[3]), monthIdx, Number(m[2])), SHIFT_DAYS), m[4]);
}

// ── Clock-relative helpers ───────────────────────────────────────────────────────
const NOW = new Date();
// A stamp `mins` minutes before the moment the app loaded — for "earlier today" events.
function minsAgoStamp(mins: number): string {
  const d = new Date(NOW.getTime() - mins * 60_000);
  return stampOf(d, `${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
}
function stampMs(stamp: string): number | null {
  const m = stamp.match(/^([A-Za-z]{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  return monthIdx < 0 ? null : new Date(Number(m[3]), monthIdx, Number(m[2]), Number(m[4]), Number(m[5])).getTime();
}
// "just now" / "12m ago" / "3h ago" / "2d ago" — the tag.updated convention. `minWord`
// switches to the activity feed's "12 min ago" spelling.
function relativeLabel(ms: number | null, minWord = false): string {
  if (ms === null) return "—";
  const mins = Math.max(0, Math.floor((NOW.getTime() - ms) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return minWord ? `${mins} min ago` : `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// The legacy `updated` strings below are placeholders — every tag's "updated" label is
// recomputed from its last history event when the seed is assembled (see initialTags).
// Lumber tags; `productType` is stamped on when the seed is assembled (see initialTags).
const LEGACY_TAGS: Omit<Tag, "productType">[] = [
  { id: "T-2026-0101", date: "2026-05-24", species: "SPF", grade: "#1", thick: 2, width: 4, length: 16, qty: 100, volume: 1067, state: "KD", milling: "STD", yard: "YD-A", section: "A-1", rack: "R-03", bin: "B2", status: "Available", updated: "11d ago", parentLog: "LOG-2024-0040", supplier: "In-house production", cost: 6.19, marketValue: 9.07, history: [{ e: "Received from production", t: "May 24 2026 08:12", w: "JS" }, { e: "Moved to A-1/R-03", t: "May 25 2026 10:30", w: "MK" }, { e: "Released — available to sell", t: "May 25 2026 10:31", w: "System" }] },
  { id: "T-2026-0102", date: "2026-05-29", species: "Doug Fir", grade: "Select", thick: 2, width: 6, length: 14, qty: 80, volume: 1120, state: "KD-HT", milling: "S4S", yard: "YD-A", section: "A-2", rack: "R-05", bin: "B1", status: "Available", updated: "5h ago", parentLog: null, supplier: "Pacific Saw Co.", cost: 12.32, marketValue: 17.08, history: [{ e: "Received", t: "May 29 2026 07:00", w: "TL" }, { e: "Moved to A-2/R-05", t: "May 30 2026 09:15", w: "JS" }, { e: "Released — available to sell", t: "May 30 2026 09:16", w: "System" }] },
  { id: "T-2026-0103", date: "2026-05-28", species: "Western Red Cedar", grade: "Clear", thick: 1, width: 6, length: 12, qty: 60, volume: 360, state: "KD", milling: "S4S", yard: "YD-A", section: "A-3", rack: "R-07", bin: "B3", status: "Reserved", updated: "1d ago", parentLog: null, supplier: "Cariboo Timber Ltd.", cost: 15.6, marketValue: 21.6, history: [{ e: "Received", t: "May 28 2026 14:00", w: "MK" }, { e: "Released — available to sell", t: "May 28 2026 14:30", w: "System" }, { e: "Reserved for @SO:L42@", t: "Jun 01 2026 11:00", w: "Admin" }] },
  { id: "T-2026-0104", date: "2026-05-27", species: "Hem-Fir", grade: "#2", thick: 2, width: 8, length: 16, qty: 120, volume: 2560, state: "GRN", milling: "RGH", yard: "YD-B", section: "B-1", rack: "R-09", bin: "B4", status: "Received", updated: "3h ago", parentLog: "LOG-2024-0041", supplier: "In-house production", cost: 9.39, marketValue: 13.65, history: [{ e: "Milled from LOG-2024-0041", t: "May 27 2026 06:30", w: "Factory" }, { e: "Received and scanned at B-1/R-09", t: "May 28 2026 08:00", w: "TL" }] },
  { id: "T-2026-0105", date: "2026-06-03", species: "SPF", grade: "#2", thick: 2, width: 4, length: 8, qty: 200, volume: 1067, state: "KD", milling: "STD", yard: "YD-A", section: "A-1", rack: "R-02", bin: "B1", status: "Available", updated: "30m ago", parentLog: null, supplier: "Pacific Saw Co.", cost: 2.24, marketValue: 3.31, history: [{ e: "Received", t: "Jun 03 2026 07:45", w: "JS" }, { e: "Released — available to sell", t: "Jun 03 2026 10:00", w: "System" }] },
  { id: "T-2026-0106", date: "2026-05-25", species: "Doug Fir", grade: "#1", thick: 4, width: 4, length: 16, qty: 45, volume: 960, state: "KD-HT", milling: "S4S", yard: "YD-B", section: "B-2", rack: "R-11", bin: "B2", status: "Shipped", updated: "1d ago", parentLog: "LOG-2024-0042", supplier: "In-house production", cost: 14.93, marketValue: 20.91, history: [{ e: "Milled from LOG-2024-0042", t: "May 25 2026 09:00", w: "Factory" }, { e: "Released — available to sell", t: "May 26 2026 08:00", w: "System" }, { e: "Reserved for @SO:L44@", t: "Jun 03 2026 15:00", w: "Admin" }, { e: "Shipped via @SO:L44@", t: "Jun 04 2026 16:00", w: "System" }] },
  { id: "T-2026-0107", date: "2026-06-02", species: "Western Red Cedar", grade: "#1", thick: 1, width: 4, length: 10, qty: 35, volume: 117, state: "KD", milling: "STD", yard: "YD-C", section: "C-1", rack: "R-13", bin: "B1", status: "Pending", updated: "1h ago", parentLog: null, supplier: "Westwood Forest Products", cost: 6.69, marketValue: 9.19, history: [{ e: "Created from delivery slip — awaiting receipt", t: "Jun 02 2026 11:00", w: "DW" }] },
  { id: "T-2026-0108", date: "2026-05-24", species: "SPF", grade: "MSR 1650", thick: 2, width: 6, length: 16, qty: 75, volume: 1200, state: "KD", milling: "S4S", yard: "YD-A", section: "A-4", rack: "R-01", bin: "B5", status: "Available", updated: "11d ago", parentLog: null, supplier: "Fraser Mills Lumber", cost: 9.92, marketValue: 14.4, history: [{ e: "Received", t: "May 24 2026 14:00", w: "TL" }, { e: "Moved to A-4/R-01", t: "May 25 2026 09:00", w: "JS" }, { e: "Released — available to sell", t: "May 25 2026 09:01", w: "System" }] },
  { id: "T-2026-0109", date: "2026-05-20", species: "Hem-Fir", grade: "#3", thick: 2, width: 10, length: 12, qty: 30, volume: 600, state: "GRN", milling: "RGH", yard: "YD-C", section: "C-2", rack: "R-14", bin: "B3", status: "Shipped", updated: "3d ago", parentLog: null, supplier: "Fraser Mills Lumber", cost: 7.2, marketValue: 10.4, history: [{ e: "Received", t: "May 20 2026 08:00", w: "TL" }, { e: "Released — available to sell", t: "May 20 2026 08:30", w: "System" }, { e: "Reserved for @SO:L41@", t: "May 28 2026 09:00", w: "Admin" }, { e: "Picked & scanned out the gate", t: "Jun 01 2026 15:00", w: "JS" }, { e: "Shipped via @SO:L41@", t: "Jun 01 2026 15:05", w: "System" }] },
  { id: "T-2026-0110", date: "2026-05-30", species: "SPF", grade: "#1", thick: 2, width: 6, length: 16, qty: 90, volume: 1440, state: "KD-HT", milling: "STD", yard: "YD-B", section: "B-3", rack: "R-10", bin: "B2", status: "Discrepancy", updated: "1d ago", parentLog: null, supplier: "Pacific Saw Co.", cost: 9.28, marketValue: 13.6, history: [{ e: "Received", t: "May 30 2026 10:00", w: "JS" }, { e: "Flagged: qty short 8 pcs on arrival", t: "May 30 2026 10:20", w: "JS" }] },
  { id: "T-2026-0111", date: "2026-06-02", species: "Doug Fir", grade: "#2", thick: 2, width: 8, length: 14, qty: 55, volume: 1027, state: "HT", milling: "STD", yard: "YD-A", section: "A-2", rack: "R-06", bin: "B4", status: "Received", updated: "1h ago", parentLog: null, supplier: "Westwood Forest Products", cost: 10.27, marketValue: 14.56, history: [{ e: "Received and scanned at A-2/R-06", t: "Jun 02 2026 13:30", w: "MK" }] },
  { id: "T-2026-0112", date: "2026-06-02", species: "SPF", grade: "#3", thick: 2, width: 4, length: 10, qty: 160, volume: 1067, state: "GRN", milling: "RGH", yard: "YD-C", section: "C-3", rack: "R-15", bin: "B1", status: "Pending", updated: "2h ago", parentLog: "LOG-2024-0043", supplier: "Westwood Forest Products", cost: 2.53, marketValue: 3.67, history: [{ e: "Created from delivery slip PO-2026-0091 — awaiting receipt", t: "Jun 02 2026 07:00", w: "DW" }] },
  { id: "T-2026-0113", date: "2026-06-01", species: "Western Red Cedar", grade: "Clear", thick: 1, width: 8, length: 12, qty: 25, volume: 200, state: "KD", milling: "S4S", yard: "YD-A", section: "A-3", rack: "R-08", bin: "B2", status: "Reserved", updated: "5h ago", parentLog: null, supplier: "Cariboo Timber Ltd.", cost: 20.8, marketValue: 28.8, history: [{ e: "Received", t: "Jun 01 2026 09:00", w: "JS" }, { e: "Released — available to sell", t: "Jun 01 2026 09:30", w: "System" }, { e: "Reserved for @SO:L43@", t: "Jun 03 2026 14:00", w: "Admin" }] },
  { id: "T-2026-0114", date: "2026-06-03", species: "Hem-Fir", grade: "#1", thick: 2, width: 6, length: 16, qty: 70, volume: 1120, state: "KD", milling: "S4S", yard: "YD-B", section: "B-1", rack: "R-12", bin: "B3", status: "Available", updated: "30m ago", parentLog: null, supplier: "Fraser Mills Lumber", cost: 8.0, marketValue: 11.68, history: [{ e: "Received and scanned at B-1/R-12", t: "Jun 03 2026 06:30", w: "TL" }, { e: "Released — available to sell", t: "Jun 03 2026 06:35", w: "System" }] },
  { id: "T-2026-0115", date: "2026-06-01", species: "SPF", grade: "Select", thick: 4, width: 6, length: 16, qty: 40, volume: 1280, state: "KD-HT", milling: "S4S", yard: "YD-A", section: "A-4", rack: "R-04", bin: "B1", status: "Pending", updated: "3h ago", parentLog: null, supplier: "Pacific Saw Co.", cost: 21.76, marketValue: 31.36, history: [{ e: "Created from delivery slip — awaiting receipt", t: "Jun 01 2026 12:00", w: "DW" }] },
  { id: "T-2026-0116", date: "2026-05-18", species: "Doug Fir", grade: "Clear", thick: 2, width: 10, length: 16, qty: 20, volume: 533, state: "KD", milling: "S4S", yard: "YD-C", section: "C-1", rack: "R-13", bin: "B4", status: "Shipped", updated: "4d ago", parentLog: null, supplier: "Westwood Forest Products", cost: 47.97, marketValue: 65.29, history: [{ e: "Received", t: "May 18 2026 09:00", w: "JS" }, { e: "Released — available to sell", t: "May 18 2026 09:30", w: "System" }, { e: "Reserved for @SO:L40@", t: "May 25 2026 10:00", w: "Admin" }, { e: "Picked & scanned out the gate", t: "May 30 2026 11:00", w: "MK" }, { e: "Shipped via @SO:L40@", t: "May 30 2026 11:05", w: "System" }] },
  { id: "T-2026-0117", date: "2026-05-31", species: "SPF", grade: "#2", thick: 2, width: 6, length: 12, qty: 110, volume: 1320, state: "GRN", milling: "RGH", yard: "YD-B", section: "B-2", rack: "R-09", bin: "B5", status: "Discrepancy", updated: "1h ago", parentLog: "LOG-2024-0044", supplier: "In-house production", cost: 5.04, marketValue: 7.44, history: [{ e: "Milled from LOG-2024-0044", t: "May 31 2026 08:00", w: "Factory" }, { e: "Flagged: grade mismatch — labeled #2, graded #3", t: "Jun 01 2026 07:30", w: "TL" }] },
  { id: "T-2026-0118", date: "2026-05-29", species: "Hem-Fir", grade: "#2", thick: 2, width: 4, length: 14, qty: 85, volume: 793, state: "HT", milling: "STD", yard: "YD-A", section: "A-1", rack: "R-03", bin: "B3", status: "Reserved", updated: "1d ago", parentLog: null, supplier: "Fraser Mills Lumber", cost: 4.1, marketValue: 5.97, history: [{ e: "Received", t: "May 29 2026 14:00", w: "MK" }, { e: "Released — available to sell", t: "May 29 2026 14:30", w: "System" }, { e: "Reserved for @SO:L45@", t: "Jun 04 2026 08:00", w: "Admin" }] },
  // Backs the Approval Queue's discount-calc demo order (L46): 200 pcs × $10.00 = a clean $2,000.00.
  { id: "T-2026-0119", date: "2026-05-27", species: "SPF", grade: "#2", thick: 2, width: 6, length: 16, qty: 200, volume: 3200, state: "KD", milling: "STD", yard: "YD-B", section: "B-3", rack: "R-10", bin: "B4", status: "Reserved", updated: "1d ago", parentLog: null, supplier: "Fraser Mills Lumber", cost: 7.05, marketValue: 10.0, history: [{ e: "Received", t: "May 27 2026 08:30", w: "TL" }, { e: "Released — available to sell", t: "May 27 2026 09:00", w: "System" }, { e: "Reserved for @SO:L46@", t: "Jun 04 2026 09:40", w: "Admin" }] },
];

// Client entities (CRM MVP). Ids are fixed so the salesOrders seed below can reference
// them at parse time; the useClients hook picks these up on first load and persists to
// localStorage for edit-through-reload durability. Order mirrors first-appearance in the
// pre-migration free-string customer field on salesOrders.
export const INITIAL_CLIENTS: Client[] = ([
  { id: "C-0001", name: "Coastal Builders Supply", contactName: "Alex Chen", phone: "604-555-0142", email: "alex@coastalbuilders.ca", territory: "BC Coast", paymentTerms: "Net 30", createdAt: "May 15 2026 09:00" },
  { id: "C-0002", name: "Fraser Valley Truss", contactName: "Priya Sharma", phone: "604-555-0187", email: "priya@fvtruss.com", territory: "Fraser Valley", paymentTerms: "Net 45", createdAt: "May 15 2026 09:00" },
  { id: "C-0003", name: "Island Pallet Co.", contactName: "Morgan Reid", phone: "250-555-0119", email: "orders@islandpallet.ca", territory: "Vancouver Island", paymentTerms: "COD", createdAt: "May 15 2026 09:00" },
  { id: "C-0004", name: "Okanagan Timber Frames", contactName: "Dana Whitfield", phone: "250-555-0164", email: "dana@okanagantf.ca", territory: "Interior BC", paymentTerms: "Net 30", createdAt: "May 15 2026 09:00" },
  { id: "C-0005", name: "Prairie Lumber Yard", contactName: "Sam Kowalski", phone: "403-555-0128", email: "purchasing@prairielumber.ca", territory: "Alberta", paymentTerms: "Net 30", createdAt: "May 15 2026 09:00" },
  { id: "C-0006", name: "Northshore Deck & Fence", contactName: "Jordan Lee", phone: "604-555-0173", email: "jordan@northshoredeck.ca", territory: "BC Coast", paymentTerms: "Net 15", createdAt: "May 15 2026 09:00" },
  { id: "C-0007", name: "Summit Homes Ltd.", contactName: "Riley Tran", phone: "604-555-0155", email: "riley@summithomes.ca", territory: "Fraser Valley", paymentTerms: "Net 45", createdAt: "May 15 2026 09:00" },
  { id: "C-0008", name: "Kootenay Building Centre", contactName: "Casey Nolan", phone: "250-555-0191", email: "orders@kootenaybc.ca", territory: "Interior BC", paymentTerms: "COD", createdAt: "May 15 2026 09:00" },
] as Client[]).map((c) => ({ ...c, createdAt: agoStamp(150, "09:00") }));

// Hand-written orders on the legacy tags above. Every Reserved or Shipped legacy tag is
// on exactly one of these, each line takes the whole tag, and unitPrice mirrors the tag's
// marketValue so the Linked Transactions panel agrees with the tag's Pricing block.
// `key` is a stable handle — real "SO-00nn" ids are assigned chronologically further down.
interface LegacyOrder extends Omit<SalesOrder, "id"> { key: string }
const LEGACY_SALES_ORDERS: LegacyOrder[] = [
  { key: "L40", clientId: "C-0004", status: "Shipped", date: "2026-05-25", lineItems: [{ tagId: "T-2026-0116", qty: 20, unitPrice: 65.29 }], expectedShipDate: "2026-05-30" },
  { key: "L41", clientId: "C-0003", status: "Shipped", date: "2026-05-28", lineItems: [{ tagId: "T-2026-0109", qty: 30, unitPrice: 10.40 }], expectedShipDate: "2026-06-01" },
  { key: "L42", clientId: "C-0001", status: "Picked", date: "2026-06-01", lineItems: [{ tagId: "T-2026-0103", qty: 60, unitPrice: 21.60 }], expectedShipDate: "2026-06-10", notes: "Ship-to yard gate B — call driver on arrival." },
  { key: "L43", clientId: "C-0002", status: "Open", date: "2026-06-03", lineItems: [{ tagId: "T-2026-0113", qty: 25, unitPrice: 28.80 }], expectedShipDate: "2026-06-15" },
  { key: "L44", clientId: "C-0001", status: "Shipped", date: "2026-06-03", lineItems: [{ tagId: "T-2026-0106", qty: 45, unitPrice: 20.91 }], expectedShipDate: "2026-06-04", notes: "Rush order — customer pickup. PO #4471." },
  { key: "L45", clientId: "C-0003", status: "Open", date: "2026-06-04", lineItems: [{ tagId: "T-2026-0118", qty: 85, unitPrice: 5.97 }], expectedShipDate: "2026-06-12" },
  // Round numbers on purpose — this order backs the Approval Queue's discount-calc demo:
  // 200 pcs × $10.00 = a clean $2,000.00 original price (5% requested → $1,900.00).
  { key: "L46", clientId: "C-0001", status: "Open", date: "2026-06-04", lineItems: [{ tagId: "T-2026-0119", qty: 200, unitPrice: 10.00 }], expectedShipDate: "2026-06-14" },
];

// ─── Generated history (≈7 months of orders) ──────────────────────────────────────
// Pulse needs a trading history to chart: revenue by period, the order pipeline, top
// clients, discounts, on-time shipping. Rather than hand-write ~70 more tag rows, each
// order below is declared compactly and expands into a SalesOrder plus one whole-tag
// line item per line — so a tag's status always agrees with its order's status
// (Shipped order → Shipped tags, Open/Picked → Reserved, Draft/Cancelled → Available).
// All offsets are "days ago" from the real today.
//
// The history runs ~210 days so the longest fixed period (90 days) still has a complete
// previous period to compare against, and each 30-day window carries a similar, gently
// growing volume — period-over-period figures should read as a steady business.
//
// IDs are assigned chronologically so a higher number is always a newer record:
//   orders  SO-0014…  sorted by order date across generated + legacy orders
//   tags    T-2026-0001…  sorted by receipt date; all generated tags are received before
//           the oldest legacy tag (T-2026-0101…), the two newest stock tags sit after them
// and stay clear of the live minting formulas (App mints orders at 42 + salesOrders.length;
// Tag Entry / Delivery Slips mint tags at 0101 + tags.length).

const SUPPLIERS = ["Pacific Saw Co.", "Fraser Mills Lumber", "Westwood Forest Products", "Cariboo Timber Ltd.", "In-house production"];
const WORKERS = ["JS", "MK", "TL"];
const LOCATIONS: [string, string][] = [
  ["YD-A", "A-1"], ["YD-A", "A-2"], ["YD-A", "A-3"], ["YD-A", "A-4"],
  ["YD-B", "B-1"], ["YD-B", "B-2"], ["YD-B", "B-3"],
  ["YD-C", "C-1"], ["YD-C", "C-2"], ["YD-C", "C-3"],
];
// Generated tags must predate the oldest legacy tag (received 18 days before the anchor).
const MIN_GENERATED_AGE = 19;

// Per-piece cost from board feet × a $/FBM rate (species base × grade multiplier);
// market value is a flat markup on cost, in line with the legacy seed's ratios.
const COST_PER_FBM: Record<string, number> = { SPF: 0.56, "Hem-Fir": 0.5, "Doug Fir": 0.92, "Western Red Cedar": 2.3 };
const GRADE_MULT: Record<string, number> = { Clear: 1.5, Select: 1.25, "MSR 1650": 1.1, "#1": 1, "#2": 0.85, "#3": 0.7 };
const MARKUP = 1.42;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Dim = [thick: number, width: number, length: number];
interface SeedLine { species: string; grade: string; dim: Dim; qty: number; discountPct?: number }
interface SeedOrder {
  key: string; // stable handle ("g<days ago placed>") — the SO id is assigned chronologically
  client: string;
  status: SalesOrderStatus;
  placed: number; // days ago the order was placed
  shipped?: number; // days ago it shipped (Shipped orders only)
  due?: number; // expected ship date, days ago (negative = still in the future). On time = due ≤ shipped.
  notes?: string;
  lines: SeedLine[];
}
const L = (species: string, grade: string, dim: Dim, qty: number, discountPct?: number): SeedLine => ({ species, grade, dim, qty, discountPct });
// A shipped order: `lead` days from order to truck, `slack` days of margin against the
// promised date (negative = shipped late).
const shippedOrder = (placed: number, client: string, lead: number, slack: number, lines: SeedLine[], notes?: string): SeedOrder => ({
  key: `g${placed}`, client, status: "Shipped", placed, shipped: placed - lead, due: placed - lead - slack, lines, ...(notes ? { notes } : {}),
});

const SEED_ORDERS: SeedOrder[] = [
  // 181–210 days ago
  shippedOrder(208, "C-0001", 5, 1, [L("SPF", "#2", [2, 4, 8], 320)]),
  shippedOrder(203, "C-0002", 6, 0, [L("Doug Fir", "#1", [2, 6, 14], 90)]),
  shippedOrder(199, "C-0005", 5, 1, [L("SPF", "#1", [2, 6, 16], 150)]),
  shippedOrder(195, "C-0003", 6, -1, [L("SPF", "#3", [2, 4, 8], 480)]),
  shippedOrder(190, "C-0006", 4, 1, [L("Western Red Cedar", "#1", [1, 6, 10], 110)]),
  shippedOrder(186, "C-0004", 7, 0, [L("Doug Fir", "Select", [4, 6, 16], 36)]),
  shippedOrder(183, "C-0001", 5, 1, [L("Hem-Fir", "#2", [2, 8, 16], 120)]),
  // 151–180
  shippedOrder(178, "C-0007", 6, 1, [L("SPF", "MSR 1650", [2, 6, 16], 130)]),
  shippedOrder(174, "C-0002", 5, 0, [L("Doug Fir", "#2", [2, 8, 14], 80)]),
  shippedOrder(170, "C-0005", 6, 1, [L("SPF", "#2", [2, 4, 10], 380)]),
  shippedOrder(166, "C-0001", 5, 1, [L("SPF", "#1", [2, 4, 16], 180), L("Hem-Fir", "#1", [2, 6, 16], 60)]),
  shippedOrder(162, "C-0008", 4, 0, [L("Hem-Fir", "#2", [2, 4, 14], 220)]),
  shippedOrder(158, "C-0006", 5, 1, [L("Western Red Cedar", "Clear", [1, 6, 12], 60)]),
  shippedOrder(155, "C-0003", 7, -2, [L("SPF", "#3", [2, 4, 10], 420)]),
  shippedOrder(152, "C-0004", 6, 1, [L("Doug Fir", "#1", [4, 4, 16], 55)]),
  // 121–150
  shippedOrder(148, "C-0001", 5, 1, [L("SPF", "#2", [2, 6, 12], 200)]),
  shippedOrder(144, "C-0007", 6, 0, [L("Doug Fir", "Select", [2, 6, 14], 85)]),
  shippedOrder(141, "C-0005", 5, 1, [L("SPF", "#2", [2, 4, 8], 420)]),
  { key: "g139", client: "C-0003", status: "Cancelled", placed: 139, notes: "Cancelled at customer request before picking.", lines: [L("SPF", "#2", [2, 6, 12], 100)] },
  shippedOrder(137, "C-0002", 6, 1, [L("Hem-Fir", "#1", [2, 6, 16], 140)]),
  shippedOrder(133, "C-0006", 4, 1, [L("Western Red Cedar", "#1", [1, 4, 10], 160, 5)]),
  shippedOrder(129, "C-0001", 6, 0, [L("SPF", "#1", [2, 6, 16], 120), L("SPF", "#2", [2, 4, 8], 200)]),
  shippedOrder(125, "C-0008", 5, 1, [L("Hem-Fir", "#3", [2, 10, 12], 110)]),
  shippedOrder(122, "C-0004", 7, 1, [L("Doug Fir", "Clear", [2, 10, 16], 30)]),
  // 91–120
  shippedOrder(118, "C-0001", 6, 1, [L("SPF", "#2", [2, 4, 8], 300), L("SPF", "#1", [2, 6, 16], 80)]),
  shippedOrder(114, "C-0002", 5, 1, [L("Doug Fir", "#1", [2, 6, 14], 120)]),
  shippedOrder(110, "C-0005", 7, 0, [L("SPF", "#2", [2, 4, 10], 400)]),
  shippedOrder(106, "C-0003", 6, -1, [L("SPF", "#3", [2, 4, 8], 500)]),
  shippedOrder(103, "C-0004", 7, 1, [L("Doug Fir", "Select", [4, 6, 16], 40)]),
  shippedOrder(100, "C-0006", 4, 1, [L("Western Red Cedar", "Clear", [1, 6, 12], 70)]),
  shippedOrder(97, "C-0007", 6, 1, [L("SPF", "MSR 1650", [2, 6, 16], 160)]),
  shippedOrder(94, "C-0001", 5, 0, [L("Hem-Fir", "#2", [2, 8, 16], 110)]),
  shippedOrder(92, "C-0008", 5, 1, [L("Hem-Fir", "#2", [2, 4, 14], 200)]),
  // 61–90
  shippedOrder(88, "C-0001", 5, 1, [L("SPF", "#1", [2, 4, 16], 190)]),
  shippedOrder(85, "C-0006", 4, 1, [L("Western Red Cedar", "#1", [1, 6, 10], 150, 5)]),
  shippedOrder(81, "C-0007", 6, 0, [L("Hem-Fir", "#1", [2, 6, 16], 150)]),
  shippedOrder(78, "C-0002", 6, 1, [L("Doug Fir", "#2", [2, 8, 14], 90)]),
  { key: "g76", client: "C-0008", status: "Cancelled", placed: 76, notes: "Cancelled — discount request declined.", lines: [L("Hem-Fir", "#3", [2, 10, 12], 60)] },
  shippedOrder(74, "C-0005", 7, -2, [L("SPF", "#2", [2, 6, 12], 220)]),
  shippedOrder(71, "C-0001", 5, 1, [L("SPF", "#1", [2, 6, 16], 140), L("Doug Fir", "#1", [4, 4, 16], 40, 8)]),
  shippedOrder(68, "C-0003", 6, 1, [L("SPF", "#3", [2, 4, 10], 450)]),
  shippedOrder(65, "C-0004", 5, 1, [L("Doug Fir", "#1", [2, 6, 14], 110)]),
  shippedOrder(62, "C-0008", 5, 0, [L("Hem-Fir", "#2", [2, 8, 16], 100)]),
  // 31–60
  shippedOrder(59, "C-0001", 5, 1, [L("SPF", "#2", [2, 4, 8], 340)]),
  shippedOrder(56, "C-0006", 4, 1, [L("Western Red Cedar", "Clear", [1, 8, 12], 55)]),
  shippedOrder(53, "C-0002", 6, 1, [L("Doug Fir", "Select", [2, 6, 14], 100, 5)]),
  shippedOrder(50, "C-0005", 5, 0, [L("SPF", "#1", [2, 4, 16], 210)]),
  shippedOrder(47, "C-0007", 6, 1, [L("SPF", "MSR 1650", [2, 6, 16], 150)]),
  shippedOrder(46, "C-0006", 4, 1, [L("Western Red Cedar", "#1", [1, 4, 10], 180)]),
  shippedOrder(44, "C-0001", 6, 1, [L("Hem-Fir", "#1", [2, 6, 16], 130), L("SPF", "#2", [2, 4, 10], 200)]),
  shippedOrder(41, "C-0003", 7, -1, [L("SPF", "#3", [2, 4, 8], 520)]),
  shippedOrder(38, "C-0004", 6, 1, [L("Doug Fir", "Clear", [2, 10, 16], 28)]),
  shippedOrder(35, "C-0002", 5, 1, [L("Hem-Fir", "#2", [2, 8, 16], 120)]),
  shippedOrder(32, "C-0005", 5, 0, [L("SPF", "#2", [2, 6, 12], 300)]),
  // last 30 days (the legacy orders above also fall in this window)
  shippedOrder(28, "C-0001", 5, 1, [L("SPF", "#1", [2, 6, 16], 160), L("SPF", "#2", [2, 4, 8], 300)]),
  shippedOrder(22, "C-0007", 6, 1, [L("Doug Fir", "#1", [2, 6, 14], 110), L("Hem-Fir", "#2", [2, 8, 16], 100)]),
  { key: "g20", client: "C-0003", status: "Cancelled", placed: 20, notes: "Cancelled — customer's project postponed.", lines: [L("SPF", "#2", [2, 6, 12], 100)] },
  shippedOrder(18, "C-0005", 5, 0, [L("SPF", "#1", [2, 4, 16], 220, 3), L("Western Red Cedar", "#1", [1, 6, 10], 60)]),
  { key: "g13", client: "C-0007", status: "Picked", placed: 13, due: 3, notes: "Carrier rebooked — awaiting truck.", lines: [L("Doug Fir", "#1", [2, 6, 14], 100)] },
  { key: "g9", client: "C-0005", status: "Picked", placed: 9, due: -1, lines: [L("SPF", "#2", [2, 4, 10], 350)] },
  { key: "g7", client: "C-0002", status: "Open", placed: 7, due: 1, notes: "Waiting on customer to confirm delivery window.", lines: [L("Hem-Fir", "#2", [2, 8, 16], 70)] },
  { key: "g3", client: "C-0004", status: "Open", placed: 3, due: -5, lines: [L("Doug Fir", "Select", [4, 6, 16], 30), L("Western Red Cedar", "Clear", [1, 6, 12], 50, 10)] },
  { key: "g2", client: "C-0006", status: "Draft", placed: 2, lines: [L("Western Red Cedar", "#1", [1, 6, 10], 120)] },
  { key: "g1", client: "C-0008", status: "Draft", placed: 1, lines: [L("SPF", "#1", [2, 6, 16], 90), L("Hem-Fir", "#1", [2, 6, 16], 60)] },
];

// Stock that isn't on any order: slow movers for the aging views, plus a few
// receiving-side records (Discrepancy / Received / Pending) for supplier quality.
// `id` pins the two freshest tags after the legacy id range (they are newer than it).
interface SeedStock { received: number; species: string; grade: string; dim: Dim; qty: number; status: Tag["status"]; supplier: number; flag?: string; id?: string }
const SEED_STOCK: SeedStock[] = [
  { received: 135, species: "SPF", grade: "#3", dim: [2, 4, 10], qty: 180, status: "Available", supplier: 2 },
  { received: 110, species: "Hem-Fir", grade: "#3", dim: [2, 10, 12], qty: 45, status: "Available", supplier: 1 },
  { received: 96, species: "Doug Fir", grade: "#2", dim: [2, 8, 14], qty: 60, status: "Available", supplier: 2 },
  { received: 75, species: "Western Red Cedar", grade: "#1", dim: [1, 4, 10], qty: 90, status: "Available", supplier: 3 },
  { received: 52, species: "SPF", grade: "#2", dim: [2, 6, 12], qty: 140, status: "Available", supplier: 0 },
  { received: 41, species: "Hem-Fir", grade: "#1", dim: [2, 6, 16], qty: 80, status: "Available", supplier: 1 },
  { received: 33, species: "Hem-Fir", grade: "#2", dim: [2, 4, 14], qty: 100, status: "Discrepancy", supplier: 2, flag: "Flagged: moisture above spec on arrival" },
  { received: 27, species: "SPF", grade: "Select", dim: [4, 6, 16], qty: 60, status: "Available", supplier: 0 },
  { received: 23, species: "Doug Fir", grade: "Select", dim: [2, 6, 14], qty: 70, status: "Available", supplier: 4 },
  { received: 21, species: "SPF", grade: "#2", dim: [2, 4, 8], qty: 240, status: "Discrepancy", supplier: 2, flag: "Flagged: qty short 12 pcs on arrival" },
  { received: 1, species: "Doug Fir", grade: "#1", dim: [2, 6, 14], qty: 90, status: "Received", supplier: 3, id: "T-2026-0120" },
  { received: 1, species: "SPF", grade: "#1", dim: [2, 4, 16], qty: 120, status: "Pending", supplier: 3, id: "T-2026-0121" },
];

// ── Chronological order ids (generated + legacy together) ───────────────────────
const FIRST_SO_NUMBER = 14;
const legacyDaysAgo = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((SEED_ANCHOR.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
};
const SO_ID = new Map<string, string>(
  [
    ...SEED_ORDERS.map((o, i) => ({ key: o.key, daysAgo: o.placed, ord: i })),
    ...LEGACY_SALES_ORDERS.map((o, i) => ({ key: o.key, daysAgo: legacyDaysAgo(o.date), ord: 1000 + i })),
  ]
    .sort((a, b) => b.daysAgo - a.daysAgo || a.ord - b.ord)
    .map((o, i) => [o.key, `SO-${String(FIRST_SO_NUMBER + i).padStart(4, "0")}`] as [string, string]),
);
// Resolve an order key ("g53", "L46") to its SO id.
const so = (key: string): string => SO_ID.get(key) ?? key;
// Legacy tag history names its order with an "@SO:key@" token.
const resolveSoTokens = (text: string): string => text.replace(/@SO:(\w+)@/g, (_m, key: string) => so(key));

function buildHistory(): { tags: Tag[]; orders: SalesOrder[] } {
  // Pass 1 — describe every generated tag, so ids can be handed out in receipt order.
  interface Spec {
    received: number; ord: number; id?: string; seq: number;
    species: string; grade: string; dim: Dim; qty: number; status: Tag["status"]; supplier: string;
    updated: number; history: Tag["history"];
  }
  const specs: Spec[] = [];
  const orderLines = new Map<string, { spec: Spec; line: SeedLine }[]>();

  SEED_ORDERS.forEach((o, oi) => {
    const soId = so(o.key);
    const rows = o.lines.map((line, i) => {
      // Stock arrives one to three weeks before it is ordered.
      const received = Math.max(o.placed + 6 + ((oi * 5 + i * 4) % 12), MIN_GENERATED_AGE + ((oi + i * 2) % 6));
      const worker = WORKERS[(oi + i) % WORKERS.length];
      const history: Tag["history"] = [
        { e: "Received", t: agoStamp(received, "08:00"), w: worker },
        { e: "Released — available to sell", t: agoStamp(received - 1, "09:00"), w: "System" },
      ];
      let status: Tag["status"] = "Available";
      let updated = received - 1;
      if (o.status === "Open" || o.status === "Picked" || o.status === "Shipped" || o.status === "Cancelled") {
        history.push({ e: `Reserved for ${soId}`, t: agoStamp(o.placed, "11:00"), w: "Sales" });
        status = "Reserved";
        updated = o.placed;
      }
      if (o.status === "Shipped" && o.shipped !== undefined) {
        history.push({ e: `Shipped via ${soId}`, t: agoStamp(o.shipped, "14:00"), w: "System" });
        status = "Shipped";
        updated = o.shipped;
      }
      if (o.status === "Cancelled") {
        history.push({ e: `Released — ${soId} cancelled`, t: agoStamp(o.placed - 1, "10:00"), w: "Manager" });
        status = "Available";
        updated = o.placed - 1;
      }
      const spec: Spec = { received, ord: specs.length, seq: 0, species: line.species, grade: line.grade, dim: line.dim, qty: line.qty, status, supplier: SUPPLIERS[(oi + i) % SUPPLIERS.length], updated, history };
      specs.push(spec);
      return { spec, line };
    });
    orderLines.set(o.key, rows);
  });

  SEED_STOCK.forEach((s, i) => {
    const worker = WORKERS[i % WORKERS.length];
    const history: Tag["history"] =
      s.status === "Pending"
        ? [{ e: "Created from delivery slip — awaiting receipt", t: agoStamp(s.received, "07:30"), w: "DW" }]
        : [{ e: "Received", t: agoStamp(s.received, "08:00"), w: worker }];
    if (s.status === "Available") history.push({ e: "Released — available to sell", t: agoStamp(s.received - 1, "09:00"), w: "System" });
    if (s.flag) history.push({ e: s.flag, t: agoStamp(s.received, "08:20"), w: worker });
    specs.push({ received: s.received, ord: specs.length, seq: 0, id: s.id, species: s.species, grade: s.grade, dim: s.dim, qty: s.qty, status: s.status, supplier: SUPPLIERS[s.supplier], updated: s.status === "Available" ? s.received - 1 : s.received, history });
  });

  // Pass 2 — oldest receipt first gets the lowest tag number.
  specs.sort((a, b) => b.received - a.received || a.ord - b.ord);
  let next = 0;
  specs.forEach((spec, i) => {
    spec.seq = i + 1;
    if (!spec.id) {
      next += 1;
      spec.id = `T-2026-${String(next).padStart(4, "0")}`;
    }
  });

  const toTag = (spec: Spec): Tag => {
    const [thick, width, length] = spec.dim;
    const [yard, section] = LOCATIONS[spec.seq % LOCATIONS.length];
    const perPieceFbm = (thick * width * length) / 12;
    const cost = round2(perPieceFbm * (COST_PER_FBM[spec.species] ?? 0.6) * (GRADE_MULT[spec.grade] ?? 1));
    const green = spec.species === "Hem-Fir" && spec.grade !== "#1";
    return {
      id: spec.id!,
      date: agoIso(spec.received),
      productType: DEFAULT_PRODUCT_TYPE,
      species: spec.species, grade: spec.grade, thick, width, length, qty: spec.qty,
      volume: volumeOfTag({ productType: DEFAULT_PRODUCT_TYPE, thick, width, length }, spec.qty),
      state: green ? "GRN" : spec.species === "Doug Fir" ? "KD-HT" : "KD",
      milling: green ? "RGH" : spec.species === "SPF" ? "STD" : "S4S",
      yard, section,
      rack: `R-${pad2((spec.seq % 15) + 1)}`,
      bin: `B${(spec.seq % 5) + 1}`,
      status: spec.status,
      updated: `${Math.max(spec.updated, 1)}d ago`,
      parentLog: null,
      supplier: spec.supplier,
      cost,
      marketValue: round2(cost * MARKUP),
      history: spec.history,
    };
  };
  const tags = specs.map(toTag);
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const orders: SalesOrder[] = SEED_ORDERS.map((o) => ({
    id: so(o.key),
    clientId: o.client,
    status: o.status,
    date: agoIso(o.placed),
    lineItems: (orderLines.get(o.key) ?? []).map(({ spec, line }) => {
      const li: SalesOrderLineItem = { tagId: spec.id!, qty: line.qty, unitPrice: tagById.get(spec.id!)?.marketValue ?? 0 };
      if (line.discountPct) li.discountPct = line.discountPct;
      return li;
    }),
    ...(o.due !== undefined ? { expectedShipDate: agoIso(o.due) } : {}),
    ...(o.notes ? { notes: o.notes } : {}),
  }));

  return { tags, orders };
}

const HISTORY = buildHistory();
// Earlier-today floor activity. Each entry is appended to its tag's movement history AND
// surfaced in the Dashboard activity feed, so the feed never shows something the tag's
// own history doesn't.
const TODAY_EVENTS: { tagId: string; type: ActivityEvent["type"]; e: string; msg: string; mins: number; w: string }[] = [
  { tagId: "T-2026-0105", type: "move", e: "Moved from A-4/R-01 to A-1/R-02", msg: "moved from A-4/R-01 to A-1/R-02", mins: 2, w: "JS" },
  { tagId: "T-2026-0111", type: "qc", e: "QC check passed", msg: "QC check passed at A-2/R-06", mins: 125, w: "MK" },
  { tagId: "T-2026-0108", type: "scan", e: "Scanned — location confirmed", msg: "scanned and location confirmed", mins: 190, w: "JS" },
];

// Oldest first — the same order the app appends in (lists sort newest-first for display).
export const initialTags: Tag[] = [
  ...HISTORY.tags,
  ...LEGACY_TAGS.map((t) => ({ ...t, productType: DEFAULT_PRODUCT_TYPE, date: shiftIso(t.date), history: t.history.map((h) => ({ ...h, e: resolveSoTokens(h.e), t: shiftStamp(h.t) })) })),
]
  .map((t) => {
    const today = TODAY_EVENTS.filter((ev) => ev.tagId === t.id).map((ev) => ({ e: ev.e, t: minsAgoStamp(ev.mins), w: ev.w }));
    const history = today.length ? [...t.history, ...today] : t.history;
    // "Updated" always reflects the tag's most recent history event.
    return { ...t, history, updated: relativeLabel(stampMs(history[history.length - 1]?.t ?? "")) };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

export const salesOrders: SalesOrder[] = [
  ...HISTORY.orders,
  ...LEGACY_SALES_ORDERS.map(({ key, ...o }) => ({
    ...o,
    id: so(key),
    date: shiftIso(o.date),
    ...(o.expectedShipDate ? { expectedShipDate: shiftIso(o.expectedShipDate) } : {}),
  })),
].sort((a, b) => a.id.localeCompare(b.id));

// Approval requests, declared with a createdAt stamp and numbered chronologically
// ("AR-2026-0001" is the oldest). App mints new ids at approvalRequests.length + 1, so
// the numbering stays contiguous. Every discounted order line has a request behind it;
// rates match the discounted line. `discountRate` is optional on ApprovalRequest — the
// generic Request Approval form is free-text, so the Approval Queue skips the
// calculated-price block when it is absent rather than guessing from the text.
const yesterday = (hhmm: string) => agoStamp(1, hhmm);
const APPROVAL_SEEDS: Omit<ApprovalRequest, "id">[] = [
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g133"), discountRate: 5, details: "5% volume discount on a full cedar tag.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(133, "10:00"), resolvedAt: agoStamp(133, "15:30") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g85"), discountRate: 5, details: "5% for a repeat decking customer.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(85, "09:20"), resolvedAt: agoStamp(85, "14:10") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g76"), discountRate: 15, details: "Customer asking 15% to close on slow-moving Hem-Fir #3.", status: "Rejected", reviewedBy: "Manager", reviewNote: "Below floor price.", createdAt: agoStamp(76, "13:10"), resolvedAt: agoStamp(75, "09:00") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g71"), discountRate: 8, details: "8% on the Doug Fir line to match a competing quote.", status: "Approved", reviewedBy: "Manager", reviewNote: "OK for this order only.", createdAt: agoStamp(71, "11:20"), resolvedAt: agoStamp(70, "11:00") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g53"), discountRate: 5, details: "5% on the Select line for a repeat builder.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(53, "11:40"), resolvedAt: agoStamp(53, "16:15") },
  { type: "creditTerm", requestedBy: "Sales", relatedSoId: so("g44"), details: "Requesting Net 45 for this order.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(44, "14:00"), resolvedAt: agoStamp(43, "10:30") },
  { type: "orderCancellation", requestedBy: "Sales", relatedSoId: so("g20"), details: "Customer's project was postponed — requesting cancellation.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(19, "09:00"), resolvedAt: agoStamp(19, "09:45") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g18"), discountRate: 3, details: "3% early-payment discount.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(18, "11:30"), resolvedAt: agoStamp(18, "13:00") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("g3"), discountRate: 10, details: "10% on the cedar line — customer is bundling two species.", status: "Pending", createdAt: agoStamp(3, "15:20") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("L43"), discountRate: 10, details: "10% discount in exchange for early payment commitment.", status: "Pending", createdAt: agoStamp(2, "15:30") },
  { type: "discount", requestedBy: "Sales", relatedSoId: so("L46"), discountRate: 5, details: "Requesting a 5% loyalty discount for repeat customer on this order.", status: "Pending", createdAt: yesterday("10:15") },
  { type: "creditTerm", requestedBy: "Sales", relatedSoId: so("L45"), details: "Requesting Net 60 terms instead of standard Net 30 for this account.", status: "Pending", createdAt: yesterday("15:00") },
];

export const INITIAL_APPROVAL_REQUESTS: ApprovalRequest[] = APPROVAL_SEEDS.map((r, i) => ({ ...r, id: `AR-2026-${String(i + 1).padStart(4, "0")}` }));

// Dashboard activity feed, newest first — built from real tag history: today's floor
// events above, plus yesterday's reservation and receipt.
const feedTag = (id: string) => initialTags.find((t) => t.id === id);
const feedEvent = (id: string, startsWith: string) => feedTag(id)?.history.find((h) => h.e.startsWith(startsWith));
const reservedEv = feedEvent("T-2026-0118", "Reserved for");
const receivedTag = feedTag("T-2026-0120");
export const recentActivity: ActivityEvent[] = [
  ...TODAY_EVENTS.map((ev) => ({ type: ev.type, msg: `${ev.tagId} ${ev.msg}`, worker: ev.w, time: relativeLabel(NOW.getTime() - ev.mins * 60_000, true), tagId: ev.tagId })),
  { type: "reserve", msg: `T-2026-0118 reserved for ${so("L45")}`, worker: reservedEv?.w ?? "Admin", time: relativeLabel(stampMs(reservedEv?.t ?? ""), true), tagId: "T-2026-0118" },
  {
    type: "receive",
    msg: `T-2026-0120 received and stocked at ${receivedTag ? `${receivedTag.section}/${receivedTag.rack}` : "the yard"}`,
    worker: receivedTag?.history[0]?.w ?? "TL",
    time: relativeLabel(stampMs(receivedTag?.history[0]?.t ?? ""), true),
    tagId: "T-2026-0120",
  },
];

export const floorTasks: FloorTask[] = [
  { title: "Move 20 units of SPF #1", loc: "A-1/R-03 → A-2/R-05", priority: "High" },
  { title: "Scan & confirm Cedar stock", loc: "YD-C · C-1 · R-13", priority: "Normal" },
  { title: `Pick Hem-Fir for ${so("L45")}`, loc: "YD-A · A-1 · R-03", priority: "Normal" },
];

export const parentLogs: string[] = ["LOG-2024-0040", "LOG-2024-0041", "LOG-2024-0042", "LOG-2024-0043", "LOG-2024-0044"];
