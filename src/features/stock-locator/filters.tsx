// Shared filter primitives — extracted from StockLocator so the Available-to-Sell
// page (and any future inventory views) can reuse the exact same auto-apply
// dropdowns without duplicating the popover shell, calendar, or trigger label.
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// "2026-02-14" → "14 Feb 2026" — shown directly on the Date filter trigger once a date is chosen.
export function formatFilterDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

// Shared dropdown shell: trigger (label + count badge + chevron) → click-outside popover.
// No Apply footer — every selection inside the popover applies immediately, and the
// popover stays open so users can keep toggling (click outside to dismiss).
export function FilterDropdown({
  label,
  triggerLabel,
  appliedCount,
  width = "w-[300px]",
  children,
  note,
}: {
  label: string;
  triggerLabel?: string;
  appliedCount: number;
  width?: string;
  children: ReactNode;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border bg-white",
          appliedCount > 0 ? "border-coral text-coral hover:bg-coral/5" : "border-sage text-text-sec hover:border-coral hover:text-coral",
        ].join(" ")}
      >
        <span>{triggerLabel ?? label}</span>
        {!triggerLabel && appliedCount > 0 && (
          <span className="bg-coral text-white rounded-full text-[10px] leading-none px-1.5 py-0.5 font-semibold">{appliedCount}</span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 top-[calc(100%+6px)] ${width} bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-sage z-50 overflow-hidden`}>
            <div className="p-4">{children}</div>
            <div className="px-4 pb-3 text-[11px] text-text-ter border-t border-sage/60 pt-2.5">{note}</div>
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select pill list (Species / Status / Location / Grade / Length / etc.).
// Each click toggles the option in `applied` immediately — the parent's filter
// state updates on every click, so the underlying table re-filters live.
export function PillFilter({
  label,
  options,
  applied,
  onApply,
}: {
  label: string;
  options: string[];
  applied: string[];
  onApply: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onApply(applied.includes(o) ? applied.filter((x) => x !== o) : [...applied, o]);
  return (
    <FilterDropdown label={label} appliedCount={applied.length} note="*Click to toggle · multi-select">
      <div className="text-sm font-semibold text-ink mb-3">Select {label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = applied.includes(o);
          return (
            <button
              key={o}
              onClick={() => toggle(o)}
              className={[
                "px-3.5 py-1.5 text-[13px] rounded-full border cursor-pointer transition-colors",
                on ? "bg-coral text-white border-coral hover:brightness-95" : "bg-white text-text border-sage hover:border-coral hover:text-coral",
              ].join(" ")}
            >
              {o}
            </button>
          );
        })}
      </div>
    </FilterDropdown>
  );
}

// Multi-date calendar (Entry Date filter) — same live-apply behavior as PillFilter.
export function DateFilter({ applied, onApply }: { applied: string[]; onApply: (v: string[]) => void }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const toggle = (iso: string) =>
    onApply(applied.includes(iso) ? applied.filter((x) => x !== iso) : [...applied, iso]);
  const shift = (delta: number) => setView((v) => {
    const m = v.m + delta;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const triggerLabel =
    applied.length === 1 ? formatFilterDate(applied[0]) : applied.length > 1 ? `${applied.length} dates` : undefined;

  return (
    <FilterDropdown
      label="Date"
      triggerLabel={triggerLabel}
      appliedCount={applied.length}
      width="w-[320px]"
      note="*Click a date to toggle · multi-select"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-ink">{MONTHS[view.m]} {view.y}</div>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="w-7 h-7 rounded-md bg-sage/20 hover:bg-sage/40 flex items-center justify-center cursor-pointer"><ChevronLeft size={15} /></button>
          <button onClick={() => shift(1)} aria-label="Next month" className="w-7 h-7 rounded-md bg-sage/20 hover:bg-sage/40 flex items-center justify-center cursor-pointer"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w, i) => <div key={i} className="text-[11px] text-text-ter font-medium py-1">{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = toISO(view.y, view.m, d);
          const on = applied.includes(iso);
          return (
            <div key={i} className="flex justify-center">
              <button
                onClick={() => toggle(iso)}
                className={[
                  "w-8 h-8 rounded-lg text-[13px] cursor-pointer transition-colors",
                  on ? "bg-coral text-white font-semibold hover:brightness-95" : "text-text hover:bg-sage/30",
                ].join(" ")}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </FilterDropdown>
  );
}
