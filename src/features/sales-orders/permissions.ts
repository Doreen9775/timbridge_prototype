import type { Role, SalesOrderStatus } from "@/lib/types";

// Single source of truth for what's editable on a Sales Order, gated by status.
// The panel derives three booleans from getSalesOrderEditMode() ONCE at the top
// and passes them down — no per-field status checks.
//
// Mapping (status vocabulary in code vs the spec):
//   Draft                → "edit-all"   (customer, line items, notes, ship date)
//   Open / Picked        → "meta-only"  (spec's "Confirmed / Reserved" —
//                                        tags are already reserved on the order,
//                                        so only notes + expected ship date edit)
//   Shipped / Cancelled  → "readonly"   (no edit controls render at all)
export type SOEditMode = "edit-all" | "meta-only" | "readonly";

export function getSalesOrderEditMode(status: SalesOrderStatus): SOEditMode {
  if (status === "Draft") return "edit-all";
  if (status === "Open" || status === "Picked") return "meta-only";
  return "readonly";
}

export const LOCK_TOOLTIP = "Cancel the reservation to modify line items.";

// Status moves offered on an order (Draft → Open is "Confirm Order", handled separately).
// Any forward move is allowed — Open can go straight to Shipped — and Picked can step back
// to Open. Cancelling releases reserved tags, so only a Manager does it directly; Sales asks
// through an approval request (type "orderCancellation"). Shipped and Cancelled are final.
export function statusTargets(status: SalesOrderStatus, role: Role): SalesOrderStatus[] {
  const cancel: SalesOrderStatus[] = role === "manager" ? ["Cancelled"] : [];
  if (status === "Draft") return ["Cancelled"];
  if (status === "Open") return ["Picked", "Shipped", ...cancel];
  if (status === "Picked") return ["Open", "Shipped", ...cancel];
  return [];
}
