// Shared extended-price math — single source of truth for "qty × unit price, minus an
// optional discount," reused by Sales Order line items and the Approval Queue's
// discount-request calculation. Not pre-rounded: callers format for display the same
// way extended price is formatted elsewhere (formatUSD's 2-decimal toLocaleString).
export function calcExtendedPrice(qty: number, unitPrice: number, discountPct?: number): number {
  const gross = qty * unitPrice;
  const pct = discountPct ?? 0;
  return gross * (1 - pct / 100);
}
