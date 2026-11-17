// Shared analytics math — the single definition of every number Pulse and the Dashboard
// report, so the same metric can't be computed two different ways on two pages.
//
// Definitions used throughout:
//   Booked order   an order that is Open, Picked or Shipped (Draft and Cancelled never
//                  count toward sales).
//   Net value      qty × unit price, minus the line discount (calcExtendedPrice).
//   Order date     SalesOrder.date — sales are attributed to the day the order was placed.
//   Ship date      the "Shipped via SO-xxxx" history stamp on the order's tags (written by
//                  App when an order is advanced to Shipped). Null when unknown.
//   Days in yard   days since the tag's first history event (its receipt).
import type { SalesOrder, SalesOrderStatus, Tag } from "./types";
import { calcExtendedPrice } from "./pricing";
import { profileOf, volumeForQty } from "./products";

export const DAY_MS = 86_400_000;
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

// ── Dates ────────────────────────────────────────────────────────────────────────

// ISO YYYY-MM-DD → epoch ms at local midnight.
export function isoToMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function msToIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Display stamp "Jun 01 2026 08:12" (time optional) → epoch ms, or null.
export function parseStampMs(t: string): number | null {
  const m = t.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})(?: (\d{2}):(\d{2}))?/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return null;
  const ms = new Date(Number(m[3]), monthIdx, Number(m[2]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function startOfTodayMs(): number {
  return new Date().setHours(0, 0, 0, 0);
}

// Calendar-day arithmetic (DST-safe, unlike adding multiples of DAY_MS).
export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Monday of the week containing `ms`, at local midnight.
export function weekStartMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function monthStartMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// "Oct 5" / "Oct 26" — short day label for chart axes and drill-through labels.
export function shortDayLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// "Oct 26" — short month + 2-digit year.
export function shortMonthLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

// ── Date range (the global Pulse period picker) ──────────────────────────────────

export type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

export const RANGE_OPTIONS: { key: RangeKey; label: string; short: string }[] = [
  { key: "7d", label: "Last 7 days", short: "7D" },
  { key: "30d", label: "Last 30 days", short: "30D" },
  { key: "90d", label: "Last 90 days", short: "90D" },
  { key: "ytd", label: "Year to date", short: "YTD" },
  { key: "all", label: "All time", short: "All" },
];

// `start` is inclusive, `end` exclusive (midnight after today). The previous period is
// the window of equal length immediately before `start`; "All time" has nothing to
// compare against, so its prev bounds are null.
export interface DateRange {
  key: RangeKey;
  label: string;
  start: number | null;
  end: number;
  prevStart: number | null;
  prevEnd: number | null;
  days: number | null;
}

export function resolveRange(key: RangeKey, todayMs: number): DateRange {
  const label = RANGE_OPTIONS.find((o) => o.key === key)?.label ?? "";
  const end = addDays(todayMs, 1);
  if (key === "all") return { key, label, start: null, end, prevStart: null, prevEnd: null, days: null };
  let days: number;
  if (key === "ytd") {
    const jan1 = new Date(new Date(todayMs).getFullYear(), 0, 1).getTime();
    days = Math.round((end - jan1) / DAY_MS);
  } else {
    days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  }
  const start = addDays(end, -days);
  return { key, label, start, end, prevStart: addDays(start, -days), prevEnd: start, days };
}

// A period-over-period comparison is only shown when the data reaches back far enough to
// cover the whole previous window — otherwise a half-empty baseline reads as a huge jump.
export function hasFullPrevPeriod(r: DateRange, earliestDataMs: number | null): boolean {
  return r.prevStart !== null && earliestDataMs !== null && earliestDataMs <= r.prevStart;
}

export function inRange(ms: number | null, r: DateRange): boolean {
  if (ms === null) return false;
  return (r.start === null || ms >= r.start) && ms < r.end;
}

export function inPrevRange(ms: number | null, r: DateRange): boolean {
  if (ms === null || r.prevStart === null || r.prevEnd === null) return false;
  return ms >= r.prevStart && ms < r.prevEnd;
}

// ── Period-over-period delta ─────────────────────────────────────────────────────

export interface Delta {
  pct: number;
  dir: "up" | "down" | "flat";
}

// Null when there is no prior value to compare against (never a misleading 0% or ∞%).
// Direction is decided on the rounded %, so a sub-0.5% move reads as flat.
export function pctDelta(current: number, previous: number | null): Delta | null {
  if (previous === null || previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

// ── Orders ───────────────────────────────────────────────────────────────────────

export const BOOKED_STATUSES: SalesOrderStatus[] = ["Open", "Picked", "Shipped"];
export const ACTIVE_STATUSES: SalesOrderStatus[] = ["Open", "Picked"];

export interface OrderMetrics {
  so: SalesOrder;
  booked: boolean;
  orderMs: number;
  gross: number; // list value before discounts
  net: number; // after discounts
  discount: number; // gross − net
  volume: number; // volume on the order, in the line tags' measure unit
  cost: number; // summed over lines whose tag has a cost
  costKnown: boolean; // false if any line's tag has no cost (margin would be overstated)
  dueMs: number | null; // expected ship date
  shippedMs: number | null; // actual ship date (from tag history), null when unknown
  species: string[];
}

export function buildOrderMetrics(salesOrders: SalesOrder[], tags: Tag[]): OrderMetrics[] {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  return salesOrders.map((so) => {
    let gross = 0;
    let net = 0;
    let volume = 0;
    let cost = 0;
    let costKnown = so.lineItems.length > 0;
    let shippedMs: number | null = null;
    const species = new Set<string>();
    // Written by App when the order ships ("Shipped via SO-…") or a boom is delivered
    // ("Delivered via SO-…").
    const shipMarkers = [`Shipped via ${so.id}`, `Delivered via ${so.id}`];
    for (const li of so.lineItems) {
      gross += li.qty * li.unitPrice;
      net += calcExtendedPrice(li.qty, li.unitPrice, li.discountPct);
      const tag = tagById.get(li.tagId);
      if (!tag) {
        costKnown = false;
        continue;
      }
      species.add(tag.species);
      volume += volumeForQty(tag, li.qty);
      if (tag.cost === undefined) costKnown = false;
      else cost += tag.cost * li.qty;
      for (const ev of tag.history) {
        if (!shipMarkers.some((mk) => ev.e.startsWith(mk))) continue;
        const ms = parseStampMs(ev.t);
        if (ms !== null && (shippedMs === null || ms > shippedMs)) shippedMs = ms;
      }
    }
    return {
      so,
      booked: BOOKED_STATUSES.includes(so.status),
      orderMs: isoToMs(so.date),
      gross,
      net,
      discount: gross - net,
      volume: Math.round(volume),
      cost,
      costKnown,
      dueMs: so.expectedShipDate ? isoToMs(so.expectedShipDate) : null,
      shippedMs: so.status === "Shipped" ? shippedMs : null,
      species: [...species],
    };
  });
}

// Net booked sales bucketed by week (window ≤ ~3 months) or by month. Every bucket in
// the window is pre-filled so quiet periods show as gaps rather than missing bars.
// `firstMs` is the window start (the period start, or the earliest order for "All time").
export interface SalesBucket {
  ms: number;
  label: string; // axis label
  full: string; // drill-through label, e.g. "week of Oct 5"
  net: number;
  orders: number;
  ids: string[];
}

export function buildSalesTrend(booked: OrderMetrics[], firstMs: number, todayMs: number): { rows: SalesBucket[]; monthly: boolean } {
  const monthly = (todayMs - firstMs) / DAY_MS > 100;
  const bucketOf = monthly ? monthStartMs : weekStartMs;
  const buckets = new Map<number, { net: number; ids: string[] }>();
  for (let ms = bucketOf(firstMs); ms <= todayMs; ms = monthly ? monthStartMs(addDays(ms, 32)) : addDays(ms, 7)) {
    buckets.set(ms, { net: 0, ids: [] });
  }
  for (const m of booked) {
    const b = buckets.get(bucketOf(m.orderMs));
    if (!b) continue;
    b.net += m.net;
    b.ids.push(m.so.id);
  }
  const rows = [...buckets.entries()]
    .sort(([x], [y]) => x - y)
    .map(([ms, v]) => ({
      ms,
      label: monthly ? shortMonthLabel(ms) : shortDayLabel(ms),
      full: monthly ? shortMonthLabel(ms) : `week of ${shortDayLabel(ms)}`,
      net: Math.round(v.net),
      orders: v.ids.length,
      ids: v.ids,
    }));
  return { rows, monthly };
}

// ── Inventory ────────────────────────────────────────────────────────────────────

export function daysInYard(tag: Tag, todayMs: number): number {
  const received = tag.history[0]?.t ? parseStampMs(tag.history[0].t) : null;
  const from = received ?? isoToMs(tag.date);
  return Math.max(0, Math.floor((todayMs - from) / DAY_MS));
}

export const AGING_THRESHOLD_DAYS = 91;
export const ON_HAND_STATUSES: Tag["status"][] = ["Pending", "Received", "Available", "Reserved", "Discrepancy"];

// Low stock is about what is still in the yard — a tag that has shipped is gone, not
// low. The threshold comes from the tag's product profile (lumber: 50 pcs, logs: 20 m³).
export function isLowStock(tag: Tag): boolean {
  return tag.status !== "Shipped" && tag.qty < profileOf(tag).lowStockQty;
}

// Shortage & asset rows by species + grade. A group is in shortage when a confirmed
// (Open or Picked) order draws on it but nothing is left Available to sell.
// Shipped is excluded from Physical (already out the gate); Pending / Received count
// toward Physical since they're on-yard even if not yet quotable.
export interface ShortageRow {
  species: string;
  grade: string;
  physicalFbm: number;
  reservedFbm: number;
  availableFbm: number;
  availableCount: number;
  hasOpenDemand: boolean;
  shortage: boolean;
}

export function buildShortageRows(tags: Tag[], salesOrders: SalesOrder[]): ShortageRow[] {
  const groups = new Map<string, ShortageRow>();
  for (const t of tags) {
    const key = `${t.species}|${t.grade}`;
    const g = groups.get(key) ?? { species: t.species, grade: t.grade, physicalFbm: 0, reservedFbm: 0, availableFbm: 0, availableCount: 0, hasOpenDemand: false, shortage: false };
    if (t.status !== "Shipped") g.physicalFbm += t.volume;
    if (t.status === "Reserved") g.reservedFbm += t.volume;
    if (t.status === "Available") {
      g.availableFbm += t.volume;
      g.availableCount += 1;
    }
    groups.set(key, g);
  }
  const tagById = new Map(tags.map((t) => [t.id, t]));
  for (const so of salesOrders) {
    if (!ACTIVE_STATUSES.includes(so.status)) continue;
    for (const li of so.lineItems) {
      const t = tagById.get(li.tagId);
      const g = t ? groups.get(`${t.species}|${t.grade}`) : undefined;
      if (g) g.hasOpenDemand = true;
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, shortage: g.hasOpenDemand && g.availableFbm === 0 }))
    .sort((a, b) => {
      // Shortages float to the top, then alphabetical by species then grade.
      if (a.shortage !== b.shortage) return a.shortage ? -1 : 1;
      return a.species.localeCompare(b.species) || a.grade.localeCompare(b.grade);
    });
}

// On-hand inventory value (everything not yet Shipped). Cost and market value are
// per piece and only present on some tags, so `uncosted` reports how many on-hand tags
// were left out — the totals are a floor, not an estimate of the missing ones.
export function inventoryValue(tags: Tag[]): { cost: number; market: number; volume: number; counted: number; uncosted: number } {
  let cost = 0;
  let market = 0;
  let volume = 0;
  let counted = 0;
  let uncosted = 0;
  for (const t of tags) {
    if (t.status === "Shipped") continue;
    volume += t.volume;
    if (t.cost === undefined) {
      uncosted += 1;
      continue;
    }
    counted += 1;
    cost += t.cost * t.qty;
    market += (t.marketValue ?? t.cost) * t.qty;
  }
  return { cost, market, volume, counted, uncosted };
}

// Was this tag Available at `ms`? Replays the tag's movement history: release / creation
// events open availability; reserve, ship, flag and manual status changes close it.
function wasAvailableAt(tag: Tag, ms: number): boolean {
  let available = false;
  for (const ev of tag.history) {
    const at = parseStampMs(ev.t);
    if (at === null || at > ms) continue;
    const e = ev.e;
    if (e.startsWith("Released") || e.startsWith("Tag created via Tag Entry") || e.startsWith("Status changed to Available")) available = true;
    else if (["Split from", "Reserved", "Allocated", "Shipped", "Delivered", "Picked", "Flagged", "Status changed to"].some((p) => e.startsWith(p))) available = false;
    // "Split N pcs into …" leaves the parent Available — no change.
  }
  return available;
}

// Available tag count + volume at `points` weekly checkpoints ending today (oldest first).
// Past checkpoints are reconstructed from tag history; the final point is the live
// status, so the series always ends on the number shown beside it.
export function availabilityHistory(tags: Tag[], todayMs: number, points = 7, stepDays = 7): { ms: number; count: number; volume: number }[] {
  const out: { ms: number; count: number; volume: number }[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const dayEnd = addDays(todayMs, 1 - i * stepDays) - 1;
    const live = i === 0;
    let count = 0;
    let volume = 0;
    for (const t of tags) {
      if (live ? t.status === "Available" : wasAvailableAt(t, dayEnd)) {
        count += 1;
        volume += t.volume;
      }
    }
    out.push({ ms: dayEnd, count, volume });
  }
  return out;
}

// ── Formatting ───────────────────────────────────────────────────────────────────

// "$12,340" — whole dollars, for KPI tiles and table totals.
export function fmtMoney(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}

// "$12.3k" / "$950" — compact, for chart axes.
export function fmtMoneyCompact(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(v)}`;
}

export function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`;
}
