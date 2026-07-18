import type { SalesOrderStatus } from "@/lib/types";

// SO status pill — mirrors the Tag StatusBadge color scheme, remapped onto the
// SalesOrderStatus union. Shared across Stock Locator's Linked Transactions and
// the Sales Orders list/detail.
const SO_STATUS_STYLES: Record<SalesOrderStatus, string> = {
  Open: "bg-[#EEF0F2] text-[#6B7280]",
  Picked: "bg-[#EAF5D0] text-[#4E6B0E]",
  Shipped: "bg-[#D9DDE3] text-[#3B4250]",
  Cancelled: "bg-[#FCE0D7] text-[#B23A1A]",
};

export function SOStatusPill({ status, size = "sm" }: { status: SalesOrderStatus; size?: "sm" | "md" }) {
  const px = size === "md" ? "px-3 py-1 text-[13px]" : "px-2.5 py-[3px] text-[11px]";
  return (
    <span className={`whitespace-nowrap inline-block rounded-xl font-medium ${px} ${SO_STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
