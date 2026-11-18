// Financial layer — business events in, accounting documents out.
//
// Timbridge does not keep a ledger. It knows what physically and commercially happened
// (stock received at a cost, goods delivered at an agreed price) and turns those events
// into accounting documents that the company's accounting system owns from then on:
//
//   event                              document   accounting system
//   order shipped / boom delivered  →  Invoice    receivable (AR)
//   stock received from a seller    →  Bill       payable (AP)
//
// Documents are created as drafts in Timbridge, then sent through a connector
// (QuickBooks Online, or a CSV export for companies without a supported system).
// Payments are recorded in the accounting system and read back. Tax is never computed
// here: documents carry a tax code and amounts before tax, and the accounting system
// applies the tax. This keeps each fact entered once, in the system that owns it.
import type { Client, SalesOrder, Tag } from "./types";
import { calcExtendedPrice } from "./pricing";
import { profileOf } from "./products";

// ── Documents ────────────────────────────────────────────────────────────────────

export type FinDocKind = "invoice" | "bill";
export type SyncState = "not_sent" | "synced" | "exported";

export interface FinLine {
  description: string;
  qty: number;
  unit: string; // pricing unit: "pc", "m³"
  unitPrice: number;
  discountPct?: number;
  amount: number; // before tax
  tagIds: string[];
}

export interface Payment {
  date: string; // ISO
  amount: number;
  ref: string; // reference from the accounting system
}

export interface FinDoc {
  id: string; // INV-1001 / BILL-2001
  kind: FinDocKind;
  // What the document bills: an order (invoice) or a receipt (bill, keyed
  // "supplier|ISO date").
  sourceId: string;
  partyId?: string; // client id (invoices)
  partyName: string; // customer or seller as written on the document
  date: string; // ISO issue date
  dueDate: string; // ISO
  terms: string; // "Net 30"
  lines: FinLine[];
  subtotal: number; // before tax
  taxCode: string;
  currency: string;
  sync: { state: SyncState; externalId?: string; at?: string };
  payments: Payment[]; // read back from the accounting system
}

export type DocStatus = "Draft" | "Open" | "Overdue" | "Partially paid" | "Paid";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function paidOf(doc: FinDoc): number {
  return r2(doc.payments.reduce((s, p) => s + p.amount, 0));
}

export function balanceOf(doc: FinDoc): number {
  return r2(Math.max(0, doc.subtotal - paidOf(doc)));
}

// Draft until it has left Timbridge (sent to the accounting system or exported);
// after that its standing comes from payments read back and the due date.
export function statusOf(doc: FinDoc, todayIso: string): DocStatus {
  if (doc.sync.state === "not_sent") return "Draft";
  const bal = balanceOf(doc);
  if (bal <= 0.005) return "Paid";
  if (doc.dueDate < todayIso) return "Overdue";
  return paidOf(doc) > 0 ? "Partially paid" : "Open";
}

// ── Terms and dates ──────────────────────────────────────────────────────────────

// "Net 30" → 30, "Net 45 + 2%" → 45, "COD" / unknown → 0 (due on issue).
export function termsDays(terms: string | undefined): number {
  const m = terms?.match(/net\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

const p2 = (n: number) => String(n).padStart(2, "0");
export function isoAddDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
}
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// ── Events → documents ───────────────────────────────────────────────────────────

const SELLER_TERMS = "Net 30";
const IN_HOUSE = "In-house production";

// The ship / delivery date of an order: a boom's confirmed delivery date, otherwise the
// "Shipped via SO-…" stamp on its tags, otherwise the order date.
export function shipDateOf(so: SalesOrder, tags: Tag[]): string {
  if (so.boom?.deliveredDate) return so.boom.deliveredDate;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ids = new Set(so.lineItems.map((li) => li.tagId));
  let best: string | null = null;
  for (const t of tags) {
    if (!ids.has(t.id)) continue;
    for (const h of t.history) {
      if (!h.e.startsWith(`Shipped via ${so.id}`) && !h.e.startsWith(`Delivered via ${so.id}`)) continue;
      const m = h.t.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})/);
      if (!m) continue;
      const iso = `${m[3]}-${p2(MONTHS.indexOf(m[1]) + 1)}-${m[2]}`;
      if (!best || iso > best) best = iso;
    }
  }
  return best ?? so.date;
}

