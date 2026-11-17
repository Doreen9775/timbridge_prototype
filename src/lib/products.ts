// Product profiles — what is industry-specific about a unit of inventory.
//
// Timbridge's core (the Tag table, the 6-state lifecycle, orders, reservations,
// approvals, reports) is the same for every forest-products business. What differs by
// segment is how a unit is described, what it is measured in, and how it is priced.
// A ProductProfile captures exactly that, so shared logic asks the profile instead of
// assuming lumber:
//
//   - `measure`   the unit a tag's `volume` is stored in (lumber: board feet)
//   - `pricing`   what `unitPrice` / `cost` / `marketValue` are quoted per (lumber: piece)
//   - `volumeOf`  how many measure units a given piece count represents
//
// Rules for shared code:
//   1. Read a tag's size through `tag.volume` and `volumeForQty` — never recompute it
//      from thick × width × length, which only means something for lumber.
//   2. Label a volume with `formatVolume` / the profile's `measure.short`.
//   3. Never add volumes from different measure units together (see `sameMeasure`).
//
// Two profiles exist: lumber (counted in pieces, measured in board feet) and logs
// (scaled lots counted and measured in m³). Lumber-only screens (Tag Entry's form, the
// Stock Locator drawer's board-feet / lineal stats, Delivery Slip parsing) are that
// profile's own UI and may keep using the board-foot helpers in `fbm.ts` directly.
import type { Tag } from "./types";
import { calcFbm } from "./fbm";

export type ProductTypeId = "lumber" | "log";

export interface MeasureUnit {
  id: "fbm" | "m3";
  short: string; // compact label, e.g. "FBM"
  long: string; // spelled out, e.g. "board feet"
  decimals: number; // display precision
}

export interface PricingUnit {
  id: "piece" | "m3";
  short: string; // e.g. "pc"
  long: string; // e.g. "per piece"
}

export interface ProductProfile {
  id: ProductTypeId;
  label: string;
  measure: MeasureUnit;
  pricing: PricingUnit;
  // What a tag's `qty` and an order line's `qty` count. Lumber counts pieces; a scaled
  // log lot is counted directly in m³ (so allocating "30" means 30 m³).
  quantity: { short: string; long: string; decimals: number };
  // Whether the tag carries thick × width × length dimensions.
  dimensioned: boolean;
  // A tag with `qty` below this is flagged as low stock.
  lowStockQty: number;
  // Volume (in `measure`) of `qty` pieces of this tag's specification.
  volumeOf: (spec: Pick<Tag, "thick" | "width" | "length">, qty: number) => number;
}

const LUMBER: ProductProfile = {
  id: "lumber",
  label: "Lumber",
  measure: { id: "fbm", short: "FBM", long: "board feet", decimals: 0 },
  pricing: { id: "piece", short: "pc", long: "per piece" },
  quantity: { short: "pcs", long: "pieces", decimals: 0 },
  dimensioned: true,
  lowStockQty: 50,
  // FBM = thickness (in) × width (in) × length (ft) × pieces ÷ 12, rounded to whole board feet.
  volumeOf: (spec, qty) => calcFbm(spec.thick, spec.width, spec.length, qty),
};

// A scaled log lot: one scale ticket's worth of logs of a species and grade. Volume is
// the scaled volume in m³, and the lot's quantity is that same volume — so partial
// allocation, pricing (per m³) and splitting all work on m³ directly. The log count is
// kept separately on the tag (`pieces`) for reference.
const LOG: ProductProfile = {
  id: "log",
  label: "Logs",
  measure: { id: "m3", short: "m³", long: "cubic metres", decimals: 1 },
  pricing: { id: "m3", short: "m³", long: "per m³" },
  quantity: { short: "m³", long: "cubic metres", decimals: 1 },
  dimensioned: false,
  lowStockQty: 20,
  volumeOf: (_spec, qty) => Math.round(qty * 10) / 10,
};

export const PRODUCT_PROFILES: Record<ProductTypeId, ProductProfile> = { lumber: LUMBER, log: LOG };

// The profile every new record gets until a company can choose its product mix.
export const DEFAULT_PRODUCT_TYPE: ProductTypeId = "lumber";

export function profileOf(tag: Pick<Tag, "productType">): ProductProfile {
  return PRODUCT_PROFILES[tag.productType] ?? PRODUCT_PROFILES[DEFAULT_PRODUCT_TYPE];
}

// Volume of `qty` pieces drawn from `tag` — the size of an order line or a split-off
// child. Unrounded (fractional board feet) so sums over many lines stay accurate;
// round when displaying.
export function volumeForQty(tag: Tag, qty: number): number {
  const perPiece = tag.qty > 0 ? tag.volume / tag.qty : 0;
  return perPiece * qty;
}

// Volume of a whole tag at a new piece count (used when a tag is split or edited) —
// recomputed from the specification, rounded like a freshly entered tag.
export function volumeOfTag(tag: Pick<Tag, "productType" | "thick" | "width" | "length">, qty: number): number {
  return profileOf(tag).volumeOf(tag, qty);
}

// True when every tag shares one measure unit, i.e. their volumes can be summed.
export function sameMeasure(tags: Pick<Tag, "productType">[]): boolean {
  const units = new Set(tags.map((t) => profileOf(t).measure.id));
  return units.size <= 1;
}

// "1,234 FBM" — a volume with its unit.
export function formatVolume(value: number, profile: ProductProfile = PRODUCT_PROFILES[DEFAULT_PRODUCT_TYPE]): string {
  const rounded = Number(value.toFixed(profile.measure.decimals));
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: profile.measure.decimals })} ${profile.measure.short}`;
}
