import { useState } from "react";
import type { SalesOrder } from "@/lib/types";

// The Sales Order table store — mirrors useTags. Mutable so linking a tag to an
// order (Available → Reserved) can append a real lineItem (§4.5 state machine).
// `seed` comes from the active industry pack (lib/packs.ts).
export function useSalesOrders(seed: SalesOrder[]) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(seed);
  return { salesOrders, setSalesOrders };
}
