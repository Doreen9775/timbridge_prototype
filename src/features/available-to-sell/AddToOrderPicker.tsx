import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { SalesOrder } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { useClients } from "@/hooks/useClients";

// Picker modal for "Add to Existing Order" — Draft SOs only (Open SOs are frozen
// per the guardrail that tags can only transition Available → Reserved on Confirm).
// If there are no Draft SOs available, the caller shouldn't render this modal
// (they should show a hint alongside the disabled action button instead).
interface AddToOrderPickerProps {
  salesOrders: SalesOrder[];
  selectedCount: number;
  onCancel: () => void;
  onConfirm: (soId: string) => void;
}

function formatDate(iso: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

export function AddToOrderPicker({ salesOrders, selectedCount, onCancel, onConfirm }: AddToOrderPickerProps) {
  const { getClientName } = useClients();
  const [chosen, setChosen] = useState<string | null>(null);

  const drafts = useMemo(
    () =>
      salesOrders
        .filter((so) => so.status === "Draft")
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [salesOrders],
  );

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] w-full max-w-[480px] pointer-events-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-sage/60">
            <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Add {selectedCount} tag{selectedCount === 1 ? "" : "s"} to an existing order
            </h2>
            <button onClick={onCancel} aria-label="Close" className="p-1 rounded hover:bg-sage/30 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-5">
            <div className="text-[11px] text-text-ter mb-3">
              Only Draft orders are pickable — Open, Picked and Shipped orders are frozen.
            </div>
            {drafts.length === 0 ? (
              <div className="bg-sage/15 rounded-md px-4 py-3 text-[13px] text-text-sec">
                No Draft orders yet. Use <span className="font-semibold">Create Sales Order</span> to start a new one.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
                {drafts.map((so) => {
                  const isChosen = chosen === so.id;
                  return (
                    <button
                      key={so.id}
                      onClick={() => setChosen(so.id)}
                      className={[
                        "w-full text-left px-3 py-2.5 rounded-md border cursor-pointer transition-colors",
                        isChosen ? "border-coral bg-coral/[0.06]" : "border-sage bg-[#F9FAFB] hover:border-coral/60",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-semibold text-ink text-[13px]">{so.id}</span>
                        <SOStatusPill status={so.status} />
                        <span className="ml-auto text-[11px] text-text-ter">{formatDate(so.date)}</span>
                      </div>
                      <div className="text-[12px] text-text truncate">{getClientName(so.clientId)}</div>
                      <div className="text-[11px] text-text-sec">{so.lineItems.length} existing line{so.lineItems.length === 1 ? "" : "s"}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="primary" disabled={!chosen} onClick={() => chosen && onConfirm(chosen)}>
              Add to selected
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
