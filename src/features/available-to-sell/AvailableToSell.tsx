// Available-to-Sell — the Sales view of quotable inventory.
// Scoped strictly to status === "Available". The Reserve action goes through the
// same state-update path established in 3B (onUpdateTag + onLinkSalesOrder),
// keeping a single source of truth for the 6-state lifecycle.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { Tag, Role, SalesOrder } from "@/lib/types";
import { PillFilter } from "@/features/stock-locator/filters";

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
  onLinkSalesOrder: (soId: string, tagId: string, qty: number, unitPrice: number) => void;
}

export function AvailableToSell({ tags, role, salesOrders, onUpdateTag, onLinkSalesOrder }: AvailableToSellProps) {
  const [speciesF, setSpeciesF] = useState<string[]>([]);
  const [gradeF, setGradeF] = useState<string[]>([]);
  const [lengthF, setLengthF] = useState<string[]>([]);
  const [locationF, setLocationF] = useState<string[]>([]);
  const [reserving, setReserving] = useState<Tag | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  const hasActiveFilters = speciesF.length || gradeF.length || lengthF.length || locationF.length;
  const clearFilters = () => {
    setSpeciesF([]);
    setGradeF([]);
    setLengthF([]);
    setLocationF([]);
  };

  // Reserve = update tag status + append SO line item. Both go through props so
  // App.tsx remains the single owner of the Tag / SalesOrder stores (3B path).
  const handleReserveConfirm = (tag: Tag, soId: string) => {
    onLinkSalesOrder(soId, tag.id, tag.qty, tag.marketValue ?? 0);
    onUpdateTag({
      ...tag,
      status: "Reserved",
      updated: "just now",
      history: [
        ...tag.history,
        {
          e: `Reserved for ${soId} via Available-to-Sell`,
          t: nowStamp(),
          w: role === "sales" ? "Sales" : "Admin",
        },
      ],
    });
    setReserving(null);
    setToast(`Tag ${tag.id} reserved to Order ${soId}`);
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
                filtered.map((t) => (
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
                      <button
                        onClick={() => setReserving(t)}
                        className="px-3.5 py-1.5 rounded-md bg-coral text-white text-[12px] font-semibold cursor-pointer hover:brightness-95"
                      >
                        Reserve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reserving ? (
        <ReserveModal
          tag={reserving}
          salesOrders={salesOrders}
          onCancel={() => setReserving(null)}
          onConfirm={(soId) => handleReserveConfirm(reserving, soId)}
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
}: {
  tag: Tag;
  salesOrders: SalesOrder[];
  onCancel: () => void;
  onConfirm: (soId: string) => void;
}) {
  const eligible = useMemo(() => salesOrders.filter((so) => so.status === "Open"), [salesOrders]);
  const [soId, setSoId] = useState<string>("");
  const canConfirm = soId !== "" && eligible.some((so) => so.id === soId);

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
                    {so.id} — {so.customer}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border border-sage text-[13px] text-text-sec hover:border-coral hover:text-coral cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => canConfirm && onConfirm(soId)}
              disabled={!canConfirm}
              className={[
                "px-4 py-2 rounded-md text-[13px] font-semibold transition-colors",
                canConfirm ? "bg-coral text-white cursor-pointer hover:brightness-95" : "bg-sage/30 text-text-ter cursor-not-allowed",
              ].join(" ")}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
