import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/shared/Button";
import type { ApprovalRequestType } from "@/lib/types";

const TYPE_LABELS: Record<ApprovalRequestType, string> = {
  discount: "Discount",
  creditTerm: "Credit term",
  orderCancellation: "Order cancellation",
  other: "Other",
};

const TYPE_OPTIONS: ApprovalRequestType[] = ["discount", "creditTerm", "orderCancellation", "other"];

export interface ApprovalDraft {
  type: ApprovalRequestType;
  relatedSoId?: string;
  discountRate?: number;    // 0–100. Set by the Request Discount quick-entry form; this
                             // generic free-text form never sets it.
  details: string;
}

interface RequestApprovalFormProps {
  requestedBy: string;             // display name of the current user (from role)
  relatedSoId: string;             // the Sales Order this request is scoped to (always required)
  onCancel: () => void;
  onSubmit: (draft: ApprovalDraft) => void;
  zIndex?: number;                  // higher when stacked over the SO panel
}

export function RequestApprovalForm({
  requestedBy,
  relatedSoId,
  onCancel,
  onSubmit,
  zIndex = 60,
}: RequestApprovalFormProps) {
  const [type, setType] = useState<ApprovalRequestType>("discount");
  const [details, setDetails] = useState("");
  const canSubmit = details.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      type,
      relatedSoId,
      details: details.trim(),
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-ink/40" style={{ zIndex }} onClick={onCancel} />
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: zIndex + 1 }}
      >
        <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] w-full max-w-[460px] pointer-events-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-sage/60">
            <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Request Approval
            </h2>
            <button onClick={onCancel} aria-label="Close" className="p-1 rounded hover:bg-sage/30 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-5">
            <div className="text-[11px] text-text-ter mb-4">
              Submitting as <span className="font-semibold text-ink">{requestedBy}</span>
              {" · "}related order <span className="font-mono font-semibold text-ink">{relatedSoId}</span>
            </div>

            <label className="block text-[13px] font-semibold text-ink mb-2">Request type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ApprovalRequestType)}
              className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral cursor-pointer mb-4"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>

            <label className="block text-[13px] font-semibold text-ink mb-2">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Explain what you need approval for — e.g. 8% discount for repeat customer on this order."
              className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
              Submit request
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export { TYPE_LABELS as APPROVAL_TYPE_LABELS };
