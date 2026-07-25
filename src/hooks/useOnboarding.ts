import { useCallback, useRef, useState } from "react";
import type { Role } from "@/lib/types";

// Onboarding tour state (React-only, no backend). Tracks which role's tour is active and
// remembers "seen" per role in localStorage so the auto-start fires only on a role's first
// visit. Manual "Take a tour" ignores the seen flag and always replays. The per-session
// `autoFired` guard keeps the auto-start from re-running the same role twice in one session
// (e.g. if the localStorage write is blocked).
const seenKey = (role: Role) => `timbridge_onboarding_seen_${role}`;

function readSeen(role: Role): boolean {
  try {
    return !!localStorage.getItem(seenKey(role));
  } catch {
    return false;
  }
}

function writeSeen(role: Role) {
  try {
    localStorage.setItem(seenKey(role), new Date().toISOString());
  } catch {
    /* ignore quota / privacy-mode failures — the session guard still prevents re-fire */
  }
}

export function useOnboarding() {
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const autoFired = useRef<Set<Role>>(new Set());

  // Start (or replay) a role's tour. Marks it auto-fired so the effect won't also fire it.
  const startTour = useCallback((role: Role) => {
    autoFired.current.add(role);
    setActiveRole(role);
  }, []);

  // Close the active tour and persist "seen" for whichever role it belonged to.
  const endTour = useCallback(() => {
    setActiveRole((current) => {
      if (current) writeSeen(current);
      return null;
    });
  }, []);

  const hasSeen = useCallback((role: Role) => readSeen(role), []);

  // Clear all "seen" state (persistent + this-session guard). Called on every sign-in so
  // the walkthrough auto-starts fresh each session — this is a demo prototype where every
  // tester should see it, sign-out → sign-in included. (Within a session, dismissing a tour
  // still stops it from re-popping until the next sign-in.)
  const resetOnboarding = useCallback(() => {
    autoFired.current.clear();
    (["manager", "sales", "floor"] as Role[]).forEach((role) => {
      try {
        localStorage.removeItem(seenKey(role));
      } catch {
        /* ignore */
      }
    });
  }, []);

  return { activeRole, startTour, endTour, hasSeen, autoFired, resetOnboarding };
}
