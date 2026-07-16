// Shared pagination bar for data tables.
// Rendered under the table body — shows "N–M of X" on the left and page-size
// selector + prev/next controls on the right. Page numbers are only shown when
// the total exceeds a page; single-page tables render nothing.
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 25;
// Admin-table convention (Airtable / Linear / Notion): mid-tier page sizes so
// heavy scans stay possible without loading everything at once. 10 is included
// for lightweight browsing sessions and small screens.
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface PaginationProps {
  page: number;           // 1-indexed
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;         // "tags", "rows", "items" — display noun
}

export function Pagination({
  page, pageSize, total, onPageChange, onPageSizeChange, label = "rows",
}: PaginationProps) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const btn = (extra: string) =>
    `w-7 h-7 flex items-center justify-center rounded-md border text-[12px] transition-colors ${extra}`;

  return (
    <div className="px-4 py-2.5 border-t border-sage/40 bg-white flex items-center justify-between gap-4 flex-wrap text-[12px] text-text-sec">
      <div>
        Showing <span className="text-ink font-semibold">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
        <span className="text-ink font-semibold">{total.toLocaleString()}</span> {label}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="text-text-ter">Rows / page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-sage rounded-md px-1.5 py-0.5 text-[12px] bg-white cursor-pointer focus:outline-none focus:border-coral"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => canPrev && onPageChange(page - 1)}
            disabled={!canPrev}
            aria-label="Previous page"
            className={btn(canPrev ? "border-sage text-text hover:border-coral hover:text-coral cursor-pointer" : "border-sage/50 text-text-ter cursor-not-allowed")}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-text-sec px-1 tabular-nums">
            Page <span className="text-ink font-semibold">{page}</span> of {totalPages.toLocaleString()}
          </span>
          <button
            onClick={() => canNext && onPageChange(page + 1)}
            disabled={!canNext}
            aria-label="Next page"
            className={btn(canNext ? "border-sage text-text hover:border-coral hover:text-coral cursor-pointer" : "border-sage/50 text-text-ter cursor-not-allowed")}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Clamp a page number so it doesn't dangle past the end when the underlying
// filtered set shrinks. Callers pipe this through a useEffect on `total`.
export function usePagedSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
