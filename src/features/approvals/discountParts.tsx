import { useMemo } from "react";
import type { ApprovalRequest, SalesOrder, Tag } from "@/lib/types";
import { calcExtendedPrice } from "@/lib/pricing";

// Shared presentational pieces for the approval detail views (Manager's ApprovalQueue
// and Sales' MyApprovals). Kept in one place so both surfaces render the discount calc
// and affected line items identically.

export function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Original price = the related order's line items, gross (no discount) — reuses the same
// calcExtendedPrice used for Sales Order line items, called with no discount arg per line.
// Returns null when there's nothing to compute against (no related order / not found).
export function originalPriceFor(req: ApprovalRequest, salesOrders: SalesOrder[]): number | null {
  if (!req.relatedSoId) return null;
  const so = salesOrders.find((s) => s.id === req.relatedSoId);
  if (!so) return null;
  return so.lineItems.reduce((sum, li) => sum + calcExtendedPrice(li.qty, li.unitPrice), 0);
}

// Discount calc block — original price, requested rate, and the live-computed discounted
// price (Original × (1 − rate)). Only renders for discount-type requests that have both a
// related order and a discount rate.
export function DiscountCalc({ req, salesOrders }: { req: ApprovalRequest; salesOrders: SalesOrder[] }) {
  if (req.type !== "discount" || req.discountRate === undefined) return null;
  const original = originalPriceFor(req, salesOrders);
  if (original === null) return null;
  const calculated = calcExtendedPrice(1, original, req.discountRate);

  return (
    <div className="bg-[#F9FAFB] rounded-md px-3 py-2.5 flex items-center gap-5">
      <div>
        <div className="text-[10px] text-text-ter uppercase tracking-wide">Original</div>
        <div className="text-[13px] font-semibold text-text">{formatUSD(original)}</div>
      </div>
      <div className="text-text-ter">×</div>
      <div>
        <div className="text-[10px] text-text-ter uppercase tracking-wide">Discount</div>
        <div className="text-[13px] font-semibold text-text">{req.discountRate}%</div>
      </div>
      <div className="text-text-ter">=</div>
      <div>
        <div className="text-[10px] text-text-ter uppercase tracking-wide">Discounted price</div>
        <div className="text-[15px] font-bold text-coral">{formatUSD(calculated)}</div>
      </div>
    </div>
  );
}

// Read-only line-item list for the affected order — mirrors SalesOrderPanel's locked
// line-item rows visually.
export function LineItemsList({ so, tags }: { so: SalesOrder; tags: Tag[] }) {
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  return (
    <div className="flex flex-col gap-1.5">
      {so.lineItems.map((li) => {
        const t = tagById.get(li.tagId);
        return (
          <div key={li.tagId} className="bg-[#F9FAFB] rounded-md px-3 py-2 flex items-center gap-2 text-[13px]">
            <span className="font-mono font-semibold text-ink whitespace-nowrap">{li.tagId}</span>
            <span className="flex-1 text-text truncate">
              {t ? `${t.species} · ${t.grade} · ${t.thick}×${t.width}×${t.length}'` : <span className="text-text-ter italic">tag not found</span>}
            </span>
            <span className="text-text-sec whitespace-nowrap">{li.qty.toLocaleString()} pcs</span>
            <span className="text-text-sec whitespace-nowrap">@ {formatUSD(li.unitPrice)}</span>
            <span className="text-ink font-semibold whitespace-nowrap w-[90px] text-right">
              {formatUSD(calcExtendedPrice(li.qty, li.unitPrice, li.discountPct))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