// Invoice lines for a shipped order. A delivered boom is billed on the volume actually
// delivered: each line is scaled by delivered ÷ allocated.
export function invoiceLines(so: SalesOrder, tags: Tag[]): FinLine[] {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const allocated = so.lineItems.reduce((s, li) => s + li.qty, 0);
  const ratio = so.boom?.deliveredVolume !== undefined && allocated > 0 ? so.boom.deliveredVolume / allocated : 1;
  return so.lineItems.map((li) => {
    const t = tagById.get(li.tagId);
    const profile = t ? profileOf(t) : undefined;
    const qty = profile && !profile.dimensioned ? Math.round(li.qty * ratio * 10) / 10 : li.qty;
    const spec = t ? (profile?.dimensioned ? `${t.species} ${t.grade} ${t.thick}×${t.width}×${t.length}'` : `${t.species} logs, ${t.grade}`) : li.tagId;
    return {
      description: spec,
      qty,
      unit: profile?.pricing.short ?? "pc",
      unitPrice: li.unitPrice,
      ...(li.discountPct ? { discountPct: li.discountPct } : {}),
      amount: r2(calcExtendedPrice(qty, li.unitPrice, li.discountPct)),
      tagIds: [li.tagId],
    };
  });
}

// Orders that have shipped (or booms delivered) but have no invoice yet.
export function readyToInvoice(orders: SalesOrder[], docs: FinDoc[]): SalesOrder[] {
  const invoiced = new Set(docs.filter((d) => d.kind === "invoice").map((d) => d.sourceId));
  return orders.filter((so) => so.status === "Shipped" && !invoiced.has(so.id));
}

export interface Receipt {
  key: string; // "supplier|ISO date"
  supplier: string;
  date: string;
  tags: Tag[];
  amount: number;
}

// Stock bought from an outside seller, grouped into one receipt per seller per day.
// Only tags with a purchase cost count (in-house production has nothing to pay).
export function receipts(tags: Tag[]): Receipt[] {
  const groups = new Map<string, Receipt>();
  for (const t of tags) {
    if (t.status === "Pending" || t.cost === undefined || !t.supplier || t.supplier === IN_HOUSE) continue;
    // A split-off child was received as part of its parent — bill the parent's receipt once.
    if (t.parentTagId) continue;
    const key = `${t.supplier}|${t.date}`;
    const g = groups.get(key) ?? { key, supplier: t.supplier, date: t.date, tags: [], amount: 0 };
    g.tags.push(t);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    // Cost of what was received: a split parent's own qty plus its children's.
    g.amount = r2(
      g.tags.reduce((s, t) => {
        const children = tags.filter((c) => c.parentTagId === t.id);
        const qty = t.qty + children.reduce((a, c) => a + c.qty, 0);
        return s + (t.cost ?? 0) * qty;
      }, 0),
    );
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || a.supplier.localeCompare(b.supplier));
}

export function readyToBill(tags: Tag[], docs: FinDoc[]): Receipt[] {
  const billed = new Set(docs.filter((d) => d.kind === "bill").map((d) => d.sourceId));
  return receipts(tags).filter((r) => !billed.has(r.key));
}

export function nextDocId(docs: FinDoc[], kind: FinDocKind): string {
  const prefix = kind === "invoice" ? "INV-" : "BILL-";
  const base = kind === "invoice" ? 1000 : 2000;
  const max = docs.reduce((m, d) => (d.id.startsWith(prefix) ? Math.max(m, Number(d.id.slice(prefix.length)) || 0) : m), base);
  return `${prefix}${max + 1}`;
}

export function buildInvoice(so: SalesOrder, tags: Tag[], client: Client | undefined, id: string, settings: AccountingSettings, date = todayIso()): FinDoc {
  const lines = invoiceLines(so, tags);
  const terms = client?.paymentTerms ?? "Net 30";
  return {
    id,
    kind: "invoice",
    sourceId: so.id,
    partyId: so.clientId,
    partyName: client?.name ?? "Unknown customer",
    date,
    dueDate: isoAddDays(date, termsDays(terms)),
    terms,
    lines,
    subtotal: r2(lines.reduce((s, l) => s + l.amount, 0)),
    taxCode: settings.salesTaxCode,
    currency: settings.currency,
    sync: { state: "not_sent" },
    payments: [],
  };
}

