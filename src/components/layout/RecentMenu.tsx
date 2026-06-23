import { useEffect, useState } from "react";
import { History, ChevronDown, Tag as TagIcon, FileText } from "lucide-react";
import type { RecentRecord } from "@/lib/types";
import { useRecentRecords } from "@/hooks/useRecentRecords";

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function RecentMenu({ onOpenRecord }: { onOpenRecord: (r: RecentRecord) => void }) {
  const { records } = useRecentRecords();
  const [open, setOpen] = useState(false);

  // Refresh the relative timestamps while the panel is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 h-9 rounded-md text-[13px] text-text-sec hover:text-text cursor-pointer"
      >
        <History size={16} />
        <span>Recent</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] w-[300px] bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-sage z-50 overflow-hidden">
            <div className="px-3 py-2 text-[11px] font-semibold text-text-ter uppercase tracking-[1px] border-b border-sage">Recent</div>
            {records.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-text-ter">No recent records yet. Open something to get started.</div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                {records.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { onOpenRecord(r); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 min-h-[44px] py-2 text-left hover:bg-sage/20 cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded-md bg-sage/30 flex items-center justify-center shrink-0">
                      {r.type === "tag" ? <TagIcon size={14} className="text-ink" /> : <FileText size={14} className="text-ink" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-mono text-[13px] text-ink truncate">{r.label}</span>
                      <span className="block text-[11px] text-text-ter">{relativeTime(r.timestamp)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
