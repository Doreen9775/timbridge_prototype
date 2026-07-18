// Available-to-Sell — the Sales view of quotable inventory.
// Scoped strictly to status === "Available". The Reserve action goes through the
// same state-update path established in 3B (onUpdateTag + onLinkSalesOrder),
// keeping a single source of truth for the 6-state lifecycle.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { Tag, Role, SalesOrder } from "@/lib/types";
import { PillFilter } from "@/features/stock-locator/filters";
import { Pagination, DEFAULT_PAGE_SIZE, usePagedSlice } from "@/components/shared/Pagination";
import { Button } from "@/components/shared/Button";
import { calcFbm } from "@/lib/fbm";
import { RequestApprovalForm, type ApprovalDraft } from "@/features/approvals/RequestApprovalForm";
import { useClients } from "@/hooks/useClients";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUSD(v?: number): string {
  return v === undefined ? "—" : `$${v.toFixed(2)}`;
}

// "Jun 23 2026 14:32" — mirrors the history timestamp format used in StockLocator
// so all Tag history events have the same shape regardless of which surface wrote them.
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS_SHORT[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
  onUpdateTag: (tag: Tag) => void;
  onCreateTag: (tag: Tag) => void;
  onLinkSalesOrder: (soId: string, tagId: string, qty: number, unitPrice: number) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}

