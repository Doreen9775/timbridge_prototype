import { useState } from "react";
import type { Role, View } from "@/lib/types";

// Current role + surface. Manager/Sales/Floor is a three-way toggle (kickoff §4.2/§8);
// the permission matrix (Sidebar nav gating, Stock Locator Pricing/Linked Transactions)
// already keys off `role` directly.
export function useRole() {
  const [role, setRole] = useState<Role>("manager");
  const isFloor = role === "floor";
  const view: View = isFloor ? "tablet" : "desktop";

  return { role, setRole, view, isFloor };
}
