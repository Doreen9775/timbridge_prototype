import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { SalesOrder } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { calcExtendedPrice } from "@/lib/pricing";
import type { ApprovalDraft } from "./RequestApprovalForm";

function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RequestDiscountFormProps {
  salesOrders: SalesOrder[];
  getClientName: (id: string) => string;
  onCancel: () => void;
  onSubmit: (draft: ApprovalDraft) => void;
  // Present when editing an existing pending request rather than creating a new one:
  // pre-fills the fields and swaps the title / submit label.
  initial?: { relatedSoId?: string; discountRate?: number; details?: string };
  title?: string;
  submitLabel?: string;
}

// Fast-path discount request — a standalone quick-entry form (no need to open the
// Sales Order panel and edit a price field first). Always submits type: "discount"
// into the same ApprovalDraft/ApprovalRequest shape the Approval Queue already reads,
// so it shows up there immediately with the live-calculated discounted price. The same
// form is reused for editing a pending request (see `initial`).
export function RequestDiscountForm({
  salesOrders,
  getClientName,
  onCancel,
  onSubmit,
  initial,
  title = "Request Discount",
  submitLabel = "Submit request",
}: RequestDiscountFormProps) {
  const [soId, setSoId] = useState<string | null>(initial?.relatedSoId ?? null);
  const [rate, setRate] = useState<number | "">(initial?.discountRate ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");

  // Only Open orders are eligible — mirrors the Reserve modal's existing "still open
  // to action" scoping convention. SalesOrder has no per-rep owner field, so this
  // isn't filtered to "this Sales user's" orders specifically — every Sales-role user
  // sees the same open-order pool. When editing, the request's current order is always
  // included even if it has since advanced past Open, so the pre-fill still resolves.
  const eligible = useMemo(() => {
    const open = salesOrders.filter((so) => so.status === "Open");
    if (initial?.relatedSoId && !open.some((so) => so.id === initial.relatedSoId)) {
      const cur = salesOrders.find((so) => so.id === initial.relatedSoId);
      if (cur) return [cur, ...open];
    }
    return open;
  }, [salesOrders, initial]);

  const selectedSo = soId ? eligible.find((so) => so.id === soId) ?? null : null;
  const originalPrice = useMemo(
    () => (selectedSo ? selectedSo.lineItems.reduce((sum, li) => sum + calcExtendedPrice(li.qty, li.unitPrice), 0) : null),
    [selectedSo],
  );
  const rateNum = typeof rate === "number" ? rate : 0;
  const calculated = originalPrice !== null ? calcExtendedPrice(1, originalPrice, rateNum) : null;

  // Reason is optional — an order + a valid rate is enough to submit.
  const canSubmit = soId !== null && typeof rate === "number" && rate > 0 && rate <= 100;

  const handleSubmit = () => {
    if (!canSubmit || !soId || typeof rate !== "number") return;
    onSubmit({
      type: "discount",
      relatedSoId: soId,
      discountRate: rate,
      details: details.trim(),
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-[100]" onClick={onCancel} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] w-full max-w-[460px] pointer-events-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-sage/60">
            <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {title}
            </h2>
            <button onClick={onCancel} aria-label="Close" className="p-1 rounded hover:bg-sage/30 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-ink mb-2">Order</label>
              <OrderSelector orders={eligible} value={soId} onChange={setSoId} getClientName={getClientName} />
              {eligible.length === 0 && (
                <div className="text-[11px] text-text-ter mt-1.5">No open orders available to discount.</div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-ink mb-2">Discount rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={rate}
                onChange={(e) =>
                  setRate(e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value))))
                }
                placeholder="e.g. 5"
                className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral"
              />
            </div>

            {selectedSo && originalPrice !== null && calculated !== null && (
              <div className="bg-[#F9FAFB] rounded-md px-3 py-2.5 flex items-center gap-5">
                <div>
                  <div className="text-[10px] text-text-ter uppercase tracking-wide">Original</div>
                  <div className="text-[13px] font-semibold text-text">{formatUSD(originalPrice)}</div>
                </div>
                <div className="text-text-ter">×</div>
                <div>
                  <div className="text-[10px] text-text-ter uppercase tracking-wide">Discount</div>
                  <div className="text-[13px] font-semibold text-text">{rateNum}%</div>
                </div>
                <div className="text-text-ter">=</div>
                <div>
                  <div className="text-[10px] text-text-ter uppercase tracking-wide">Discounted price</div>
                  <div className="text-[15px] font-bold text-coral">{formatUSD(calculated)}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-ink mb-2">
                Reason <span className="text-text-ter font-normal">(optional)</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="e.g. 5% loyalty discount for repeat customer."
                className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// Searchable order combobox — modeled on ClientSelector's type-to-filter pattern.
function OrderSelector({
  orders,
  value,
  onChange,
  getClientName,
}: {
  orders: SalesOrder[];
  value: string | null;
  onChange: (id: string | null) => void;
  getClientName: (id: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? orders.find((so) => so.id === value) ?? null : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((so) => `${so.id} ${getClientName(so.clientId)}`.toLowerCase().includes(q));
  }, [orders, query, getClientName]);

  const disabled = orders.length === 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={[
          "w-full flex items-center gap-2 px-3 py-2 text-[13px] rounded-md border bg-white text-left",
          disabled ? "border-sage/60 text-text-ter cursor-not-allowed" : "border-sage text-text cursor-pointer hover:border-coral",
        ].join(" ")}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <>
              <span className="font-mono font-semibold text-ink">{selected.id}</span>
              <span className="text-text-sec ml-2">{getClientName(selected.clientId)}</span>
            </>
          ) : (
            <span className="text-text-ter">Select an order…</span>
          )}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            aria-label="Clear order"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="p-0.5 rounded hover:bg-sage/30 text-text-sec cursor-pointer"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+4px)] w-full bg-white rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-sage z-[111] overflow-hidden">
            <div className="relative border-b border-sage/60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by order id or customer…"
                className="w-full py-2 pl-9 pr-3 text-[13px] outline-none bg-transparent"
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {matches.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-text-ter text-center">No orders match "{query}".</div>
              ) : (
                matches.map((so) => {
                  const total = so.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
                  const isSelected = so.id === value;
                  return (
                    <button
                      key={so.id}
                      onClick={() => {
                        onChange(so.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={[
                        "w-full text-left px-3 py-2 text-[13px] cursor-pointer",
                        isSelected ? "bg-coral/10 text-coral" : "text-text hover:bg-sage/20",
                      ].join(" ")}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-semibold text-ink">{so.id}</span>
                        <span className="flex-1 truncate">{getClientName(so.clientId)}</span>
                        <span className="text-[11px] text-text-ter whitespace-nowrap">{formatUSD(total)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
