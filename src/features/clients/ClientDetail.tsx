import { useEffect, useMemo, useState } from "react";
import { X, Maximize2, Minimize2, Pencil, Mail, Phone, MapPin, Map, CreditCard, FilePlus } from "lucide-react";
import type { Client, Role, SalesOrder, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { SalesOrderPanel } from "@/features/sales-orders/SalesOrderPanel";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

interface ClientDetailProps {
  client: Client;
  tags: Tag[];
  role: Role;
  salesOrders: SalesOrder[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Client, "id" | "createdAt">>) => void;
  onOpenSo: (id: string) => void;
  onCreateSalesOrder: (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number; discountPct?: number }[],
    confirm: boolean,
    meta?: { notes?: string; expectedShipDate?: string },
  ) => { ok: true; soId: string } | { ok: false; unavailableIds: string[] };
  onViewOrders: (soId?: string) => void;
}

export function ClientDetail({
  client,
  tags,
  role,
  salesOrders,
  fullscreen,
  onToggleFullscreen,
  onClose,
  onSave,
  onOpenSo,
  onCreateSalesOrder,
  onViewOrders,
}: ClientDetailProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Client>(client);
  // Starting a new order for this client is Sales-only (same rule as Available-to-Sell;
  // Prompt 3). Inline role gate + teardown effect mirrors that pattern.
  const isSalesUser = role === "sales";
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Defense-in-depth: if the role leaves Sales mid-session, tear the create panel down.
  useEffect(() => {
    if (!isSalesUser) setCreatingOrder(false);
  }, [isSalesUser]);

  // New order from this client: customer is pre-filled + locked to `client.id`, so the
  // clientId handed back is always this client. Draft/Confirm behave exactly as they do
  // from Available-to-Sell (same handler). Save-as-Draft closes the panel; Confirm leaves
  // it open so the panel can show its own success stage (with links to the new order).
  const handleOrderSaveDraft = (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number }[],
    meta?: { notes?: string; expectedShipDate?: string },
  ) => {
    const result = onCreateSalesOrder(clientId, lineItems, false, meta);
    if (result.ok) setCreatingOrder(false);
  };
  const handleOrderConfirm = (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number }[],
    meta?: { notes?: string; expectedShipDate?: string },
  ) => {
    return onCreateSalesOrder(clientId, lineItems, true, meta);
  };

  const startEdit = () => {
    setDraft(client);
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(client);
    setEditing(false);
  };
  const commit = () => {
    onSave({
      name: draft.name.trim() || client.name,
      contactName: draft.contactName?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      address: draft.address?.trim() || undefined,
      territory: draft.territory?.trim() || undefined,
      paymentTerms: draft.paymentTerms?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    });
    setEditing(false);
  };

  const linkedSOs = useMemo(
    () =>
      salesOrders
        .filter((so) => so.clientId === client.id)
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [salesOrders, client.id],
  );

  const orderCount = linkedSOs.length;
  const totalRevenue = useMemo(
    () =>
      linkedSOs.reduce(
        (sum, so) => sum + so.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0),
        0,
      ),
    [linkedSOs],
  );

  const inputCls = "w-full border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral";

  const header = (
    <div className="px-5 pt-5 pb-4 border-b border-sage">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[13px] text-text-sec shrink-0">{client.id}</span>
          <span className="text-base font-bold text-ink truncate">{editing ? draft.name : client.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
      <div className="flex items-center gap-1.5 mt-3">
        {editing ? (
          <>
            <Button size="sm" onClick={cancelEdit}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={commit}>Save</Button>
          </>
        ) : (
          <Button size="sm" onClick={startEdit} leftIcon={<Pencil size={13} />}>Edit</Button>
        )}
      </div>
    </div>
  );

  const field = (label: string, node: React.ReactNode) => (
    <label className="block">
      <div className="text-[11px] text-text-ter mb-1">{label}</div>
      {node}
    </label>
  );

  const editBody = (
    <div className="p-5 space-y-4">
      {field("Name", (
        <input className={inputCls} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
      ))}
      <div className="grid grid-cols-2 gap-3">
        {field("Contact name", (
          <input className={inputCls} value={draft.contactName ?? ""} onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))} />
        ))}
        {field("Phone", (
          <input className={inputCls} value={draft.phone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
        ))}
      </div>
      {field("Email", (
        <input className={inputCls} type="email" value={draft.email ?? ""} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
      ))}
      {field("Address", (
        <input className={inputCls} value={draft.address ?? ""} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
      ))}
      <div className="grid grid-cols-2 gap-3">
        {field("Territory", (
          <input className={inputCls} value={draft.territory ?? ""} onChange={(e) => setDraft((d) => ({ ...d, territory: e.target.value }))} placeholder="e.g. BC Coast" />
        ))}
        {field("Payment terms", (
          <input className={inputCls} value={draft.paymentTerms ?? ""} onChange={(e) => setDraft((d) => ({ ...d, paymentTerms: e.target.value }))} placeholder="e.g. Net 30" />
        ))}
      </div>
      {field("Notes", (
        <textarea
          className={`${inputCls} resize-none`}
          rows={4}
          value={draft.notes ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Preferences, credit terms, historical notes…"
        />
      ))}
    </div>
  );

  const viewRow = (Icon: React.ComponentType<{ size?: number; className?: string }>, label: string, value?: string) => (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-sage/25 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-ink" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-text-ter uppercase tracking-wide">{label}</div>
        <div className="text-[13px] text-text truncate">{value?.trim() || <span className="text-text-ter italic">Not set</span>}</div>
      </div>
    </div>
  );

  const viewBody = (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-xs text-text-sec mb-2">Contact</div>
        <div className="bg-[#F9FAFB] rounded-md p-3 flex flex-col gap-3">
          {viewRow(Pencil, "Contact name", client.contactName)}
          {viewRow(Phone, "Phone", client.phone)}
          {viewRow(Mail, "Email", client.email)}
          {viewRow(MapPin, "Address", client.address)}
          {viewRow(Map, "Territory", client.territory)}
          {viewRow(CreditCard, "Payment terms", client.paymentTerms)}
        </div>
        <div className="text-[11px] text-text-ter mt-2">Created {client.createdAt}</div>
      </div>

      {client.notes && (
        <div>
          <div className="text-xs text-text-sec mb-2">Notes</div>
          <div className="bg-[#F9FAFB] rounded-md p-3 text-[13px] text-text whitespace-pre-wrap">{client.notes}</div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs text-text-sec">Linked Sales Orders</div>
          <div className="flex items-center gap-2.5">
            <div className="text-[11px] text-text-ter">
              {orderCount} {orderCount === 1 ? "order" : "orders"}
              {orderCount > 0 && ` · ${formatUSD(totalRevenue)} total`}
            </div>
            {isSalesUser && (
              <Button size="sm" variant="primary" onClick={() => setCreatingOrder(true)} leftIcon={<FilePlus size={13} />}>
                New Sales Order
              </Button>
            )}
          </div>
        </div>
        {linkedSOs.length === 0 ? (
          <div className="bg-[#F9FAFB] rounded-md px-4 py-3 text-[13px] text-text-ter">No orders yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkedSOs.map((so) => {
              const total = so.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
              return (
                <div key={so.id} className="bg-[#F9FAFB] rounded-md px-3 py-2 flex items-center gap-2 text-[13px]">
                  <button
                    onClick={() => onOpenSo(so.id)}
                    className="font-mono font-semibold text-coral cursor-pointer hover:underline bg-transparent border-0 p-0"
                  >
                    {so.id}
                  </button>
                  <SOStatusPill status={so.status} />
                  <span className="flex-1 text-text-sec text-[12px] whitespace-nowrap">{formatDate(so.date)}</span>
                  <span className="text-text-sec whitespace-nowrap">{so.lineItems.length} {so.lineItems.length === 1 ? "line" : "lines"}</span>
                  <span className="text-ink font-semibold whitespace-nowrap w-[90px] text-right">{formatUSD(total)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const body = editing ? editBody : viewBody;

  // Create-order panel (Sales only). Rendered as a sibling of whichever layout is active
  // so it stacks above this drawer; customer is locked to this client.
  const orderPanel = isSalesUser && creatingOrder && (
    <SalesOrderPanel
      mode="create"
      initialTags={[]}
      allTags={tags}
      lockedClientId={client.id}
      onCancel={() => setCreatingOrder(false)}
      onSaveDraft={handleOrderSaveDraft}
      onConfirm={handleOrderConfirm}
      onViewOrders={onViewOrders}
    />
  );

  // Backdrop click closes the drawer — but not while editing the client or creating an
  // order, so an in-progress action isn't lost by a stray click.
  const closeOnBackdrop = editing || creatingOrder ? undefined : onClose;

  if (fullscreen) {
    // Dim-backdrop lightbox (mirrors Stock Locator's tag-detail fullscreen) rather than an
    // opaque takeover, so the client list stays visible behind it instead of reading as a
    // separate blank page.
    return (
      <>
        <div
          className="fixed inset-0 z-[100] bg-ink/40 flex items-center justify-center p-6"
          onClick={closeOnBackdrop}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] rounded-xl overflow-y-auto shadow-[0_10px_40px_rgba(0,0,0,0.25)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {header}
            <div className="flex-1 overflow-y-auto">{body}</div>
          </div>
        </div>
        {orderPanel}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-ink/40" onClick={closeOnBackdrop} />
      <div className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[520px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.12)] flex flex-col">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
      </div>
      {orderPanel}
    </>
  );
}
