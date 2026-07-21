import { useState } from "react";
import { X } from "lucide-react";
import type { Client } from "@/lib/types";
import { Button } from "@/components/shared/Button";

// Right-side slide-in creation panel — mirrors ClientDetail's shell (backdrop +
// panel position/width/z-order) so open/close animation matches the rest of the
// app's detail drawers. The list underneath stays mounted (fixed-position overlay),
// so scroll and filter state are naturally preserved on close.
interface ClientCreateProps {
  onCancel: () => void;
  onCreate: (draft: Omit<Client, "id" | "createdAt">) => void;
}

const inputCls =
  "w-full border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral";

export function ClientCreate({ onCancel, onCreate }: ClientCreateProps) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [territory, setTerritory] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onCreate({
      name: trimmed,
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      territory: territory.trim() || undefined,
      paymentTerms: paymentTerms.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const field = (label: string, node: React.ReactNode) => (
    <label className="block">
      <div className="text-[11px] text-text-ter mb-1">{label}</div>
      {node}
    </label>
  );

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-ink/40" onClick={onCancel} />
      <div className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[520px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.12)] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
          <div>
            <div className="text-[11px] text-text-ter uppercase tracking-wide">New client</div>
            <div
              className="text-base font-bold text-ink"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Create Client
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {field(
            "Customer name *",
            <input
              autoFocus
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coastal Builders Supply"
            />,
          )}
          <div className="grid grid-cols-2 gap-3">
            {field(
              "Contact name",
              <input
                className={inputCls}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />,
            )}
            {field(
              "Phone",
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />,
            )}
          </div>
          {field(
            "Email",
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />,
          )}
          <div className="grid grid-cols-2 gap-3">
            {field(
              "Territory",
              <input
                className={inputCls}
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                placeholder="e.g. BC Coast"
              />,
            )}
            {field(
              "Payment terms",
              <input
                className={inputCls}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30"
              />,
            )}
          </div>
          {field(
            "Notes",
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferences, credit history, delivery notes…"
            />,
          )}
        </div>

        <div className="px-5 py-4 border-t border-sage flex items-center justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            Create Client
          </Button>
        </div>
      </div>
    </>
  );
}
