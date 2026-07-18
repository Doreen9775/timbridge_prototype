import { useMemo } from "react";
import type { ApprovalRequest, ApprovalRequestStatus } from "@/lib/types";
import { ConfirmationBanner } from "@/components/shared/ConfirmationBanner";
import { APPROVAL_TYPE_LABELS } from "./RequestApprovalForm";

const STATUS_STYLES: Record<ApprovalRequestStatus, string> = {
  Pending: "bg-[#EEF0F2] text-[#6B7280]",
  Approved: "bg-[#EAF5D0] text-[#4E6B0E]",
  Rejected: "bg-[#FCE0D7] text-[#B23A1A]",
};

interface MyApprovalsProps {
  approvalRequests: ApprovalRequest[];
  identity: string;                                // current user's display name for the filter
  acknowledgedIds: Set<string>;
  onAcknowledgeResolved: (ids: string[]) => void;
  onOpenSo?: (id: string) => void;
}

export function MyApprovals({
  approvalRequests,
  identity,
  acknowledgedIds,
  onAcknowledgeResolved,
  onOpenSo,
}: MyApprovalsProps) {
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
        <div className="mb-5">
          <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
            My Approval Requests
          </h1>
          <p className="text-sm text-text-sec mt-1">
            Requests you've submitted and the manager's decisions.
          </p>
        </div>

        {mine.length === 0 ? (
          <div className="bg-white rounded-xl border border-sage p-10 text-center text-text-sec">
            <div className="text-[15px] font-semibold text-ink mb-1">Nothing to show yet</div>
            <div className="text-[13px]">Submit a request from the Reserve modal or a Sales Order.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mine.map((r) => {
              const isFresh = r.status !== "Pending" && !acknowledgedIds.has(r.id);
              return (
                <div
                  key={r.id}
                  className={[
                    "bg-white rounded-xl border p-4 transition-colors",
                    isFresh ? "border-coral shadow-[0_2px_8px_rgba(240,84,43,0.12)]" : "border-sage",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[13px] font-semibold text-ink">{r.id}</span>
                        <span className={`whitespace-nowrap inline-block px-2.5 py-[3px] rounded-xl text-[11px] font-medium ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                        {isFresh && (
                          <span className="text-[10px] text-coral font-semibold uppercase tracking-wide">New decision</span>
                        )}
                      </div>
                      <div className="text-[13px] text-text-sec">
                        {APPROVAL_TYPE_LABELS[r.type]}
                        {r.relatedSoId && (
                          <>
                            {" · "}
                            <button
                              onClick={() => onOpenSo?.(r.relatedSoId!)}
                              className="font-mono text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer"
                            >
                              {r.relatedSoId}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-text-ter whitespace-nowrap">Submitted {r.createdAt}</div>
                  </div>

                  <div className="text-[13px] text-text bg-[#F9FAFB] rounded-md px-3 py-2 mb-2">
                    {r.details}
                  </div>

                  {r.status !== "Pending" && (
                    <div className="mt-3 pt-3 border-t border-sage/40 text-[13px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-sec">
                          {r.status} by <span className="font-semibold text-ink">{r.reviewedBy}</span>
                        </span>
                        <span className="text-[11px] text-text-ter">{r.resolvedAt}</span>
                      </div>
                      {r.reviewNote && (
                        <div className="text-text mt-1 italic">"{r.reviewNote}"</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
