import type { TagStatus } from "@/lib/types";

// Color per lifecycle state (kickoff §4.5). Tints chosen to echo the dashboard
// pie: Available = lime/green, Reserved = coral, Discrepancy = ink, rest neutral.
const STYLES: Record<TagStatus, string> = {
  Available: "bg-[#EAF5D0] text-[#4E6B0E]",
  Received: "bg-[#E5E7EB] text-[#4B5563]",
  Pending: "bg-[#E7EEEA] text-[#5C6B63]",
  Reserved: "bg-[#FCE0D7] text-[#B23A1A]",
  Shipped: "bg-[#EDEFF2] text-[#6B7280]",
  Discrepancy: "bg-ink text-white",
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
