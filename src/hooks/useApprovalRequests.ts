import { useState } from "react";
import type { ApprovalRequest } from "@/lib/types";

// Approval-request store — mirrors useTags / useSalesOrders. Seeded with a couple of
// demo Pending requests (see INITIAL_APPROVAL_REQUESTS) so the Approval Queue has
// something to show; further requests are created via the Sales Order detail panel
// and the Request Discount quick-entry form.
// `seed` comes from the active industry pack (lib/packs.ts).
export function useApprovalRequests(seed: ApprovalRequest[]) {
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(seed);
  return { approvalRequests, setApprovalRequests };
}
