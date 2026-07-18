import { useState } from "react";
import type { ApprovalRequest } from "@/lib/types";

// Approval-request store — mirrors useTags / useSalesOrders. Seeded empty; requests
// are created via the Reserve modal and Sales Order detail entry points.
export function useApprovalRequests() {
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  return { approvalRequests, setApprovalRequests };
}
