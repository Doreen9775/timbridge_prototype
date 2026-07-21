import { useMemo, useState } from "react";
import { X, Maximize2, Minimize2, ArrowRight, ShieldCheck, Plus, Trash2, AlertTriangle, Lock, ExternalLink } from "lucide-react";
import type { SalesOrder, SalesOrderLineItem, SalesOrderStatus, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { RequestApprovalForm, type ApprovalDraft } from "@/features/approvals/RequestApprovalForm";
import { ClientSelector } from "@/features/available-to-sell/ClientSelector";
import { useClients } from "@/hooks/useClients";
import { getSalesOrderEditMode, LOCK_TOOLTIP, type SOEditMode } from "./permissions";
import { calcExtendedPrice } from "@/lib/pricing";

// Unified Sales Order panel — replaces the earlier CreateSalesOrderPanel + SalesOrderDetail.
// One component, three faces:
//   mode="create"                → new SO from a selection (Available-to-Sell entry)
//   mode="view" + edit-all       → open Draft (all fields editable, add/remove lines, Confirm)
//   mode="view" + meta-only      → open Open/Picked (notes + expected ship date only)
//   mode="view" + readonly       → open Shipped/Cancelled (no edit controls)
//
// The status-based lock rules live in ./permissions.ts. This component derives
// `editMode` ONCE at the top and reads three booleans (canEditCustomer,
// canEditLineItems, canEditMeta) from that — no per-field status checks.

export interface DraftLineItem {
  tagId: string;
  qty: number;
  unitPrice: number;
  discountPct?: number;
}

const NEXT_STATUS: Partial<Record<SalesOrderStatus, SalesOrderStatus>> = {
  Open: "Picked",
  Picked: "Shipped",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}
function lineExtended(li: DraftLineItem | SalesOrderLineItem): number {
  return calcExtendedPrice(li.qty, li.unitPrice, li.discountPct);
}

interface CreateModeProps {
  mode: "create";
  initialTags: Tag[];
  allTags: Tag[];
  onCancel: () => void;
  onSaveDraft: (clientId: string, lineItems: DraftLineItem[]) => void;
  onConfirm: (clientId: string, lineItems: DraftLineItem[]) => { ok: true; soId: string } | { ok: false; unavailableIds: string[] };
}

interface ViewModeProps {
  mode: "view";
  so: SalesOrder;
  allTags: Tag[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onUpdateSalesOrder: (so: SalesOrder) => void;
  onConfirmDraft: (soId: string, lineItems: DraftLineItem[]) => { ok: true } | { ok: false; unavailableIds: string[] };
  onAdvanceStatus: (soId: string, next: SalesOrderStatus) => void;
  onOpenTag: (id: string) => void;
  onOpenClient: (id: string) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}

type SalesOrderPanelProps = CreateModeProps | ViewModeProps;

export function SalesOrderPanel(props: SalesOrderPanelProps) {
  return props.mode === "create" ? <CreatePanel {...props} /> : <ViewPanel {...props} />;
}

// ── Create mode ─────────────────────────────────────────────────────────────────
function CreatePanel({ initialTags, allTags, onCancel, onSaveDraft, onConfirm }: CreateModeProps) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLineItem[]>(
    () => initialTags.map((t) => ({ tagId: t.id, qty: t.qty, unitPrice: t.marketValue ?? 0 })),
  );
  const [confirmError, setConfirmError] = useState<string[] | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);

  const canSave = clientId !== null && lines.length > 0;

  const handleSaveDraft = () => {
    if (!canSave) return;
    onSaveDraft(clientId!, lines);
  };
  const handleConfirm = () => {
    if (!canSave) return;
    setConfirmError(null);
    const result = onConfirm(clientId!, lines);
    if (!result.ok) setConfirmError(result.unavailableIds);
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-ink/40" onClick={onCancel} />
      <div className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[560px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.12)] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
          <div>
            <div className="text-[11px] text-text-ter uppercase tracking-wide">New order</div>
            <div className="text-base font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Create Sales Order
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close" className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <PanelBody
            editMode="edit-all"
            clientId={clientId}
            onClientChange={setClientId}
            lines={lines}
            onLinesChange={setLines}
            allTags={allTags}
            unavailableIds={confirmError}
            notes={undefined}
            onNotesChange={() => {}}
            expectedShipDate={undefined}
            onExpectedShipDateChange={() => {}}
            showTagPicker={showTagPicker}
            setShowTagPicker={setShowTagPicker}
            createdDate={undefined}
          />

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
          <Button onClick={handleSaveDraft} disabled={!canSave}>Save as Draft</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!canSave}>Confirm Order</Button>
        </div>
      </div>
    </>
  );
}

