// Seed data for the log-trading demo company (industry pack "logTrading").
//
// The business: buy logs, scale them into inventory as lots, allocate lots to customer
// booms, keep booms at storage sites (a dry-land sort yard and two water lots), move
// them as needed, and deliver them to the customer's mill. Every lot is a Tag with
// productType "log" (counted and measured in m³), every boom is a SalesOrder carrying
// `boom` details. Like the lumber seed, everything is authored in "days ago" so the
// demo rolls with the real clock, and record states always agree:
//   boom Open (in storage) / Picked (in transit) → its lots are Reserved (allocated)
//   boom Shipped (delivered)                     → its lots are Shipped (delivered)
// Ids are chronological: lots T-2026-0001… by scale date, booms SO-0001… by
// allocation date (boom names BM-0101…), approvals AR-2026-0001… by creation time.
import type { ActivityEvent, ApprovalRequest, BoomInfo, Client, FloorTask, SalesOrder, SalesOrderLineItem, Tag } from "./types";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const NOW = new Date();
const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();
const dayAgo = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d;
};
const agoIso = (n: number) => {
  const d = dayAgo(n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const agoStamp = (n: number, hhmm: string) => {
  const d = dayAgo(n);
  return `${MONTHS_SHORT[d.getMonth()]} ${pad2(d.getDate())} ${d.getFullYear()} ${hhmm}`;
};
const stampMs = (stamp: string): number | null => {
  const m = stamp.match(/^([A-Za-z]{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const mi = MONTHS_SHORT.indexOf(m[1]);
  return mi < 0 ? null : new Date(Number(m[3]), mi, Number(m[2]), Number(m[4]), Number(m[5])).getTime();
};
const relative = (ms: number | null, minWord = false): string => {
  if (ms === null) return "—";
  const mins = Math.max(0, Math.floor((NOW.getTime() - ms) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return minWord ? `${mins} min ago` : `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

// ── Storage sites ────────────────────────────────────────────────────────────────
export const LOG_SITES: { code: string; letter: string; name: string; lng: number; lat: number }[] = [
  { code: "SORT", letter: "S", name: "Sort Yard", lng: -122.6605, lat: 49.1898 },
  { code: "WL-N", letter: "N", name: "Water Lot North", lng: -122.6512, lat: 49.1949 },
  { code: "WL-S", letter: "W", name: "Water Lot South", lng: -122.6436, lat: 49.1921 },
];
export const LOG_SPECIES = ["Douglas-fir", "Western Hemlock", "Western Red Cedar", "Sitka Spruce", "Amabilis Fir"];
export const LOG_GRADES = ["Peeler", "Sawlog #1", "Sawlog #2", "Pulp"];
export const LOG_SUPPLIERS = ["Coast Timber Holdings", "Sunshine Coast Logging", "Fraser Valley Woodlots"];

// Purchase cost and list price per m³ by species and grade (mock market).
const BASE: Record<string, number> = { "Douglas-fir": 128, "Western Hemlock": 84, "Western Red Cedar": 214, "Sitka Spruce": 96, "Amabilis Fir": 78 };
const GRADE: Record<string, number> = { Peeler: 1.3, "Sawlog #1": 1, "Sawlog #2": 0.82, Pulp: 0.34 };
const MARKUP = 1.18;
export function logPrice(species: string, grade: string): { cost: number; marketValue: number } {
  const cost = Math.round((BASE[species] ?? 90) * (GRADE[grade] ?? 1) * 100) / 100;
  return { cost, marketValue: Math.round(cost * MARKUP * 100) / 100 };
}

// ── Clients (mills that buy logs) ────────────────────────────────────────────────
export const LOG_CLIENTS: Client[] = [
  { id: "C-0001", name: "Fraser Sawmills Ltd.", contactName: "Gord Halvorsen", phone: "604-555-0131", email: "logs@frasersawmills.ca", territory: "Lower Mainland", paymentTerms: "Net 30", createdAt: agoStamp(200, "09:00") },
  { id: "C-0002", name: "Harbour Plywood Inc.", contactName: "Mei Tanaka", phone: "604-555-0168", email: "fibre@harbourply.ca", territory: "Lower Mainland", paymentTerms: "Net 30", createdAt: agoStamp(200, "09:00") },
  { id: "C-0003", name: "North Shore Cedar Products", contactName: "Ravi Gill", phone: "604-555-0152", email: "ravi@nscedar.ca", territory: "BC Coast", paymentTerms: "Net 45", createdAt: agoStamp(200, "09:00") },
  { id: "C-0004", name: "Island Pulp & Paper", contactName: "Lena Brooks", phone: "250-555-0177", email: "wood@islandpulp.ca", territory: "Vancouver Island", paymentTerms: "Net 30", createdAt: agoStamp(200, "09:00") },
  { id: "C-0005", name: "Valley Timber Mills", contactName: "Owen Price", phone: "604-555-0109", email: "owen@valleytimber.ca", territory: "Fraser Valley", paymentTerms: "Net 15", createdAt: agoStamp(200, "09:00") },
];

// ── Booms ────────────────────────────────────────────────────────────────────────
type LotSpec = [species: string, grade: string, m3: number, logs: number, discountPct?: number];
interface SeedBoom {
  client: string;
  status: "Open" | "Picked" | "Shipped";
  allocated: number; // days ago the lots were allocated to the boom
  site: string; // where the boom was formed
  moves?: [daysAgo: number, to: string][];
  delivered?: number; // days ago delivered (Shipped)
  variance?: number; // delivered m³ minus allocated m³ (e.g. sinkers, rescale)
  due?: number; // expected delivery, days ago (negative = upcoming)
  notes?: string;
  lots: LotSpec[];
}

const SEED_BOOMS: SeedBoom[] = [
  { client: "C-0001", status: "Shipped", allocated: 121, site: "WL-N", delivered: 116, due: 115, lots: [["Douglas-fir", "Sawlog #1", 64.2, 38], ["Douglas-fir", "Sawlog #2", 22.6, 17]] },
  { client: "C-0004", status: "Shipped", allocated: 112, site: "SORT", delivered: 107, due: 107, lots: [["Western Hemlock", "Pulp", 88.4, 74]] },
  { client: "C-0003", status: "Shipped", allocated: 103, site: "WL-S", delivered: 97, due: 98, lots: [["Western Red Cedar", "Sawlog #1", 41.7, 26]] },
  { client: "C-0002", status: "Shipped", allocated: 95, site: "WL-N", delivered: 90, due: 90, lots: [["Douglas-fir", "Peeler", 52.3, 22]] },
  { client: "C-0005", status: "Shipped", allocated: 86, site: "SORT", moves: [[84, "WL-S"]], delivered: 80, due: 81, lots: [["Western Hemlock", "Sawlog #1", 58.9, 41], ["Amabilis Fir", "Sawlog #2", 19.4, 15]] },
  { client: "C-0001", status: "Shipped", allocated: 77, site: "WL-N", delivered: 72, due: 72, variance: -1.4, lots: [["Douglas-fir", "Sawlog #1", 71.5, 44]] },
  { client: "C-0004", status: "Shipped", allocated: 68, site: "SORT", delivered: 62, due: 63, lots: [["Western Hemlock", "Pulp", 95.2, 80], ["Sitka Spruce", "Pulp", 21.3, 19]] },
  { client: "C-0003", status: "Shipped", allocated: 59, site: "WL-S", delivered: 54, due: 55, lots: [["Western Red Cedar", "Sawlog #1", 47.8, 30, 4]] },
  { client: "C-0002", status: "Shipped", allocated: 50, site: "WL-N", delivered: 44, due: 45, lots: [["Douglas-fir", "Peeler", 48.1, 20], ["Douglas-fir", "Sawlog #1", 27.5, 17]] },
  { client: "C-0005", status: "Shipped", allocated: 41, site: "SORT", moves: [[39, "WL-N"]], delivered: 35, due: 36, lots: [["Western Hemlock", "Sawlog #1", 62.0, 43]] },
  { client: "C-0001", status: "Shipped", allocated: 33, site: "WL-N", delivered: 27, due: 28, lots: [["Douglas-fir", "Sawlog #1", 76.3, 47], ["Douglas-fir", "Sawlog #2", 24.8, 19]] },
  { client: "C-0004", status: "Shipped", allocated: 25, site: "SORT", delivered: 19, due: 20, variance: -0.8, lots: [["Western Hemlock", "Pulp", 102.6, 86]] },
  { client: "C-0003", status: "Shipped", allocated: 18, site: "WL-S", delivered: 12, due: 13, lots: [["Western Red Cedar", "Sawlog #1", 52.4, 33]] },
  { client: "C-0002", status: "Picked", allocated: 9, site: "WL-N", due: -1, notes: "Tug booked — boom under tow to the plywood mill.", lots: [["Douglas-fir", "Peeler", 55.6, 23]] },
  { client: "C-0005", status: "Open", allocated: 6, site: "SORT", moves: [[2, "WL-S"]], due: -6, notes: "Moved to the water lot to free sort-yard space.", lots: [["Western Hemlock", "Sawlog #1", 49.3, 35], ["Amabilis Fir", "Sawlog #2", 16.2, 13]] },
  { client: "C-0001", status: "Open", allocated: 3, site: "WL-N", due: -9, lots: [["Douglas-fir", "Sawlog #1", 68.7, 42, 5]] },
];

// Lots scaled in but not yet allocated to any boom.
interface SeedLot { received: number; lot: LotSpec; site: string; supplier: number; status?: "Available" | "Discrepancy"; flag?: string }
const SEED_LOTS: SeedLot[] = [
  { received: 128, lot: ["Sitka Spruce", "Sawlog #2", 34.6, 28], site: "SORT", supplier: 2 },
  { received: 97, lot: ["Amabilis Fir", "Pulp", 41.2, 37], site: "SORT", supplier: 1 },
  { received: 38, lot: ["Western Hemlock", "Sawlog #2", 57.4, 46], site: "WL-N", supplier: 0 },
  { received: 22, lot: ["Douglas-fir", "Sawlog #2", 63.1, 49], site: "WL-S", supplier: 1 },
  { received: 11, lot: ["Western Red Cedar", "Sawlog #2", 29.8, 21], site: "WL-S", supplier: 0 },
  { received: 8, lot: ["Western Hemlock", "Pulp", 18.5, 16], site: "SORT", supplier: 2, status: "Discrepancy", flag: "Flagged: scaled volume disputed by seller — awaiting check scale" },
  { received: 4, lot: ["Douglas-fir", "Sawlog #1", 82.4, 51], site: "WL-N", supplier: 0 },
  { received: 1, lot: ["Western Hemlock", "Sawlog #1", 44.9, 32], site: "SORT", supplier: 2 },
];

const WORKERS = ["JS", "MK", "TL"];

function build(): { tags: Tag[]; orders: SalesOrder[] } {
  interface Spec { received: number; ord: number; tag: Omit<Tag, "id">; boomKey?: number; lotIdx?: number }
  const specs: Spec[] = [];
  const boomIds = SEED_BOOMS.map((_b, i) => `SO-${String(i + 1).padStart(4, "0")}`);
  const boomNames = SEED_BOOMS.map((_b, i) => `BM-${String(101 + i).padStart(4, "0")}`);
  const scaleNo = (days: number, i: number) => `SC-${String(4000 - days * 3 + i).padStart(4, "0")}`;

  const lotTag = (lot: LotSpec, received: number, site: string, supplier: string, i: number): Omit<Tag, "id"> => {
    const [species, grade, m3, logs] = lot;
    return {
      productType: "log",
      species, grade, thick: 0, width: 0, length: 0,
      qty: m3, volume: m3, pieces: logs, scaleRef: scaleNo(received, i),
      state: "—", milling: "—",
      yard: site, section: "Bay " + ((i % 4) + 1), rack: "—", bin: "—",
      status: "Available",
      date: agoIso(received),
      updated: "",
      parentLog: null,
      supplier,
      ...logPrice(species, grade),
      history: [
        { e: `Scaled — ${m3} m³, ${logs} logs (scale ref ${scaleNo(received, i)})`, t: agoStamp(received, "08:00"), w: WORKERS[i % 3] },
        { e: "Released — available to allocate", t: agoStamp(received, "09:30"), w: "System" },
      ],
    };
  };

  SEED_BOOMS.forEach((b, bi) => {
    const soId = boomIds[bi];
    const name = boomNames[bi];
    b.lots.forEach((lot, li) => {
      const received = b.allocated + 4 + ((bi + li * 3) % 9);
      const t = lotTag(lot, received, b.site, LOG_SUPPLIERS[(bi + li) % 3], bi * 3 + li);
      t.section = name;
      t.status = b.status === "Shipped" ? "Shipped" : "Reserved";
      t.history.push({ e: `Allocated for ${soId} via boom ${name}`, t: agoStamp(b.allocated, "11:00"), w: "Sales" });
      let site = b.site;
      for (const [d, to] of b.moves ?? []) {
        t.history.push({ e: `Moved with boom ${name} from ${site} to ${to}`, t: agoStamp(d, "13:00"), w: "MK" });
        site = to;
      }
      t.yard = site;
      if (b.status === "Picked") t.history.push({ e: `In transit with boom ${name}`, t: agoStamp(Math.max(b.allocated - 7, 1), "07:30"), w: "TL" });
      if (b.status === "Shipped" && b.delivered !== undefined) t.history.push({ e: `Delivered via ${soId} (boom ${name})`, t: agoStamp(b.delivered, "15:00"), w: "System" });
      specs.push({ received, ord: specs.length, tag: t, boomKey: bi, lotIdx: li });
    });
  });
  SEED_LOTS.forEach((s, i) => {
    const t = lotTag(s.lot, s.received, s.site, LOG_SUPPLIERS[s.supplier], 50 + i);
    if (s.status === "Discrepancy") {
      t.status = "Discrepancy";
      t.history = [t.history[0], { e: s.flag ?? "Flagged", t: agoStamp(s.received, "10:10"), w: "TL" }];
    }
    specs.push({ received: s.received, ord: specs.length, tag: t });
  });

  specs.sort((a, b) => b.received - a.received || a.ord - b.ord);
  const tags: Tag[] = specs.map((s, i) => {
    const id = `T-2026-${String(i + 1).padStart(4, "0")}`;
    const last = s.tag.history[s.tag.history.length - 1];
    return { ...s.tag, id, updated: relative(stampMs(last.t)) };
  });

  const orders: SalesOrder[] = SEED_BOOMS.map((b, bi) => {
    const lines: SalesOrderLineItem[] = tags
      .map((t, i) => ({ t, spec: specs[i] }))
      .filter(({ spec }) => spec.boomKey === bi)
      .map(({ t, spec }) => {
        const line: SalesOrderLineItem = { tagId: t.id, qty: t.qty, unitPrice: t.marketValue ?? 0 };
        const disc = b.lots[spec.lotIdx ?? 0]?.[4];
        if (disc) line.discountPct = disc;
        return line;
      });
    const allocatedM3 = r1(lines.reduce((s, l) => s + l.qty, 0));
    let site = b.site;
    const moves = (b.moves ?? []).map(([d, to]) => {
      const mv = { at: agoStamp(d, "13:00"), from: site, to, by: "MK" };
      site = to;
      return mv;
    });
    const boom: BoomInfo = { id: boomNames[bi], location: site, moves };
    if (b.status === "Shipped" && b.delivered !== undefined) {
      boom.deliveredVolume = r1(allocatedM3 + (b.variance ?? 0));
      boom.deliveredDate = agoIso(b.delivered);
    }
    return {
      id: boomIds[bi],
      clientId: b.client,
      status: b.status,
      date: agoIso(b.allocated),
      lineItems: lines,
      ...(b.due !== undefined ? { expectedShipDate: agoIso(b.due) } : {}),
      ...(b.notes ? { notes: b.notes } : {}),
      boom,
    };
  });
  return { tags, orders };
}

const BUILT = build();
export const LOG_TAGS: Tag[] = BUILT.tags;
export const LOG_ORDERS: SalesOrder[] = BUILT.orders;

export const LOG_APPROVALS: ApprovalRequest[] = [
  { id: "AR-2026-0001", type: "discount", requestedBy: "Sales", relatedSoId: "SO-0008", discountRate: 4, details: "4% on the cedar boom — buyer is taking the full boom ahead of schedule.", status: "Approved", reviewedBy: "Manager", createdAt: agoStamp(59, "10:20"), resolvedAt: agoStamp(59, "14:05") },
  { id: "AR-2026-0002", type: "discount", requestedBy: "Sales", relatedSoId: "SO-0016", discountRate: 5, details: "5% volume discount — third boom this quarter for this mill.", status: "Pending", createdAt: agoStamp(3, "11:40") },
];

// Dashboard activity feed: the five most recent history events across all lots.
export const LOG_ACTIVITY: ActivityEvent[] = (() => {
  const events = LOG_TAGS.flatMap((t) => t.history.map((h) => ({ t, h, ms: stampMs(h.t) ?? 0 })))
    .filter((x) => !x.h.e.startsWith("Released"))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);
  const typeOf = (e: string): ActivityEvent["type"] =>
    e.startsWith("Scaled") ? "receive" : e.startsWith("Allocated") ? "reserve" : e.startsWith("Moved") || e.startsWith("In transit") ? "move" : e.startsWith("Flagged") ? "qc" : "scan";
  return events.map(({ t, h, ms }) => ({ type: typeOf(h.e), msg: `${t.id} · ${h.e}`, worker: h.w, time: relative(ms, true), tagId: t.id }));
})();

export const LOG_FLOOR_TASKS: FloorTask[] = [
  { title: "Scale incoming truckload — Douglas-fir", loc: "SORT · scale deck", priority: "High" },
  { title: `Check boom chains on ${LOG_ORDERS.find((o) => o.status === "Open")?.boom?.id ?? "open booms"}`, loc: "WL-S · Water Lot South", priority: "Normal" },
  { title: "Re-scale disputed hemlock lot", loc: "SORT · Bay 3", priority: "Normal" },
];
