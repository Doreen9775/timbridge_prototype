import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { RecentRecord, RecentRecordType } from "@/lib/types";

// Recent-records store (kickoff §8 was React-state-only, but Batch 1 Prompt 3 calls for
// persistence — confirmed with the user). Small custom hook + context, no state library.
const STORAGE_KEY = "timbridge_recent_records";
const MAX = 20;

function load(): RecentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface RecentContextValue {
  records: RecentRecord[];
  pushRecord: (r: { type: RecentRecordType; id: string; label: string }) => void;
}

const RecentContext = createContext<RecentContextValue | null>(null);

export function RecentRecordsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<RecentRecord[]>(load);

  const pushRecord = useCallback((r: { type: RecentRecordType; id: string; label: string }) => {
    setRecords((prev) => {
      // dedupe by id, bump timestamp, move to top, cap at MAX
      const next = [{ ...r, timestamp: Date.now() }, ...prev.filter((x) => x.id !== r.id)].slice(0, MAX);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors (private mode / quota)
      }
      return next;
    });
  }, []);

  return <RecentContext.Provider value={{ records, pushRecord }}>{children}</RecentContext.Provider>;
}

export function useRecentRecords(): RecentContextValue {
  const ctx = useContext(RecentContext);
  if (!ctx) throw new Error("useRecentRecords must be used within RecentRecordsProvider");
  return ctx;
}