// ── View / edit mode ────────────────────────────────────────────────────────────
function ViewPanel({
  so, allTags, fullscreen, onToggleFullscreen, onClose,
  onUpdateSalesOrder, onConfirmDraft, onAdvanceStatus,
  onOpenTag, onOpenClient, onCreateApproval, requesterIdentity,
}: ViewModeProps) {
  const editMode = getSalesOrderEditMode(so.status);
  const canEditCustomer = editMode === "edit-all";
  const canEditLineItems = editMode === "edit-all";
  const canEditMeta = editMode === "edit-all" || editMode === "meta-only";
  const isReadonly = editMode === "readonly";

  // Local edit buffer — the panel doesn't push writes on every keystroke; it lifts
  // them via onUpdateSalesOrder when the user clicks Save.
  const [clientId, setClientId] = useState<string | null>(so.clientId);
  const [lines, setLines] = useState<DraftLineItem[]>(
    () => so.lineItems.map((li) => ({ ...li })),
  );
  const [notes, setNotes] = useState(so.notes ?? "");
  const [expectedShipDate, setExpectedShipDate] = useState(so.expectedShipDate ?? "");
  const [pendingAdvance, setPendingAdvance] = useState<SalesOrderStatus | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalToast, setApprovalToast] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [confirmDraftError, setConfirmDraftError] = useState<string[] | null>(null);

  const { clientById, getClientName } = useClients();

  const dirty = useMemo(() => {
    if (canEditCustomer && clientId !== so.clientId) return true;
    if (canEditMeta && (notes !== (so.notes ?? "") || expectedShipDate !== (so.expectedShipDate ?? ""))) return true;
    if (canEditLineItems) {
      if (lines.length !== so.lineItems.length) return true;
      for (let i = 0; i < lines.length; i++) {
        const a = lines[i];
        const b = so.lineItems[i];
        if (!b) return true;
        if (a.tagId !== b.tagId || a.qty !== b.qty || a.unitPrice !== b.unitPrice || (a.discountPct ?? 0) !== (b.discountPct ?? 0)) return true;
      }
    }
    return false;
  }, [canEditCustomer, canEditMeta, canEditLineItems, clientId, notes, expectedShipDate, lines, so]);

  const canSave = dirty && (!canEditCustomer || clientId !== null) && lines.length > 0;
  const next = NEXT_STATUS[so.status];

  const handleSave = () => {
    if (!canSave) return;
    onUpdateSalesOrder({
      ...so,
      clientId: canEditCustomer ? clientId! : so.clientId,
      lineItems: canEditLineItems ? lines : so.lineItems,
      notes: canEditMeta ? (notes.trim() ? notes : undefined) : so.notes,
      expectedShipDate: canEditMeta ? (expectedShipDate || undefined) : so.expectedShipDate,
    });
  };

  const handleConfirmDraft = () => {
    if (!clientId || lines.length === 0) return;
    // Persist any edits first so a rejected confirm still keeps the user's changes.
    if (dirty) handleSave();
    setConfirmDraftError(null);
    const result = onConfirmDraft(so.id, lines);
    if (!result.ok) setConfirmDraftError(result.unavailableIds);
  };

  const header = (
    <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-base font-bold text-ink">{so.id}</span>
        <SOStatusPill status={so.status} />
      </div>
      <div className="flex items-center gap-1.5">
        {!isReadonly && (
          <Button size="sm" onClick={() => setShowApproval(true)} leftIcon={<ShieldCheck size={13} />}>
            Request approval
          </Button>
        )}
        {editMode === "edit-all" && (
          <Button size="sm" variant="primary" onClick={handleConfirmDraft} disabled={!clientId || lines.length === 0} rightIcon={<ArrowRight size={13} />}>
            Confirm Order
          </Button>
        )}
        {editMode === "meta-only" && next && (
          <Button size="sm" variant="primary" onClick={() => setPendingAdvance(next)} rightIcon={<ArrowRight size={13} />}>
            Mark {next}
          </Button>
        )}
        {!isReadonly && (
          <Button size="sm" variant="primary" onClick={handleSave} disabled={!canSave}>
            Save changes
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
      {editMode === "meta-only" && (
        <div className="flex items-center gap-2 bg-sage/15 border border-sage/60 rounded-md px-3 py-2 text-[12px] text-text-sec">
          <Lock size={13} className="text-text-sec shrink-0" />
          <span>Customer and line items are locked while tags are reserved. {LOCK_TOOLTIP}</span>
        </div>
      )}
      {editMode === "readonly" && (
        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-sage/60 rounded-md px-3 py-2 text-[12px] text-text-sec">
          <Lock size={13} className="text-text-sec shrink-0" />
          <span>This order is {so.status.toLowerCase()} and can no longer be edited.</span>
        </div>
      )}

      <PanelBody
        editMode={editMode}
        clientId={clientId}
        onClientChange={setClientId}
        onOpenClient={onOpenClient}
        lines={lines}
        onLinesChange={setLines}
        onOpenTag={onOpenTag}
        allTags={allTags}
        unavailableIds={confirmDraftError}
        notes={notes}
        onNotesChange={setNotes}
        expectedShipDate={expectedShipDate}
        onExpectedShipDateChange={setExpectedShipDate}
        showTagPicker={showTagPicker}
        setShowTagPicker={setShowTagPicker}
        createdDate={so.date}
        clientKnown={clientById.has(so.clientId)}
        clientNameFallback={getClientName(so.clientId)}
      />

      {confirmDraftError && (
        <div className="bg-coral/[0.08] border border-coral/40 rounded-md px-3 py-2.5 text-[12px] text-text">
          <div className="flex items-center gap-1.5 font-semibold text-coral mb-1">
            <AlertTriangle size={13} />
            Can't confirm — {confirmDraftError.length} tag{confirmDraftError.length === 1 ? "" : "s"} no longer Available
          </div>
          <div>Remove the highlighted line{confirmDraftError.length === 1 ? "" : "s"} and try again.</div>
        </div>
      )}
    </div>
  );

  const advanceDialog = pendingAdvance && (
    <div className="fixed inset-0 z-[110] bg-ink/40 flex items-center justify-center p-6" onClick={() => setPendingAdvance(null)}>
      <div className="bg-white w-full max-w-sm rounded-xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)]" onClick={(e) => e.stopPropagation()}>
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
      <div className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[560px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.12)] flex flex-col">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
      </div>
      {advanceDialog}
      {approvalForm}
      {approvalToastEl}
    </>
  );
}

