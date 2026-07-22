import { useMemo, useState } from "react";
import { X, Maximize2, Minimize2, Pencil, Mail, Phone, MapPin, Map, CreditCard } from "lucide-react";
import type { Client, SalesOrder } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { SOStatusPill } from "@/components/shared/SOStatusPill";

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
  salesOrders: SalesOrder[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Client, "id" | "createdAt">>) => void;
  onOpenSo: (id: string) => void;
}

export function ClientDetail({
  client,
  salesOrders,
  fullscreen,
  onToggleFullscreen,
  onClose,
  onSave,
  onOpenSo,
}: ClientDetailProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Client>(client);

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
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs text-text-sec">Linked Sales Orders</div>
          <div className="text-[11px] text-text-ter">
            {orderCount} {orderCount === 1 ? "order" : "orders"}
            {orderCount > 0 && ` · ${formatUSD(totalRevenue)} total`}
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

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-cream flex flex-col">
        <div className="w-full max-w-[900px] mx-auto flex-1 flex flex-col bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] my-6 rounded-2xl overflow-hidden">
          {header}
          <div className="flex-1 overflow-y-auto">{body}</div>
        </div>
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
    </>
  );
}
