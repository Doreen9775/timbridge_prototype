import { useState } from "react";
import { salesOrders as initialSalesOrders } from "@/lib/mock-data";
import type { SalesOrder } from "@/lib/types";

// The Sales Order table store — mirrors useTags. Mutable so linking a tag to an
// order (Available → Reserved) can append a real lineItem (§4.5 state machine).
export function useSalesOrders() {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(initialSalesOrders);
  return { salesOrders, setSalesOrders };
}