export function buildBill(rc: Receipt, tags: Tag[], id: string, settings: AccountingSettings, date = todayIso()): FinDoc {
  const lines: FinLine[] = rc.tags.map((t) => {
    const profile = profileOf(t);
    const children = tags.filter((c) => c.parentTagId === t.id);
    const qty = Math.round((t.qty + children.reduce((a, c) => a + c.qty, 0)) * 10) / 10;
    return {
      description: profile.dimensioned
        ? `${t.species} ${t.grade} ${t.thick}×${t.width}×${t.length}' (${t.id})`
        : `${t.species} logs, ${t.grade} — scale ${t.scaleRef ?? t.id}`,
      qty,
      unit: profile.pricing.short,
      unitPrice: t.cost ?? 0,
      amount: r2((t.cost ?? 0) * qty),
      tagIds: [t.id, ...children.map((c) => c.id)],
    };
  });
  return {
    id,
    kind: "bill",
    sourceId: rc.key,
    partyName: rc.supplier,
    date,
    dueDate: isoAddDays(date, termsDays(SELLER_TERMS)),
    terms: SELLER_TERMS,
    lines,
    subtotal: r2(lines.reduce((s, l) => s + l.amount, 0)),
    taxCode: settings.purchaseTaxCode,
    currency: settings.currency,
    sync: { state: "not_sent" },
    payments: [],
  };
}

// ── Accounting settings + connectors ─────────────────────────────────────────────

export type ConnectorId = "quickbooks" | "xero" | "csv";

export interface AccountingSettings {
  connector: ConnectorId;
  connected: boolean; // QuickBooks: OAuth completed (mock)
  companyName: string; // the accounting file Timbridge is connected to
  invoiceTrigger: "onDelivery" | "manual"; // draft an invoice automatically when an order ships
  autoSend: boolean; // send new drafts to the accounting system immediately
  currency: string;
  salesTaxCode: string;
  purchaseTaxCode: string;
}

export const DEFAULT_ACCOUNTING: AccountingSettings = {
  connector: "quickbooks",
  connected: true,
  companyName: "",
  invoiceTrigger: "onDelivery",
  autoSend: false,
  currency: "CAD",
  salesTaxCode: "GST",
  purchaseTaxCode: "GST",
};

export interface ConnectorInfo {
  id: ConnectorId;
  label: string;
  description: string;
  available: boolean;
  syncs: boolean; // true = two-way sync; false = file export only
}

// The connector is the only part that knows about a specific accounting system. Adding
// Xero or Sage means adding an entry here and its push / read-back calls — documents,
// events and screens stay the same.
export const CONNECTORS: ConnectorInfo[] = [
  { id: "quickbooks", label: "QuickBooks Online", description: "Send invoices and bills to QuickBooks; read payments back.", available: true, syncs: true },
  { id: "xero", label: "Xero", description: "Same flow as QuickBooks.", available: false, syncs: true },
  { id: "csv", label: "No accounting system", description: "Export invoices and bills as CSV to import or file.", available: true, syncs: false },
];

export const TAX_CODES = ["GST", "GST + PST", "HST", "Exempt", "Zero-rated"];

// QuickBooks-style flat CSV: one row per line, document fields repeated on each row.
export function docsToCsv(docs: FinDoc[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Type", "DocNo", "Party", "Date", "DueDate", "Terms", "Currency", "LineDescription", "Qty", "Unit", "Rate", "DiscountPct", "Amount", "TaxCode"];
  const rows = docs.flatMap((d) =>
    d.lines.map((l) => [d.kind === "invoice" ? "Invoice" : "Bill", d.id, d.partyName, d.date, d.dueDate, d.terms, d.currency, l.description, l.qty, l.unit, l.unitPrice, l.discountPct ?? 0, l.amount, d.taxCode]),
  );
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export interface SyncLogEntry {
  at: string; // display stamp
  text: string;
}
