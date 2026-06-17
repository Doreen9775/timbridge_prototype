import { useState } from "react";
import type { Role, View } from "@/lib/types";

// Current role + surface. For this phase only the Manager/Floor toggle is wired
// (kickoff §4.2); the Sales role and the full permission matrix come later (§8).
export function useRole() {
  const [role, setRole] = useState<Role>("manager");
  const isFloor = role === "floor";
  const view: View = isFloor ? "tablet" : "desktop";

  // Mirrors the artifact's Manager View / Floor View toggle.
  const setFloorView = (floor: boolean) => setRole(floor ? "floor" : "manager");

  return { role, setRole, view, isFloor, setFloorView };
}
