import type { TagStatus } from "@/lib/types";

// Color per lifecycle state — tints of the unified status scheme (matches the dashboard
// pie): Available = sage, Reserved = lime, Discrepancy = coral (alert), rest neutral grays.
const STYLES: Record<TagStatus, string> = {
  Available: "bg-[#DCE7E1] text-[#33473C]", // sage
  Reserved: "bg-[#EAF5D0] text-[#4E6B0E]", // lime
  Discrepancy: "bg-[#FCE0D7] text-[#B23A1A]", // coral (alert)
  Pending: "bg-[#EEF0F2] text-[#6B7280]", // light gray
  Received: "bg-[#E2E5E9] text-[#4B5563]", // mid gray
  Shipped: "bg-[#D9DDE3] text-[#3B4250]", // darker gray
};

const SIZES = {
  sm: "px-2.5 py-[3px] rounded-xl text-[11px] font-medium",
  lg: "px-3.5 py-1.5 rounded-2xl text-sm font-medium",
};

interface StatusBadgeProps {
  status: TagStatus;
  size?: keyof typeof SIZES;
  className?: string;
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  return (
    <span className={["whitespace-nowrap inline-block", SIZES[size], STYLES[status], className].filter(Boolean).join(" ")}>
      {status}
    </span>
  );
}
