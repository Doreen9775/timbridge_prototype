import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink } from "lucide-react";
import type { ApprovalRequest, SalesOrder, SalesOrderStatus, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { FilterBar } from "@/components/shared/FilterBar";
import { useClients } from "@/hooks/useClients";
import { APPROVAL_TYPE_LABELS, type ApprovalDraft } from "./RequestApprovalForm";
import { SalesOrderPanel, type DraftLineItem } from "@/features/sales-orders/SalesOrderPanel";
import { DiscountCalc, LineItemsList } from "./discountParts";

// Shared search predicate for approval rows — matches approval #, related SO #, and the
// resolved client name (case-insensitive substring). Kept here so Manager's queue and
// Sales' MyApprovals filter identically.
export function matchesApprovalSearch(
  r: { id: string; relatedSoId?: string },
  clientName: string,
  q: string,
): boolean {
  if (!q) return true;
  return [r.id, r.relatedSoId ?? "", clientName].join(" ").toLowerCase().includes(q);
}

interface ApprovalQueueProps {
  approvalRequests: ApprovalRequest[];
  salesOrders: SalesOrder[];
  tags: Tag[];
  onResolve: (id: string, decision: "Approved" | "Rejected", note: string) => void;
  onUpdateSalesOrder: (so: SalesOrder) => void;
  onConfirmDraft: (soId: string, lineItems: DraftLineItem[]) => { ok: true } | { ok: false; unavailableIds: string[] };
  onAdvanceStatus: (soId: string, next: SalesOrderStatus) => void;
  onOpenTag: (id: string) => void;
  onOpenClient: (id: string) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}

export function ApprovalQueue({
  approvalRequests,
  salesOrders,
  tags,
  onResolve,
  onUpdateSalesOrder,
  onConfirmDraft,
  onAdvanceStatus,
  onOpenTag,
  onOpenClient,
  onCreateApproval,
  requesterIdentity,
}: ApprovalQueueProps) {
  const { getClientName, clientById } = useClients();

  const pending = useMemo(
    () =>
      approvalRequests
        .filter((r) => r.status === "Pending")
        // oldest first — queue processing order
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [approvalRequests],
  );

  // Accordion — only one row expanded at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const clientNameForReq = (r: ApprovalRequest): string => {
    const so = r.relatedSoId ? salesOrders.find((s) => s.id === r.relatedSoId) : null;
    return so && clientById.has(so.clientId) ? getClientName(so.clientId) : "";
  };

  const q = search.trim().toLowerCase();
  const filteredPending = useMemo(
    () => pending.filter((r) => matchesApprovalSearch(r, clientNameForReq(r), q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, q, salesOrders, clientById],
  );
  // "View full order" — a local overlay, independent of nav, so leaving the queue is
  // never required for the primary Approve/Reject flow.
  const [viewingSoId, setViewingSoId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleRow = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
    setNote("");
  };

  const commit = (req: ApprovalRequest, decision: "Approved" | "Rejected") => {
    onResolve(req.id, decision, note.trim());
    setExpandedId(null);
    setNote("");
    setToast(`${req.id} ${decision.toLowerCase()}`);
  };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const viewingSo = viewingSoId ? salesOrders.find((s) => s.id === viewingSoId) ?? null : null;

  return (
    <div className="min-h-full bg-cream p-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Approval Queue
            </h1>
            <p className="text-sm text-text-sec mt-1">
              Pending requests from Sales — click a request to review and approve or reject.
            </p>
          </div>
          <div className="text-[12px] text-text-ter">
            {pending.length} pending
          </div>
        </div>

        {pending.length > 0 && (
          <FilterBar
            filtersActive={q.length > 0}
            onReset={() => setSearch("")}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by approval #, SO #, or customer…",
              maxWidth: "360px",
            }}
            rightSlot={
              q.length > 0 ? (
                <div className="text-[12px] text-text-ter">
                  {filteredPending.length} {filteredPending.length === 1 ? "match" : "matches"}
                </div>
              ) : undefined
            }
          />
        )}

        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-sage p-10 text-center text-text-sec">
            <div className="text-[15px] font-semibold text-ink mb-1">No pending requests</div>
            <div className="text-[13px]">Nothing needs your review right now.</div>
          </div>
        ) : filteredPending.length === 0 ? (
          <div className="bg-white rounded-xl border border-sage p-10 text-center text-text-sec">
            <div className="text-[15px] font-semibold text-ink mb-1">No matching requests</div>
            <div className="text-[13px]">No pending request matches "{search}".</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPending.map((r) => {
              const isOpen = expandedId === r.id;
              const so = r.relatedSoId ? salesOrders.find((s) => s.id === r.relatedSoId) ?? null : null;
              const clientName = so && clientById.has(so.clientId) ? getClientName(so.clientId) : null;

              return (
                <div key={r.id} className="bg-white rounded-xl border border-sage overflow-hidden">
                  <button
                    onClick={() => toggleRow(r.id)}
                    className="w-full text-left p-4 flex items-start gap-3 cursor-pointer bg-transparent border-0 hover:bg-sage/[0.06]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[13px] font-semibold text-ink">{r.id}</span>
                        <span className="text-[11px] text-text-sec">{APPROVAL_TYPE_LABELS[r.type]}</span>
                        {r.relatedSoId && (
                          <>
                            <span className="text-[11px] text-text-ter">·</span>
                            <span className="font-mono text-[12px] text-text-sec">{r.relatedSoId}</span>
                          </>
                        )}
                        {clientName && (
                          <>
                            <span className="text-[11px] text-text-ter">·</span>
                            <span className="text-[12px] text-text-sec">{clientName}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[12px] text-text-ter">
                        From <span className="font-semibold text-text">{r.requestedBy}</span> · {r.createdAt}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-text-sec shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-sage/60 space-y-4">
                      {so && (
                        <div className="flex items-center justify-between">
                          <div className="text-[13px] text-text">
                            <span className="text-text-sec">Customer:</span>{" "}
                            <span className="font-semibold text-ink">{clientName ?? "Unknown"}</span>
                          </div>
                          <button
                            onClick={() => { setViewingSoId(so.id); setFullscreen(false); }}
                            className="text-[12px] text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1"
                          >
                            View full order <ExternalLink size={12} />
                          </button>
                        </div>
                      )}

                      {so && (
                        <div>
                          <div className="text-[11px] text-text-ter uppercase tracking-wide mb-1.5">Line items</div>
                          <LineItemsList so={so} tags={tags} />
                        </div>
                      )}

                      <DiscountCalc req={r} salesOrders={salesOrders} />

                      <div>
                        <div className="text-[11px] text-text-ter uppercase tracking-wide mb-1.5">Requester's note</div>
                        <div className="text-[13px] text-text bg-[#F9FAFB] rounded-md px-3 py-2">
                          {r.details || <span className="text-text-ter italic">No note provided</span>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-text-ter uppercase tracking-wide mb-1.5">
                          Reviewer note (optional)
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          placeholder="e.g. Approved for repeat customer — one-time exception."
                          className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button variant="destructive" onClick={() => commit(r, "Rejected")}>
                          Reject
                        </Button>
                        <Button variant="primary" onClick={() => commit(r, "Approved")}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingSo && (
        <SalesOrderPanel
          key={viewingSo.id}
          mode="view"
          so={viewingSo}
          allTags={tags}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClose={() => setViewingSoId(null)}
          onUpdateSalesOrder={onUpdateSalesOrder}
          onConfirmDraft={onConfirmDraft}
          onAdvanceStatus={onAdvanceStatus}
          onOpenTag={onOpenTag}
          onOpenClient={onOpenClient}
          onCreateApproval={onCreateApproval}
          requesterIdentity={requesterIdentity}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-sage text-ink rounded-lg shadow-lg pl-4 pr-4 py-3 border border-sage min-w-[240px]">
          <CheckCircle2 size={18} className="text-ink shrink-0" />
          <span className="text-[13px] font-medium flex-1">{toast}</span>
        </div>
      )}
    </div>
  );
}
