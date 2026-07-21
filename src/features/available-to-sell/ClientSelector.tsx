import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useClients } from "@/hooks/useClients";

// Type-to-filter combobox over the Client entity — used by the Create SO panel.
// Matches by name / contactName / email substring, case-insensitive.
interface ClientSelectorProps {
  value: string | null;                    // selected clientId
  onChange: (clientId: string | null) => void;
  disabled?: boolean;
}

export function ClientSelector({ value, onChange, disabled }: ClientSelectorProps) {
  const { clients, clientById } = useClients();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? clientById.get(value) ?? null : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [c.name, c.contactName, c.email].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={[
          "w-full flex items-center gap-2 px-3 py-2 text-[13px] rounded-md border bg-white text-left",
          disabled ? "border-sage/60 text-text-ter cursor-not-allowed" : "border-sage text-text cursor-pointer hover:border-coral",
        ].join(" ")}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <>
              <span className="font-semibold text-ink">{selected.name}</span>
              <span className="text-text-ter font-mono text-[11px] ml-2">{selected.id}</span>
            </>
          ) : (
            <span className="text-text-ter">Select a client…</span>
          )}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            aria-label="Clear client"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="p-0.5 rounded hover:bg-sage/30 text-text-sec cursor-pointer"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+4px)] w-full bg-white rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-sage z-50 overflow-hidden">
            <div className="relative border-b border-sage/60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, contact, email…"
                className="w-full py-2 pl-9 pr-3 text-[13px] outline-none bg-transparent"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {matches.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-text-ter text-center">
                  No clients match "{query}".
                </div>
              ) : (
                matches.map((c) => {
                  const isSelected = c.id === value;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        onChange(c.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={[
                        "w-full text-left px-3 py-2 text-[13px] cursor-pointer",
                        isSelected ? "bg-coral/10 text-coral" : "text-text hover:bg-sage/20",
                      ].join(" ")}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-ink flex-1 truncate">{c.name}</span>
                        <span className="font-mono text-[11px] text-text-ter">{c.id}</span>
                      </div>
                      {c.contactName && (
                        <div className="text-[11px] text-text-sec truncate">{c.contactName}{c.email ? ` · ${c.email}` : ""}</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
