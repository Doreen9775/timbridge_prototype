import { useMemo, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import type { Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { ClientSelector } from "./ClientSelector";

// Right-side slide-in panel for creating a new SO from a multi-tag selection in
// Available-to-Sell. Matches Stock Locator's DetailDrawer position/width/backdrop
// convention (fixed right, 520px, z-90 backdrop + z-100 panel), minus the
// fullscreen toggle — creation is a one-shot flow, not a persistent record.
//
// Line item semantics for this MVP: one line per selected tag, pieces = tag.qty
// (whole-tag reservation only; per-row Reserve on the table remains the partial-
// qty path). Unit price defaults to tag.marketValue and is editable inline.

export interface DraftLineItem {
  tagId: string;
  qty: number;
  unitPrice: number;
}

interface CreateSalesOrderPanelProps {
  tags: Tag[];                                            // the pre-selected tags
  onCancel: () => void;
  onSaveDraft: (clientId: string, lineItems: DraftLineItem[]) => void;
  onConfirm: (clientId: string, lineItems: DraftLineItem[]) => { ok: true } | { ok: false; unavailableIds: string[] };
}

function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CreateSalesOrderPanel({ tags, onCancel, onSaveDraft, onConfirm }: CreateSalesOrderPanelProps) {
  const [clientId, setClientId] = useState<string | null>(null);
  // Per-line unit price map keyed by tagId, defaulting to marketValue.
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const t of tags) m[t.id] = t.marketValue ?? 0;
    return m;
  });
  const [confirmError, setConfirmError] = useState<string[] | null>(null);

  const lineItems: DraftLineItem[] = useMemo(
    () => tags.map((t) => ({ tagId: t.id, qty: t.qty, unitPrice: prices[t.id] ?? 0 })),
    [tags, prices],
  );

  const orderTotal = useMemo(
    () => lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0),
    [lineItems],
  );
  const totalPieces = useMemo(() => tags.reduce((s, t) => s + t.qty, 0), [tags]);
  const totalFbm = useMemo(() => tags.reduce((s, t) => s + t.fbm, 0), [tags]);

  const canSaveOrConfirm = clientId !== null && tags.length > 0;

  const handleSaveDraft = () => {
    if (!clientId) return;
    onSaveDraft(clientId, lineItems);
  };

  const handleConfirm = () => {
    if (!clientId) return;
    setConfirmError(null);
    const result = onConfirm(clientId, lineItems);
    if (!result.ok) {
      setConfirmError(result.unavailableIds);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-ink/40" onClick={onCancel} />
      <div className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[520px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.12)] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
          <div>
            <div className="text-[11px] text-text-ter uppercase tracking-wide">New order</div>
            <div className="text-base font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Create Sales Order
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <div className="text-xs text-text-sec mb-2">Customer</div>
            <ClientSelector value={clientId} onChange={setClientId} />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-xs text-text-sec">Line Items</div>
              <div className="text-[11px] text-text-ter">
                {tags.length} line{tags.length === 1 ? "" : "s"} · {totalPieces.toLocaleString()} pcs · {totalFbm.toLocaleString()} FBM
              </div>
            </div>
            <div className="border border-sage rounded-md overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-sage">
                    <th className="px-2.5 py-2 text-left text-text-sec font-medium whitespace-nowrap">Tag ID</th>
                    <th className="px-2 py-2 text-left text-text-sec font-medium">Species / Grade</th>
                    <th className="px-2 py-2 text-left text-text-sec font-medium whitespace-nowrap">Dims</th>
                    <th className="px-2 py-2 text-right text-text-sec font-medium whitespace-nowrap">Pieces</th>
                    <th className="px-2 py-2 text-right text-text-sec font-medium whitespace-nowrap">FBM</th>
                    <th className="px-2 py-2 text-right text-text-sec font-medium whitespace-nowrap w-[86px]">Unit $</th>
                    <th className="px-2.5 py-2 text-right text-text-sec font-medium whitespace-nowrap">Extended</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((t) => {
                    const price = prices[t.id] ?? 0;
                    const extended = t.qty * price;
                    const isUnavailable = confirmError?.includes(t.id);
                    return (
                      <tr key={t.id} className={`border-b border-[#F3F4F6] last:border-b-0 ${isUnavailable ? "bg-coral/[0.08]" : ""}`}>
                        <td className="px-2.5 py-2 font-mono text-ink font-semibold whitespace-nowrap">{t.id}</td>
                        <td className="px-2 py-2 truncate max-w-[110px]">{t.species} · {t.grade}</td>
                        <td className="px-2 py-2 whitespace-nowrap font-mono text-[11px]">{t.thick}×{t.width} × {t.length}'</td>
                        <td className="px-2 py-2 text-right tabular-nums">{t.qty}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-text-sec">{t.fbm.toLocaleString()}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step={0.01}
                            min={0}
                            value={price}
                            onChange={(e) =>
                              setPrices((prev) => ({
                                ...prev,
                                [t.id]: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-[76px] text-right border border-sage rounded px-1.5 py-0.5 text-[12px] outline-none focus:border-coral tabular-nums"
                          />
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-ink font-semibold whitespace-nowrap">{formatUSD(extended)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#F9FAFB] rounded-md px-4 py-3 flex items-end justify-between">
            <div className="text-xs text-text-sec">Order total</div>
            <div className="text-2xl font-display font-bold text-ink leading-none">{formatUSD(orderTotal)}</div>
          </div>

          {confirmError && (
            <div className="bg-coral/[0.08] border border-coral/40 rounded-md px-3 py-2.5 text-[12px] text-text">
              <div className="flex items-center gap-1.5 font-semibold text-coral mb-1">
                <AlertTriangle size={13} />
                Can't confirm — {confirmError.length} tag{confirmError.length === 1 ? "" : "s"} no longer Available
              </div>
              <div>
                The highlighted row{confirmError.length === 1 ? " was" : "s were"} reserved by another action since selection. Remove {confirmError.length === 1 ? "it" : "them"} from the panel and try again, or Save as Draft to keep this order and reconcile later.
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-sage flex items-center justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSaveDraft} disabled={!canSaveOrConfirm}>
            Save as Draft
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!canSaveOrConfirm}>
            Confirm Order
          </Button>
        </div>
      </div>
    </>
  );
}
