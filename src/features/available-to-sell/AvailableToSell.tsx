// Available-to-Sell — the Sales view of quotable inventory.
// Scoped strictly to status === "Available". Reservation is done exclusively through
// the checkbox + action-bar flow (Create Sales Order / Add to Existing Order); the
// actual Available → Reserved transition (and any partial-qty split) happens on
// Confirm, in App.tsx's shared reserveLineItems helper.
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FilePlus, ListPlus, X } from "lucide-react";
import type { Tag, Role, SalesOrder } from "@/lib/types";
import { PillFilter } from "@/features/stock-locator/filters";
import { Pagination, DEFAULT_PAGE_SIZE, usePagedSlice } from "@/components/shared/Pagination";
import { Button } from "@/components/shared/Button";
import { FilterBar } from "@/components/shared/FilterBar";
import { SalesOrderPanel } from "@/features/sales-orders/SalesOrderPanel";
import { AddToOrderPicker } from "./AddToOrderPicker";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUSD(v?: number): string {
  return v === undefined ? "—" : `$${v.toFixed(2)}`;
}

// Parse the received timestamp out of a history entry like "Jun 01 2026 08:12".
// Returns null if the format is unexpected, so daysInYard can gracefully fall back.
function parseHistoryDate(t: string): Date | null {
  const m = t.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return null;
  const d = new Date(Number(m[3]), monthIdx, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysInYard(tag: Tag, todayMs: number): number {
  const received = tag.history[0]?.t ? parseHistoryDate(tag.history[0].t) : null;
  const fallback = received ?? new Date(tag.date);
  const diff = todayMs - fallback.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// Unique-sorted helper for derived filter options.
function uniq<T extends string | number>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

interface AvailableToSellProps {
  tags: Tag[];
  role: Role;
  salesOrders: SalesOrder[];
  onCreateSalesOrder: (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number; discountPct?: number }[],
    confirm: boolean,
    meta?: { notes?: string; expectedShipDate?: string },
  ) => { ok: true; soId: string } | { ok: false; unavailableIds: string[] };
  onAppendToDraftOrder: (soId: string, lineItems: { tagId: string; qty: number; unitPrice: number }[]) => void;
  onViewOrders: (soId?: string) => void;
}

export function AvailableToSell({ tags, role, salesOrders, onCreateSalesOrder, onAppendToDraftOrder, onViewOrders }: AvailableToSellProps) {
  // Reserving inventory is Sales' action per the permission matrix; Manager sees this
  // surface read-only (filters + table + tag detail, but no checkboxes or action bar).
  // Mirrors the Manager-only Settings guard: a render gate on `role` below, plus the
  // teardown effect that tears down any in-flight selection/panels if the role changes
  // away from Sales mid-session.
  const isSalesUser = role === "sales";
  const [speciesF, setSpeciesF] = useState<string[]>([]);
  const [gradeF, setGradeF] = useState<string[]>([]);
  const [lengthF, setLengthF] = useState<string[]>([]);
  const [locationF, setLocationF] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Multi-select state — set of Tag ids currently checked in the table.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [creatingSo, setCreatingSo] = useState(false);
  const [pickingSo, setPickingSo] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Compute "today" once per mount — Days in Yard doesn't need live ticking.
  const todayMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  // Re-derive the Available pool whenever the Tag table changes — that's how
  // a freshly-reserved tag drops out of this view automatically.
  const available = useMemo(() => tags.filter((t) => t.status === "Available"), [tags]);

  // Filter options are derived from the *available* pool, so we never show a
  // species/grade/length/yard that has nothing behind it.
  const speciesOpts = useMemo(() => uniq(available.map((t) => t.species)), [available]);
  const gradeOpts = useMemo(() => uniq(available.map((t) => t.grade)), [available]);
  const lengthOpts = useMemo(
    () => uniq(available.map((t) => t.length)).map((n) => String(n)),
    [available],
  );
  const locationOpts = useMemo(() => uniq(available.map((t) => t.yard)), [available]);

  const filtered = useMemo(
    () =>
      available.filter((t) => {
        if (speciesF.length && !speciesF.includes(t.species)) return false;
        if (gradeF.length && !gradeF.includes(t.grade)) return false;
        if (lengthF.length && !lengthF.includes(String(t.length))) return false;
        if (locationF.length && !locationF.includes(t.yard)) return false;
        return true;
      }),
    [available, speciesF, gradeF, lengthF, locationF],
  );

  // Reset to page 1 on any filter change; clamp if the total shrinks.
  useEffect(() => { setPage(1); }, [speciesF, gradeF, lengthF, locationF, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = usePagedSlice(filtered, page, pageSize);

  const hasActiveFilters = speciesF.length || gradeF.length || lengthF.length || locationF.length;
  const clearFilters = () => {
    setSpeciesF([]);
    setGradeF([]);
    setLengthF([]);
    setLocationF([]);
  };

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Selection helpers — keep checkedIds in sync with the current filter/pagination
  // set so a tag reserved by another action gets pruned automatically.
  useEffect(() => {
    setCheckedIds((prev) => {
      const availableIds = new Set(available.map((t) => t.id));
      const next = new Set<string>();
      for (const id of prev) if (availableIds.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [available]);

  // Defense-in-depth: if the role switches away from Sales while a selection or a
  // create/add panel is open, tear it all down immediately (no reload) so the
  // Sales-only reserve flow can't be left half-open for a Manager.
  useEffect(() => {
    if (isSalesUser) return;
    setCheckedIds(new Set());
    setCreatingSo(false);
    setPickingSo(false);
  }, [isSalesUser]);

  const toggleChecked = (id: string) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allFilteredChecked = filtered.length > 0 && filtered.every((t) => checkedIds.has(t.id));
  const someFilteredChecked = filtered.some((t) => checkedIds.has(t.id));
  const toggleAllFiltered = () =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) filtered.forEach((t) => next.delete(t.id));
      else filtered.forEach((t) => next.add(t.id));
      return next;
    });
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someFilteredChecked && !allFilteredChecked;
  }, [someFilteredChecked, allFilteredChecked]);

  const selectedTags = useMemo(
    () => tags.filter((t) => checkedIds.has(t.id) && t.status === "Available"),
    [tags, checkedIds],
  );
  const draftSoCount = useMemo(() => salesOrders.filter((so) => so.status === "Draft").length, [salesOrders]);

  // New SO from selection. Save-as-Draft closes the panel with a toast; Confirm leaves
  // the panel open so it can show its own success stage (we just clear the selection).
  // Both return the unavailable-id list so the panel can highlight rows if the defensive
  // double-booking check fires (only possible on Confirm).
  const handlePanelSaveDraft = (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number }[],
    meta?: { notes?: string; expectedShipDate?: string },
  ) => {
    const result = onCreateSalesOrder(clientId, lineItems, false, meta);
    if (result.ok) {
      setCreatingSo(false);
      setCheckedIds(new Set());
      setToast(`${result.soId} saved as Draft with ${lineItems.length} line${lineItems.length === 1 ? "" : "s"}`);
    }
  };
  const handlePanelConfirm = (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number }[],
    meta?: { notes?: string; expectedShipDate?: string },
  ) => {
    const result = onCreateSalesOrder(clientId, lineItems, true, meta);
    if (result.ok) {
      setCheckedIds(new Set());
    }
    return result;
  };
  const handleAppendToDraft = (soId: string) => {
    const lineItems = selectedTags.map((t) => ({ tagId: t.id, qty: t.qty, unitPrice: t.marketValue ?? 0 }));
    onAppendToDraftOrder(soId, lineItems);
    setPickingSo(false);
    setCheckedIds(new Set());
    setToast(`Added ${lineItems.length} line${lineItems.length === 1 ? "" : "s"} to ${soId}`);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Available to Sell
        </h1>
        <p className="text-sm text-text-sec mt-1">
          Quotable inventory — tags currently released and not yet linked to an order.
        </p>
      </div>

      <FilterBar
        filtersActive={!!hasActiveFilters}
        onReset={clearFilters}
        rightSlot={
          <div className="text-[12px] text-text-ter">
            {filtered.length} {filtered.length === 1 ? "tag" : "tags"} available
          </div>
        }
      >
        <PillFilter label="Species" options={speciesOpts} applied={speciesF} onApply={setSpeciesF} />
        <PillFilter label="Grade" options={gradeOpts} applied={gradeF} onApply={setGradeF} />
        <PillFilter label="Length" options={lengthOpts} applied={lengthF} onApply={setLengthF} />
        <PillFilter label="Location" options={locationOpts} applied={locationF} onApply={setLocationF} />
      </FilterBar>

      {/* Selection action bar — Sales only, shown when tags are checked. Manager
          never sees it (they get the read-only table without checkboxes). */}
      {isSalesUser && checkedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-coral/[0.08] border border-coral/40 rounded-lg">
          <span className="text-[13px] text-ink font-semibold">
            {checkedIds.size} tag{checkedIds.size === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={() => setCheckedIds(new Set())}
            className="text-[12px] text-text-sec hover:text-coral cursor-pointer underline-offset-2 hover:underline"
          >
            Clear
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => setPickingSo(true)}
              disabled={draftSoCount === 0}
              title={draftSoCount === 0 ? "No Draft orders to add to — create one instead" : undefined}
              leftIcon={<ListPlus size={14} />}
            >
              Add to Existing Order
            </Button>
            <Button variant="primary" onClick={() => setCreatingSo(true)} leftIcon={<FilePlus size={14} />}>
              Create Sales Order
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-sage overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-sage/20 text-ink text-left">
                {isSalesUser && (
                  <th className="pl-3 pr-1 py-3 w-9" data-onboarding="avail-checkbox">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredChecked}
                      onChange={toggleAllFiltered}
                      aria-label="Select all"
                      className="accent-coral w-4 h-4 cursor-pointer align-middle"
                    />
                  </th>
                )}
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Tag ID</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Species</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Grade</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Dimensions (T×W×L)</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Pieces</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Total FBM</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Location</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Market Value</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Days in Yard</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isSalesUser ? 10 : 9} className="px-3 py-12 text-center text-text-sec">
                    <div className="mb-2">No available inventory matches your filters.</div>
                    {hasActiveFilters ? (
                      <button
                        onClick={clearFilters}
                        className="text-coral hover:underline cursor-pointer text-[13px]"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                pageRows.map((t, rowIdx) => {
                  const isChecked = checkedIds.has(t.id);
                  return (
                    <tr key={t.id} data-onboarding={rowIdx === 0 ? "avail-row" : undefined} className={`border-t border-sage/40 ${isChecked ? "bg-coral/[0.06] hover:bg-coral/[0.10]" : "hover:bg-sage/10"}`}>
                      {isSalesUser && (
                        <td className="pl-3 pr-1 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChecked(t.id)}
                            aria-label={`Select ${t.id}`}
                            className="accent-coral w-4 h-4 cursor-pointer align-middle"
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 font-medium text-ink whitespace-nowrap">{t.id}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{t.species}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{t.grade}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{t.thick}″ × {t.width}″ × {t.length}′</td>
                      <td className="px-3 py-3 text-right tabular-nums">{t.qty}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{t.fbm}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{t.yard} · {t.section} · {t.rack}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatUSD(t.marketValue)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{daysInYard(t, todayMs)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          label="tags"
        />
      </div>

      {isSalesUser && creatingSo && (
        <SalesOrderPanel
          mode="create"
          initialTags={selectedTags}
          allTags={tags}
          onCancel={() => setCreatingSo(false)}
          onSaveDraft={handlePanelSaveDraft}
          onConfirm={handlePanelConfirm}
          onViewOrders={onViewOrders}
        />
      )}

      {isSalesUser && pickingSo && (
        <AddToOrderPicker
          salesOrders={salesOrders}
          selectedCount={checkedIds.size}
          onCancel={() => setPickingSo(false)}
          onConfirm={handleAppendToDraft}
        />
      )}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-sage text-ink rounded-lg shadow-lg pl-4 pr-2 py-3 border border-sage min-w-[280px]">
          <CheckCircle2 size={18} className="text-ink shrink-0" />
          <span className="text-[13px] font-medium flex-1">{toast}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="p-1 rounded hover:bg-ink/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
