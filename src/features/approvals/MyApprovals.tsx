import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Pencil } from "lucide-react";
import type { ApprovalRequest, ApprovalRequestStatus, SalesOrder, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { FilterBar } from "@/components/shared/FilterBar";
import { ConfirmationBanner } from "@/components/shared/ConfirmationBanner";
import { useClients } from "@/hooks/useClients";
import { APPROVAL_TYPE_LABELS, type ApprovalDraft } from "./RequestApprovalForm";
import { RequestDiscountForm } from "./RequestDiscountForm";
import { DiscountCalc, LineItemsList } from "./discountParts";
import { matchesApprovalSearch } from "./ApprovalQueue";
import { SalesOrderPanel } from "@/features/sales-orders/SalesOrderPanel";

const STATUS_STYLES: Record<ApprovalRequestStatus, string> = {
  Pending: "bg-[#EEF0F2] text-[#6B7280]",
  Approved: "bg-[#EAF5D0] text-[#4E6B0E]",
  Rejected: "bg-[#FCE0D7] text-[#B23A1A]",
};

interface MyApprovalsProps {
  approvalRequests: ApprovalRequest[];
  salesOrders: SalesOrder[];
  tags: Tag[];
  identity: string;                                // current user's display name for the filter
  acknowledgedIds: Set<string>;
  onAcknowledgeResolved: (ids: string[]) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  onUpdateApproval: (id: string, patch: { relatedSoId?: string; discountRate?: number; details: string }) => void;
}

export function MyApprovals({
  approvalRequests,
  salesOrders,
  tags,
  identity,
  acknowledgedIds,
  onAcknowledgeResolved,
  onCreateApproval,
  onUpdateApproval,
}: MyApprovalsProps) {
  const { getClientName, clientById } = useClients();
  const [showRequestDiscount, setShowRequestDiscount] = useState(false);
  const [editing, setEditing] = useState<ApprovalRequest | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  // "View full order" — a local read-only overlay so Sales never leaves the approval view.
  const [viewingSoId, setViewingSoId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleSubmitDiscount = (draft: ApprovalDraft) => {
    onCreateApproval(draft);
    setShowRequestDiscount(false);
    setToast(`Discount request submitted for ${draft.relatedSoId}`);
  };

  const handleSubmitEdit = (draft: ApprovalDraft) => {
    if (!editing) return;
    onUpdateApproval(editing.id, { relatedSoId: draft.relatedSoId, discountRate: draft.discountRate, details: draft.details });
    setToast(`${editing.id} updated`);
    setEditing(null);
  };

  const mine = useMemo(
    () =>
      approvalRequests
        .filter((r) => r.requestedBy === identity)
        // most recent first so newly-resolved decisions surface at the top
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [approvalRequests, identity],
  );

  const unacknowledgedResolved = useMemo(
    () => mine.filter((r) => r.status !== "Pending" && !acknowledgedIds.has(r.id)),
    [mine, acknowledgedIds],
  );

  const clientNameForReq = (r: ApprovalRequest): string => {
    const so = r.relatedSoId ? salesOrders.find((s) => s.id === r.relatedSoId) : null;
    return so && clientById.has(so.clientId) ? getClientName(so.clientId) : "";
  };

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () => mine.filter((r) => matchesApprovalSearch(r, clientNameForReq(r), q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine, q, salesOrders, clientById],
  );

  const viewingSo = viewingSoId ? salesOrders.find((s) => s.id === viewingSoId) ?? null : null;

  return (
    <div className="min-h-full bg-cream">
      {unacknowledgedResolved.length > 0 && (
        <ConfirmationBanner
          message={`${unacknowledgedResolved.length} of your requests ${
            unacknowledgedResolved.length === 1 ? "has" : "have"
          } a decision`}
          actionLabel="Got it"
          onAction={() => onAcknowledgeResolved(unacknowledgedResolved.map((r) => r.id))}
          onDismiss={() => onAcknowledgeResolved(unacknowledgedResolved.map((r) => r.id))}
        />
      )}
      <div className="p-6 max-w-[1000px] mx-auto">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
              My Approval Requests
            </h1>
            <p className="text-sm text-text-sec mt-1">
              Requests you've submitted and the manager's decisions.
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowRequestDiscount(true)}>
            Request Discount
          </Button>
        </div>

        {mine.length > 0 && (
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
                  {filtered.length} {filtered.length === 1 ? "match" : "matches"}
                </div>
              ) : undefined
            }
          />
        )}

        {mine.length === 0 ? (
          <div className="bg-white rounded-xl border border-sage p-10 text-center text-text-sec">
            <div className="text-[15px] font-semibold text-ink mb-1">Nothing to show yet</div>
            <div className="text-[13px]">Submit a request from a Sales Order, or Request Discount above.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-sage p-10 text-center text-text-sec">
            <div className="text-[15px] font-semibold text-ink mb-1">No matching requests</div>
            <div className="text-[13px]">None of your requests match "{search}".</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => {
              const isFresh = r.status !== "Pending" && !acknowledgedIds.has(r.id);
              const isOpen = expandedId === r.id;
              const so = r.relatedSoId ? salesOrders.find((s) => s.id === r.relatedSoId) ?? null : null;
              const clientName = so && clientById.has(so.clientId) ? getClientName(so.clientId) : null;
              const canEdit = r.status === "Pending" && r.type === "discount";

              return (
                <div
                  key={r.id}
                  className={[
                    "bg-white rounded-xl border overflow-hidden transition-colors",
                    isFresh ? "border-coral shadow-[0_2px_8px_rgba(240,84,43,0.12)]" : "border-sage",
                  ].join(" ")}
                >
                  <button
                    onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                    className="w-full text-left p-4 flex items-start gap-3 cursor-pointer bg-transparent border-0 hover:bg-sage/[0.06]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[13px] font-semibold text-ink">{r.id}</span>
                        <span className={`whitespace-nowrap inline-block px-2.5 py-[3px] rounded-xl text-[11px] font-medium ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                        {isFresh && (
                          <span className="text-[10px] text-coral font-semibold uppercase tracking-wide">New decision</span>
                        )}
                      </div>
                      <div className="text-[13px] text-text-sec flex items-center gap-2 flex-wrap">
                        <span>{APPROVAL_TYPE_LABELS[r.type]}</span>
                        {r.relatedSoId && (
                          <>
                            <span className="text-text-ter">·</span>
                            <span className="font-mono text-text-sec">{r.relatedSoId}</span>
                          </>
                        )}
                        {clientName && (
                          <>
                            <span className="text-text-ter">·</span>
                            <span>{clientName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-text-ter whitespace-nowrap">Submitted {r.createdAt}</span>
                      <ChevronDown size={16} className={`text-text-sec transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
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
                        <div className="text-[11px] text-text-ter uppercase tracking-wide mb-1.5">Your note</div>
                        <div className="text-[13px] text-text bg-[#F9FAFB] rounded-md px-3 py-2">
                          {r.details || <span className="text-text-ter italic">No note provided</span>}
                        </div>
                      </div>

                      {r.status !== "Pending" && (
                        <div className="pt-3 border-t border-sage/40 text-[13px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-text-sec">
                              {r.status} by <span className="font-semibold text-ink">{r.reviewedBy}</span>
                            </span>
                            <span className="text-[11px] text-text-ter">{r.resolvedAt}</span>
                          </div>
                          {r.reviewNote && <div className="text-text mt-1 italic">"{r.reviewNote}"</div>}
                        </div>
                      )}

                      {canEdit && (
                        <div className="flex items-center justify-end">
                          <Button size="sm" onClick={() => setEditing(r)} leftIcon={<Pencil size={13} />}>
                            Edit request
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showRequestDiscount && (
        <RequestDiscountForm
          salesOrders={salesOrders}
          getClientName={getClientName}
          onCancel={() => setShowRequestDiscount(false)}
          onSubmit={handleSubmitDiscount}
        />
      )}

      {editing && (
        <RequestDiscountForm
          salesOrders={salesOrders}
          getClientName={getClientName}
          initial={{ relatedSoId: editing.relatedSoId, discountRate: editing.discountRate, details: editing.details }}
          title={`Edit ${editing.id}`}
          submitLabel="Save changes"
          onCancel={() => setEditing(null)}
          onSubmit={handleSubmitEdit}
        />
      )}

      {viewingSo && (
        <SalesOrderPanel
          key={viewingSo.id}
          mode="view"
          so={viewingSo}
          allTags={tags}
          readOnly
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClose={() => setViewingSoId(null)}
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
