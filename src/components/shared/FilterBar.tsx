import type { ReactNode } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";

// Shared filter-bar shell — extracted from Stock Locator's inline bar so every
// module (Available-to-Sell, Sales Orders, Client Profile, future Reports) shares
// the same leader / reset behavior / layout. Caller supplies the filter primitives
// as children (PillFilter, DateFilter, custom toggles like Stock Locator's Low Qty).
//
// The Reset button visibility is controlled by `filtersActive` — this matches
// Stock Locator's existing behavior of hiding (not disabling) when no filters
// are set. Layout is `flex-wrap` so long chains of pills wrap responsively.
//
// Search slot is optional: modules like Clients that don't have pills but do
// have a text search render `<FilterBar search={...} />` with no children;
// the "Filter By" leader is suppressed in that case.
interface FilterBarProps {
  filtersActive: boolean;
  onReset: () => void;
  children?: ReactNode;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    maxWidth?: string; // e.g. "420px" for Clients
  };
  rightSlot?: ReactNode;
}

export function FilterBar({ filtersActive, onReset, children, search, rightSlot }: FilterBarProps) {
  const hasFilterPrimitives = children !== undefined && children !== null && children !== false;
  return (
    <div className="flex gap-2.5 mb-4 flex-wrap items-center">
      {search && (
        <div className="relative" style={{ width: search.maxWidth ?? "320px", maxWidth: "100%" }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="w-full py-2.5 pl-[38px] pr-3 text-sm border border-sage rounded-lg outline-none bg-white box-border"
          />
        </div>
      )}
      {hasFilterPrimitives && (
        <span className="flex items-center gap-1.5 text-[13px] text-text-sec font-medium pr-1">
          <Filter size={15} />Filter By
        </span>
      )}
      {children}
      {filtersActive && (
        <button
          onClick={onReset}
          className="px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border border-sage bg-transparent text-text-sec flex items-center gap-1 hover:text-coral hover:border-coral"
        >
          <RotateCcw size={13} />Reset Filter
        </button>
      )}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
