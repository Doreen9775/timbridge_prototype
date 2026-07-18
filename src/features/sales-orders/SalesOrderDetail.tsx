import { useMemo, useState } from "react";
import { X, Maximize2, Minimize2, ArrowRight, ShieldCheck } from "lucide-react";
import type { SalesOrder, SalesOrderStatus, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { RequestApprovalForm, type ApprovalDraft } from "@/features/approvals/RequestApprovalForm";
import { useClients } from "@/hooks/useClients";

// Sequential forward-only status ladder. Cancelled is a valid terminal state
// but has no forward transition button (see the state machine for Tag: same idea).
const NEXT_STATUS: Partial<Record<SalesOrderStatus, SalesOrderStatus>> = {
  Open: "Picked",
  Picked: "Shipped",
};

function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

interface SalesOrderDetailProps {
  so: SalesOrder;
  tags: Tag[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onAdvanceStatus: (soId: string, next: SalesOrderStatus) => void;
  onOpenTag: (id: string) => void;
  onOpenClient: (id: string) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}

export function SalesOrderDetail({
  so,
  tags,
  fullscreen,
  onToggleFullscreen,
  onClose,
  onAdvanceStatus,
  onOpenTag,
  onOpenClient,
  onCreateApproval,
  requesterIdentity,
}: SalesOrderDetailProps) {
  const [pendingAdvance, setPendingAdvance] = useState<SalesOrderStatus | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalToast, setApprovalToast] = useState<string | null>(null);
  const { clientById, getClientName } = useClients();

  const linkedTags = useMemo(
    () => so.lineItems.map((li) => ({ li, tag: tags.find((t) => t.id === li.tagId) ?? null })),
    [so.lineItems, tags],
  );
  const orderTotal = so.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
  const orderQty = so.lineItems.reduce((s, li) => s + li.qty, 0);
  const next = NEXT_STATUS[so.status];

  const header = (
    <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-base font-bold text-ink">{so.id}</span>
        <SOStatusPill status={so.status} />
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={() => setShowApproval(true)} leftIcon={<ShieldCheck size={13} />}>
          Request approval
        </Button>
        {next && (
          <Button size="sm" variant="primary" onClick={() => setPendingAdvance(next)} rightIcon={<ArrowRight size={13} />}>
            Mark {next}
          </Button>
        )}
        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral">
          <X size={18} />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-xs text-text-sec mb-2">Customer</div>
        {clientById.has(so.clientId) ? (
          <button
            onClick={() => onOpenClient(so.clientId)}
            className="text-[15px] font-semibold text-ink hover:text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer"
          >
            {getClientName(so.clientId)}
          </button>
        ) : (
          <div className="text-[15px] font-semibold text-text-ter italic">Unknown client ({so.clientId})</div>
        )}
        <div className="text-[11px] text-text-ter mt-1">Created {formatDate(so.date)}</div>
      </div>

      <div>
        <div className="text-xs text-text-sec mb-2">Order Summary</div>
        <div className="bg-[#F9FAFB] rounded-md px-4 py-3 flex items-end justify-between">
          <div>
            <div className="text-base font-semibold text-text leading-none">{so.lineItems.length}</div>
            <div className="text-[10px] text-text-ter mt-1">line items</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-text leading-none">{orderQty.toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">pcs total</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-display font-bold text-ink leading-none">{formatUSD(orderTotal)}</div>
            <div className="text-[10px] text-text-ter mt-1">order total</div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-text-sec mb-2">Line Items</div>
        {linkedTags.length === 0 ? (
          <div className="bg-[#F9FAFB] rounded-md px-4 py-3 text-[13px] text-text-ter">No line items yet</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkedTags.map(({ li, tag }) => (
              <div key={li.tagId} className="bg-[#F9FAFB] rounded-md px-3 py-2 flex items-center gap-2 text-[13px]">
                <button
                  onClick={() => onOpenTag(li.tagId)}
                  className="font-mono font-semibold text-coral cursor-pointer hover:underline bg-transparent border-0 p-0"
                >
                  {li.tagId}
                </button>
                <span className="flex-1 text-text truncate">
                  {tag ? `${tag.species} · ${tag.grade} · ${tag.thick}×${tag.width} × ${tag.length}'` : <span className="text-text-ter italic">tag not found</span>}
                </span>
                <span className="text-text-sec whitespace-nowrap">{li.qty.toLocaleString()} pcs</span>
                <span className="text-text-sec whitespace-nowrap">@ {formatUSD(li.unitPrice)}</span>
                <span className="text-ink font-semibold whitespace-nowrap w-[90px] text-right">{formatUSD(li.qty * li.unitPrice)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const advanceDialog = pendingAdvance && (
    <div
      className="fixed inset-0 z-[110] bg-ink/40 flex items-center justify-center p-6"
      onClick={() => setPendingAdvance(null)}
    >
      <div
        className="bg-white w-full max-w-sm rounded-xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-ink mb-1">Advance status?</div>
        <div className="text-[13px] text-text-sec mb-4">
          {so.status} → <span className="font-semibold text-text">{pendingAdvance}</span>
        </div>
        {pendingAdvance === "Shipped" && so.lineItems.length > 0 && (
          <div className="bg-sage/15 rounded-md px-3 py-2 mb-4 text-[12px] text-text">
            {so.lineItems.length} linked tag{so.lineItems.length === 1 ? "" : "s"} will also transition from Reserved to Shipped.
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setPendingAdvance(null)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onAdvanceStatus(so.id, pendingAdvance);
              setPendingAdvance(null);
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );

  const approvalForm = showApproval && (
    <RequestApprovalForm
      requestedBy={requesterIdentity}
      prefillSoId={so.id}
      onCancel={() => setShowApproval(false)}
      onSubmit={(draft) => {
        onCreateApproval(draft);
        setShowApproval(false);
        setApprovalToast(`Approval request submitted for ${so.id}`);
        window.setTimeout(() => setApprovalToast(null), 3000);
      }}
      zIndex={120}
    />
  );

  const approvalToastEl = approvalToast && (
    <div className="fixed bottom-6 right-6 z-[130] flex items-center gap-2.5 bg-sage text-ink rounded-lg shadow-lg pl-4 pr-4 py-3 border border-sage min-w-[280px]">
      <span className="text-[13px] font-medium flex-1">{approvalToast}</span>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-cream flex flex-col">
        <div className="w-full max-w-[900px] mx-auto flex-1 flex flex-col bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] my-6 rounded-2xl overflow-hidden">
          {header}
          <div className="flex-1 overflow-y-auto">{body}</div>
        </div>
        {advanceDialog}
        {approvalForm}
        {approvalToastEl}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-ink/40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[520px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.12)] flex flex-col">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
      </div>
      {advanceDialog}
      {approvalForm}
      {approvalToastEl}
    </>
  );
}
