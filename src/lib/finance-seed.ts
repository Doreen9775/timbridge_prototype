// Accounting history for a pack's demo company, derived from its seed orders and stock
// so every invoice matches a real shipment and every bill a real receipt. Authored
// relative to today, like the rest of the seed:
//   - shipped in the last 4 days          → not invoiced yet (sits in "Ready to invoice")
//   - invoiced in the last 2 days         → draft, not yet sent to QuickBooks
//   - older invoices                      → in QuickBooks; most paid on terms, a couple
//                                           overdue, one part-paid
//   - bills follow the same pattern against stock received from outside sellers
import type { Client, SalesOrder, Tag } from "./types";
import {
  buildBill, buildInvoice, isoAddDays, readyToBill, shipDateOf, termsDays, todayIso,
  type AccountingSettings, type FinDoc, type SyncLogEntry,
} from "./finance";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const stamp = (iso: string, hhmm: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")} ${y} ${hhmm}`;
};
const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
};
const minIso = (a: string, b: string) => (a < b ? a : b);
const maxIso = (a: string, b: string) => (a > b ? a : b);

export function buildFinanceSeed(
  tags: Tag[],
  orders: SalesOrder[],
  clients: Client[],
  settings: AccountingSettings,
): { docs: FinDoc[]; log: SyncLogEntry[] } {
  const today = todayIso();
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const docs: FinDoc[] = [];
  const log: { iso: string; hhmm: string; text: string }[] = [];

  // ── Invoices ──────────────────────────────────────────────────────────────────
  const shipped = orders
    .filter((so) => so.status === "Shipped")
    .map((so) => ({ so, shipIso: shipDateOf(so, tags) }))
    .sort((a, b) => a.shipIso.localeCompare(b.shipIso) || a.so.id.localeCompare(b.so.id));
  let inv = 1000;
  shipped.forEach(({ so, shipIso }, i) => {
    const age = daysBetween(shipIso, today);
    if (age <= 4) return; // not invoiced yet
    const date = minIso(isoAddDays(shipIso, i % 2), today);
    inv += 1;
    const doc = buildInvoice(so, tags, clientById.get(so.clientId), `INV-${inv}`, settings, date);
    if (daysBetween(date, today) > 5) {
      const sentIso = isoAddDays(date, 1);
      doc.sync = { state: "synced", externalId: `QB-${4100 + inv - 1000}`, at: stamp(sentIso, "09:15") };
      log.push({ iso: sentIso, hhmm: "09:15", text: `Sent ${doc.id} to QuickBooks (${doc.partyName}, $${doc.subtotal.toLocaleString()})` });
      const terms = termsDays(doc.terms);
      const due = doc.dueDate;
      let pay: { iso: string; amount: number } | null = null;
      // Only recent invoices are still outstanding — anything due long ago has been settled.
      const recent = daysBetween(due, today) <= 40;
      if (due < today) {
        if (recent && i % 11 === 5) pay = null; // overdue
        else if (recent && i % 13 === 6) pay = { iso: maxIso(isoAddDays(due, -3), isoAddDays(date, 1)), amount: Math.round(doc.subtotal * 50) / 100 };
        else pay = { iso: minIso(isoAddDays(date, Math.max(2, terms - (i % 5))), today), amount: doc.subtotal };
      } else if (i % 4 === 0 && terms > 0) {
        const early = isoAddDays(date, Math.floor(terms / 2));
        if (early < today) pay = { iso: early, amount: doc.subtotal };
      }
      if (pay) {
        doc.payments.push({ date: pay.iso, amount: pay.amount, ref: `QB-PMT-${7000 + inv - 1000}` });
        log.push({ iso: pay.iso, hhmm: "16:40", text: `Payment of $${pay.amount.toLocaleString()} recorded in QuickBooks for ${doc.id}` });
      }
    }
    docs.push(doc);
  });

  // ── Bills ─────────────────────────────────────────────────────────────────────
  const toBill = readyToBill(tags, []).sort((a, b) => a.date.localeCompare(b.date) || a.supplier.localeCompare(b.supplier));
  let bill = 2000;
  toBill.forEach((rc, j) => {
    const age = daysBetween(rc.date, today);
    if (age <= 5) return; // not billed yet
    const date = minIso(isoAddDays(rc.date, 1), today);
    bill += 1;
    const doc = buildBill(rc, tags, `BILL-${bill}`, settings, date);
    if (daysBetween(date, today) > 6) {
      const sentIso = isoAddDays(date, 1);
      doc.sync = { state: "synced", externalId: `QB-B${3100 + bill - 2000}`, at: stamp(sentIso, "10:05") };
      log.push({ iso: sentIso, hhmm: "10:05", text: `Sent ${doc.id} to QuickBooks (${doc.partyName}, $${doc.subtotal.toLocaleString()})` });
      if (doc.dueDate < isoAddDays(today, -2) && j % 13 !== 6) {
        const paidIso = isoAddDays(doc.dueDate, -(j % 4));
        doc.payments.push({ date: paidIso, amount: doc.subtotal, ref: `QB-BP-${5000 + bill - 2000}` });
        log.push({ iso: paidIso, hhmm: "11:20", text: `Bill payment of $${doc.subtotal.toLocaleString()} recorded in QuickBooks for ${doc.id}` });
      }
    }
    docs.push(doc);
  });

  // Newest first, capped — enough to show the connection is alive.
  const entries = log
    .filter((e) => e.iso <= today)
    .sort((a, b) => (b.iso + b.hhmm).localeCompare(a.iso + a.hhmm))
    .slice(0, 25)
    .map((e) => ({ at: stamp(e.iso, e.hhmm), text: e.text }));
  return { docs, log: entries };
}