export function AvailableToSell({ tags, role, salesOrders, onUpdateTag, onCreateTag, onLinkSalesOrder, onCreateApproval, requesterIdentity }: AvailableToSellProps) {
  const [speciesF, setSpeciesF] = useState<string[]>([]);
  const [gradeF, setGradeF] = useState<string[]>([]);
  const [lengthF, setLengthF] = useState<string[]>([]);
  const [locationF, setLocationF] = useState<string[]>([]);
  const [reserving, setReserving] = useState<Tag | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  // Reserve = update tag status + append SO line item. Both go through props so
  // App.tsx remains the single owner of the Tag / SalesOrder stores (3B path).
  // Reserving fewer pieces than the tag holds splits off a new tag for the reserved
  // qty (status can only apply to a whole Tag row) and shrinks the original in place.
  const handleReserveConfirm = (tag: Tag, soId: string, qty: number) => {
    const worker = role === "sales" ? "Sales" : "Admin";

    if (qty >= tag.qty) {
      onLinkSalesOrder(soId, tag.id, tag.qty, tag.marketValue ?? 0);
      onUpdateTag({
        ...tag,
        status: "Reserved",
        updated: "just now",
        history: [
          ...tag.history,
          { e: `Reserved for ${soId} via Available-to-Sell`, t: nowStamp(), w: worker },
        ],
      });
      setReserving(null);
      setToast(`Tag ${tag.id} reserved to Order ${soId}`);
      return;
    }

    const newId = `T-2026-${String(tags.length + 100 + 1).padStart(4, "0")}`;
    const remainingQty = tag.qty - qty;
    const splitNote = `Split from ${tag.id} · Reserved via Available-to-Sell`;

    onCreateTag({
      ...tag,
      id: newId,
      qty,
      fbm: calcFbm(tag.thick, tag.width, tag.length, qty),
      status: "Reserved",
      updated: "just now",
      parentTagId: tag.id,
      splitTagIds: undefined,
      history: [...tag.history, { e: splitNote, t: nowStamp(), w: worker }],
    });
    onLinkSalesOrder(soId, newId, qty, tag.marketValue ?? 0);
    onUpdateTag({
      ...tag,
      qty: remainingQty,
      fbm: calcFbm(tag.thick, tag.width, tag.length, remainingQty),
      updated: "just now",
      splitTagIds: [...(tag.splitTagIds ?? []), newId],
      history: [
        ...tag.history,
        { e: `Split ${qty} pcs into ${newId} · Reserved via Available-to-Sell`, t: nowStamp(), w: worker },
      ],
    });
    setReserving(null);
    setToast(`${qty} of ${tag.qty} pcs from ${tag.id} reserved to Order ${soId} as ${newId}`);
  };

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

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

      {/* Filter bar — reuses Stock Locator's PillFilter primitive. */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <span className="text-[13px] text-text-sec mr-1">Filter By:</span>
        <PillFilter label="Species" options={speciesOpts} applied={speciesF} onApply={setSpeciesF} />
        <PillFilter label="Grade" options={gradeOpts} applied={gradeF} onApply={setGradeF} />
        <PillFilter label="Length" options={lengthOpts} applied={lengthF} onApply={setLengthF} />
        <PillFilter label="Location" options={locationOpts} applied={locationF} onApply={setLocationF} />
        {hasActiveFilters ? (
          <button
            onClick={clearFilters}
            className="ml-1 text-[12px] text-text-sec hover:text-coral underline-offset-2 hover:underline cursor-pointer"
          >
            Reset Filter
          </button>
        ) : null}
        <div className="ml-auto text-[12px] text-text-ter">
          {filtered.length} {filtered.length === 1 ? "tag" : "tags"} available
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-sage overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-sage/20 text-ink text-left">
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Tag ID</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Species</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Grade</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Dimensions (T×W×L)</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Pieces</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Total FBM</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Location</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Market Value</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Days in Yard</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap w-[1%]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-text-sec">
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
                pageRows.map((t) => (
                  <tr key={t.id} className="border-t border-sage/40 hover:bg-sage/10">
                    <td className="px-3 py-3 font-medium text-ink whitespace-nowrap">{t.id}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{t.species}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{t.grade}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{t.thick}″ × {t.width}″ × {t.length}′</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.qty}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.fbm}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{t.yard} · {t.section} · {t.rack}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatUSD(t.marketValue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{daysInYard(t, todayMs)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Button size="sm" variant="primary" onClick={() => setReserving(t)}>Reserve</Button>
                    </td>
                  </tr>
                ))
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

      {reserving ? (
        <ReserveModal
          tag={reserving}
          salesOrders={salesOrders}
          onCancel={() => setReserving(null)}
          onConfirm={(soId, qty) => handleReserveConfirm(reserving, soId, qty)}
          onSubmitApproval={(draft) => {
            onCreateApproval(draft);
            setReserving(null);
            setToast(
              `Approval request submitted${draft.relatedSoId ? ` for ${draft.relatedSoId}` : ""}`,
            );
          }}
          requesterIdentity={requesterIdentity}
        />
      ) : null}

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

// ── Reserve modal ───────────────────────────────────────────────────────────────
// Single-tag only. Lists Open sales orders (other statuses can't accept new lines).
function ReserveModal({
  tag,
  salesOrders,
  onCancel,
  onConfirm,
  onSubmitApproval,
  requesterIdentity,
}: {
  tag: Tag;
  salesOrders: SalesOrder[];
  onCancel: () => void;
  onConfirm: (soId: string, qty: number) => void;
  onSubmitApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}) {
  const eligible = useMemo(() => salesOrders.filter((so) => so.status === "Open"), [salesOrders]);
  const [soId, setSoId] = useState<string>("");
  const [qty, setQty] = useState<number>(tag.qty);
  const [showApproval, setShowApproval] = useState(false);
  const { getClientName } = useClients();
  const qtyValid = Number.isInteger(qty) && qty >= 1 && qty <= tag.qty;
  const canConfirm = soId !== "" && eligible.some((so) => so.id === soId) && qtyValid;
  const willSplit = qtyValid && qty < tag.qty;

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] w-full max-w-[440px] pointer-events-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-sage/60">
            <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Reserve Tag {tag.id}
            </h2>
            <button onClick={onCancel} aria-label="Close" className="p-1 rounded hover:bg-sage/30 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-5">
            <div className="text-[12px] text-text-sec mb-4">
              <div>{tag.species} · {tag.grade} · {tag.thick}″ × {tag.width}″ × {tag.length}′</div>
              <div>{tag.qty} pcs · {tag.fbm} FBM · {tag.yard} · {tag.section} · {tag.rack}</div>
            </div>

            <label className="block text-[13px] font-semibold text-ink mb-2">Qty to reserve</label>
            <input
              type="number"
              min={1}
              max={tag.qty}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value === "" ? 0 : Math.round(Number(e.target.value)))}
              className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral mb-1.5"
            />
            {!qtyValid ? (
              <div className="text-[11px] text-coral mb-3">Enter a whole number between 1 and {tag.qty}.</div>
            ) : willSplit ? (
              <div className="text-[11px] text-text-ter mb-3">
                Reserving fewer than {tag.qty} pcs splits off a new tag for {qty} pcs; the remaining {tag.qty - qty} pcs stay Available on {tag.id}.
              </div>
            ) : (
              <div className="text-[11px] text-text-ter mb-3">Reserves the whole tag — no split.</div>
            )}

            <label className="block text-[13px] font-semibold text-ink mb-2">Link to Sales Order</label>
            {eligible.length === 0 ? (
              <div className="text-[12px] text-text-sec bg-sage/15 rounded-md px-3 py-2.5 border border-sage/60">
                No open sales orders to link.
              </div>
            ) : (
              <select
                value={soId}
                onChange={(e) => setSoId(e.target.value)}
                className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-coral cursor-pointer"
              >
                <option value="">— Select a sales order —</option>
                {eligible.map((so) => (
                  <option key={so.id} value={so.id}>
                    {so.id} — {getClientName(so.clientId)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between px-5 pb-5 pt-1">
            <button
              onClick={() => setShowApproval(true)}
              className="text-[12px] text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer"
            >
              Need approval? Request one
            </button>
            <div className="flex items-center gap-2">
              <Button onClick={onCancel}>Cancel</Button>
              <Button variant="primary" onClick={() => canConfirm && onConfirm(soId, qty)} disabled={!canConfirm}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>
      {showApproval && (
        <RequestApprovalForm
          requestedBy={requesterIdentity}
          prefillSoId={soId || undefined}
          onCancel={() => setShowApproval(false)}
          onSubmit={(draft) => {
            onSubmitApproval(draft);
            setShowApproval(false);
          }}
          zIndex={60}
        />
      )}
    </>
  );
}
