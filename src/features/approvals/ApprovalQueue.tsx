import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ApprovalRequest } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { APPROVAL_TYPE_LABELS } from "./RequestApprovalForm";

interface ApprovalQueueProps {
  approvalRequests: ApprovalRequest[];
  onResolve: (id: string, decision: "Approved" | "Rejected", note: string) => void;
  onOpenSo?: (id: string) => void;
}

type ReviewDraft = { req: ApprovalRequest; decision: "Approved" | "Rejected" };

export function ApprovalQueue({ approvalRequests, onResolve, onOpenSo }: ApprovalQueueProps) {
  const pending = useMemo(
    () =>
      approvalRequests
        .filter((r) => r.status === "Pending")
        // oldest first — queue processing order
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [approvalRequests],
  );

  const [reviewing, setReviewing] = useState<ReviewDraft | null>(null);
  const [note, setNote] = useState("");

  const startReview = (req: ApprovalRequest, decision: "Approved" | "Rejected") => {
    setReviewing({ req, decision });
    setNote("");
  };
  const cancelReview = () => setReviewing(null);
  const commit = () => {
    if (!reviewing) return;
    onResolve(reviewing.req.id, reviewing.decision, note.trim());
    setReviewing(null);
    setNote("");
  };

  return (
    <div className="min-h-full bg-cream p-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Approval Queue
            </h1>
            <p className="text-sm text-text-sec mt-1">
              Pending requests from Sales — approve or reject with an optional note.
            </p>
          </div>
          <div className="text-[12px] text-text-ter">
            {pending.length} pending
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-sage p-10 text-center text-text-sec">
            <div className="text-[15px] font-semibold text-ink mb-1">No pending requests</div>
            <div className="text-[13px]">Nothing needs your review right now.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-sage p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[13px] font-semibold text-ink">{r.id}</span>
                      <span className="text-[11px] text-text-sec">
                        {APPROVAL_TYPE_LABELS[r.type]}
                      </span>
                      {r.relatedSoId && (
                        <>
                          <span className="text-[11px] text-text-ter">·</span>
                          <button
                            onClick={() => onOpenSo?.(r.relatedSoId!)}
                            className="font-mono text-[12px] text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer"
                          >
                            {r.relatedSoId}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="text-[12px] text-text-ter">
                      From <span className="font-semibold text-text">{r.requestedBy}</span> · {r.createdAt}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => startReview(r, "Approved")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => startReview(r, "Rejected")}>
                      Reject
                    </Button>
                  </div>
                </div>
                <div className="text-[13px] text-text bg-[#F9FAFB] rounded-md px-3 py-2">
                  {r.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewing && (
        <>
          <div className="fixed inset-0 bg-ink/40 z-[100]" onClick={cancelReview} />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] w-full max-w-[440px] pointer-events-auto">
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-sage/60">
                <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {reviewing.decision === "Approved" ? "Approve" : "Reject"} {reviewing.req.id}?
                </h2>
                <button onClick={cancelReview} aria-label="Close" className="p-1 rounded hover:bg-sage/30 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-5">
                <div className="text-[12px] text-text-ter mb-3">
                  {APPROVAL_TYPE_LABELS[reviewing.req.type]}
                  {reviewing.req.relatedSoId && (
                    <>
                      {" · "}
                      <span className="font-mono font-semibold text-ink">{reviewing.req.relatedSoId}</span>
                    </>
                  )}
                  {" · "}from <span className="font-semibold text-ink">{reviewing.req.requestedBy}</span>
                </div>
                <div className="text-[13px] text-text bg-[#F9FAFB] rounded-md px-3 py-2 mb-4">
                  {reviewing.req.details}
                </div>
                <label className="block text-[13px] font-semibold text-ink mb-2">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={
                    reviewing.decision === "Approved"
                      ? "e.g. Approved for repeat customer — one-time exception."
                      : "e.g. Not this quarter; revisit after margin review."
                  }
                  className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
                <Button onClick={cancelReview}>Cancel</Button>
                <Button variant={reviewing.decision === "Approved" ? "primary" : "destructive"} onClick={commit}>
                  Confirm {reviewing.decision === "Approved" ? "Approve" : "Reject"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