// ── Shared body (customer + summary + meta + line items) ────────────────────────
interface PanelBodyProps {
  editMode: SOEditMode;
  clientId: string | null;
  onClientChange: (id: string | null) => void;
  onOpenClient?: (id: string) => void;
  lines: DraftLineItem[];
  onLinesChange: (next: DraftLineItem[]) => void;
  onOpenTag?: (id: string) => void;
  allTags: Tag[];
  unavailableIds: string[] | null;
  notes: string | undefined;
  onNotesChange: (v: string) => void;
  expectedShipDate: string | undefined;
  onExpectedShipDateChange: (v: string) => void;
  showTagPicker: boolean;
  setShowTagPicker: (v: boolean) => void;
  createdDate?: string;
  clientKnown?: boolean;
  clientNameFallback?: string;
}

function PanelBody({
  editMode, clientId, onClientChange, onOpenClient,
  lines, onLinesChange, onOpenTag, allTags,
  unavailableIds, notes, onNotesChange, expectedShipDate, onExpectedShipDateChange,
  showTagPicker, setShowTagPicker, createdDate, clientKnown, clientNameFallback,
}: PanelBodyProps) {
  const canEditCustomer = editMode === "edit-all";
  const canEditLineItems = editMode === "edit-all";
  const canEditMeta = editMode === "edit-all" || editMode === "meta-only";
  const { getClientName, clientById } = useClients();

  const orderTotal = useMemo(() => lines.reduce((s, li) => s + lineExtended(li), 0), [lines]);
  const totalPieces = useMemo(() => lines.reduce((s, li) => s + li.qty, 0), [lines]);

  const updateLine = (idx: number, patch: Partial<DraftLineItem>) => {
    onLinesChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const removeLine = (idx: number) => {
    onLinesChange(lines.filter((_, i) => i !== idx));
  };
  const addLines = (tags: Tag[]) => {
    onLinesChange([
      ...lines,
      ...tags.map((t) => ({ tagId: t.id, qty: t.qty, unitPrice: t.marketValue ?? 0 })),
    ]);
    setShowTagPicker(false);
  };

  const alreadyIds = new Set(lines.map((l) => l.tagId));
  const tagById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of allTags) m.set(t.id, t);
    return m;
  }, [allTags]);

  return (
    <div className="space-y-5">
      {/* Customer */}
      <div>
        <div className="text-xs text-text-sec mb-2">Customer</div>
        {canEditCustomer ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ClientSelector value={clientId} onChange={onClientChange} />
            </div>
            {onOpenClient && clientId && clientById.has(clientId) && (
              <button
                onClick={() => onOpenClient(clientId)}
                title="View client profile"
                aria-label="View client profile"
                className="shrink-0 p-2 rounded-md border border-sage text-text-sec hover:text-coral hover:border-coral cursor-pointer bg-white"
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        ) : (
          <LockedField tooltip={editMode === "meta-only" ? LOCK_TOOLTIP : undefined}>
            {clientKnown === false ? (
              <span className="text-[15px] font-semibold text-text-ter italic">Unknown client ({clientId})</span>
            ) : onOpenClient && clientId ? (
              <button
                onClick={() => onOpenClient(clientId)}
                className="text-[15px] font-semibold text-ink hover:text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
              >
                {clientNameFallback ?? (clientId ? getClientName(clientId) : "—")}
              </button>
            ) : (
              <span className="text-[15px] font-semibold text-ink">
                {clientId ? getClientName(clientId) : "—"}
              </span>
            )}
          </LockedField>
        )}
        {createdDate && (
          <div className="text-[11px] text-text-ter mt-1">Created {formatDate(createdDate)}</div>
        )}
      </div>

      {/* Meta — notes + expected ship date */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="text-xs text-text-sec mb-2">Expected ship date</div>
          {canEditMeta ? (
            <input
              type="date"
              value={expectedShipDate ?? ""}
              onChange={(e) => onExpectedShipDateChange(e.target.value)}
              className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral"
            />
          ) : (
            <LockedField>
              <span className="text-[13px] text-text">
                {expectedShipDate ? formatDate(expectedShipDate) : <span className="text-text-ter italic">Not set</span>}
              </span>
            </LockedField>
          )}
        </div>
        <div>
          <div className="text-xs text-text-sec mb-2">Notes</div>
          {canEditMeta ? (
            <textarea
              value={notes ?? ""}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Internal notes for this order…"
              className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral resize-y"
            />
          ) : (
            <LockedField>
              <span className="text-[13px] text-text whitespace-pre-wrap">
                {notes ? notes : <span className="text-text-ter italic">No notes</span>}
              </span>
            </LockedField>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div>
        <div className="text-xs text-text-sec mb-2">Order Summary</div>
        <div className="bg-[#F9FAFB] rounded-md px-4 py-3 flex items-end justify-between">
          <div>
            <div className="text-base font-semibold text-text leading-none">{lines.length}</div>
            <div className="text-[10px] text-text-ter mt-1">line items</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-text leading-none">{totalPieces.toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">pcs total</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-display font-bold text-ink leading-none">{formatUSD(orderTotal)}</div>
            <div className="text-[10px] text-text-ter mt-1">order total</div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs text-text-sec">Line Items</div>
          {canEditLineItems && (
            <button
              onClick={() => setShowTagPicker(true)}
              className="text-[12px] text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1"
            >
              <Plus size={12} /> Add tag
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="bg-[#F9FAFB] rounded-md px-4 py-3 text-[13px] text-text-ter">No line items yet</div>
        ) : canEditLineItems ? (
          <div className="border border-sage rounded-md overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-sage">
                  <th className="px-2.5 py-2 text-left text-text-sec font-medium whitespace-nowrap">Tag</th>
                  <th className="px-2 py-2 text-left text-text-sec font-medium">Species / Dims</th>
                  <th className="px-2 py-2 text-right text-text-sec font-medium w-[64px]">Qty</th>
                  <th className="px-2 py-2 text-right text-text-sec font-medium w-[82px]">Unit $</th>
                  <th className="px-2 py-2 text-right text-text-sec font-medium w-[60px]">Disc %</th>
                  <th className="px-2 py-2 text-right text-text-sec font-medium whitespace-nowrap">Extended</th>
                  <th className="px-1 py-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((li, i) => {
                  const t = tagById.get(li.tagId);
                  const isUnavailable = unavailableIds?.includes(li.tagId);
                  const maxQty = t?.qty ?? Infinity;
                  return (
                    <tr key={li.tagId} className={`border-b border-[#F3F4F6] last:border-b-0 ${isUnavailable ? "bg-coral/[0.08]" : ""}`}>
                      <td className="px-2.5 py-2 font-mono text-ink font-semibold whitespace-nowrap">{li.tagId}</td>
                      <td className="px-2 py-2 truncate max-w-[140px]">
                        {t ? `${t.species} · ${t.grade} · ${t.thick}×${t.width}×${t.length}'` : <span className="text-text-ter italic">tag not found</span>}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={li.qty}
                          onChange={(e) => updateLine(i, { qty: Math.max(1, Math.min(maxQty, Math.round(Number(e.target.value) || 0))) })}
                          className="w-full text-right border border-sage rounded px-1.5 py-0.5 text-[12px] outline-none focus:border-coral tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={li.unitPrice}
                          onChange={(e) => updateLine(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full text-right border border-sage rounded px-1.5 py-0.5 text-[12px] outline-none focus:border-coral tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={li.discountPct ?? 0}
                          onChange={(e) => updateLine(i, { discountPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          className="w-full text-right border border-sage rounded px-1.5 py-0.5 text-[12px] outline-none focus:border-coral tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink font-semibold whitespace-nowrap">
                        {formatUSD(lineExtended(li))}
                      </td>
                      <td className="px-1 py-2 text-center">
                        <button
                          onClick={() => removeLine(i)}
                          aria-label={`Remove ${li.tagId}`}
                          className="text-text-ter hover:text-coral bg-transparent border-0 p-0.5 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Readonly / meta-only view — simple list, uses onOpenTag deep-link if provided.
          <LockedField tooltip={editMode === "meta-only" ? LOCK_TOOLTIP : undefined}>
            <div className="flex flex-col gap-1.5">
              {lines.map((li) => {
                const t = tagById.get(li.tagId);
                return (
                  <div key={li.tagId} className="bg-[#F9FAFB] rounded-md px-3 py-2 flex items-center gap-2 text-[13px]">
                    {onOpenTag ? (
                      <button
                        onClick={() => onOpenTag(li.tagId)}
                        className="font-mono font-semibold text-coral cursor-pointer hover:underline bg-transparent border-0 p-0"
                      >
                        {li.tagId}
                      </button>
                    ) : (
                      <span className="font-mono font-semibold text-coral">{li.tagId}</span>
                    )}
                    <span className="flex-1 text-text truncate">
                      {t ? `${t.species} · ${t.grade} · ${t.thick}×${t.width}×${t.length}'` : <span className="text-text-ter italic">tag not found</span>}
                    </span>
                    <span className="text-text-sec whitespace-nowrap">{li.qty.toLocaleString()} pcs</span>
                    <span className="text-text-sec whitespace-nowrap">@ {formatUSD(li.unitPrice)}</span>
                    {li.discountPct ? <span className="text-text-sec whitespace-nowrap">−{li.discountPct}%</span> : null}
                    <span className="text-ink font-semibold whitespace-nowrap w-[90px] text-right">{formatUSD(lineExtended(li))}</span>
                  </div>
                );
              })}
            </div>
          </LockedField>
        )}
      </div>

      {showTagPicker && canEditLineItems && (
        <TagPicker
          allTags={allTags}
          excludeIds={alreadyIds}
          onCancel={() => setShowTagPicker(false)}
          onAdd={addLines}
        />
      )}
    </div>
  );
}

// ── LockedField — dashed border + optional tooltip on hover for meta-only mode ──
function LockedField({ tooltip, children }: { tooltip?: string; children: React.ReactNode }) {
  return (
    <div
      title={tooltip}
      className="bg-[#F9FAFB] border border-dashed border-sage rounded-md px-3 py-2 cursor-not-allowed"
    >
      {children}
    </div>
  );
}

// ── TagPicker — simple modal listing Available tags not already on the order ────
function TagPicker({
  allTags, excludeIds, onCancel, onAdd,
}: {
  allTags: Tag[];
  excludeIds: Set<string>;
  onCancel: () => void;
  onAdd: (tags: Tag[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  const eligible = useMemo(
    () =>
      allTags
        .filter((t) => t.status === "Available" && !excludeIds.has(t.id))
        .filter((t) => {
          if (!query.trim()) return true;
          const q = query.toLowerCase();
          return (
            t.id.toLowerCase().includes(q) ||
            t.species.toLowerCase().includes(q) ||
            t.grade.toLowerCase().includes(q)
          );
        }),
    [allTags, excludeIds, query],
  );

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = eligible.filter((t) => checked.has(t.id));

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-[115]" onClick={onCancel} />
      <div className="fixed inset-0 z-[116] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] w-full max-w-[520px] pointer-events-auto flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-sage/60">
            <h2 className="text-[16px] font-bold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Add tags to order
            </h2>
            <button onClick={onCancel} aria-label="Close" className="p-1 rounded hover:bg-sage/30 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 pt-3 pb-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by tag id, species, grade…"
              className="w-full border border-sage rounded-md px-3 py-2 text-[13px] bg-white outline-none focus:border-coral"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-2">
            {eligible.length === 0 ? (
              <div className="text-[12px] text-text-ter text-center py-6">No matching Available tags.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {eligible.map((t) => {
                  const isChecked = checked.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[13px] ${isChecked ? "bg-coral/[0.08]" : "hover:bg-sage/15"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(t.id)}
                        className="accent-coral w-4 h-4 cursor-pointer"
                      />
                      <span className="font-mono font-semibold text-ink w-[110px]">{t.id}</span>
                      <span className="flex-1 truncate text-text">
                        {t.species} · {t.grade} · {t.thick}×{t.width}×{t.length}'
                      </span>
                      <span className="text-text-sec tabular-nums whitespace-nowrap">{t.qty} pcs</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-sage/60">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={() => onAdd(chosen)} disabled={chosen.length === 0}>
              Add {chosen.length || ""} tag{chosen.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
