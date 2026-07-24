import { useState } from "react";
import { INITIAL_APPROVAL_REQUESTS } from "@/lib/mock-data";
import type { ApprovalRequest } from "@/lib/types";

// Approval-request store — mirrors useTags / useSalesOrders. Seeded with a couple of
// demo Pending requests (see INITIAL_APPROVAL_REQUESTS) so the Approval Queue has
// something to show; further requests are created via the Sales Order detail panel
// and the Request Discount quick-entry form.
export function useApprovalRequests() {
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(INITIAL_APPROVAL_REQUESTS);
  return { approvalRequests, setApprovalRequests };
}
