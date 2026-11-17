import { useState } from "react";
import { Trash2, Plus, Compass, Check } from "lucide-react";
import { usePack } from "@/hooks/usePack";
import { PACKS, type PackId } from "@/lib/packs";
import { LOOKUP_TABLE_LABELS, type LookupTable } from "@/lib/lookups";
import { useLookups } from "@/hooks/useLookups";

const TABLES: LookupTable[] = ["species", "grades", "states", "milling", "locations"];

export function CustomValuesSettings({ onStartTour }: { onStartTour: () => void }) {
  const lookups = useLookups();
  const { pack, setPackId } = usePack();

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[800px] mx-auto">
        <div className="mb-1 text-xl font-display font-bold text-ink">Industry pack</div>
        <div className="text-[13px] text-text-sec mb-4">
          Sets the product type, units, wording and modules for this workspace. In the prototype each pack opens its own demo company.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8" role="radiogroup" aria-label="Industry pack" data-onboarding="settings-pack">
          {(Object.keys(PACKS) as PackId[]).map((id) => {
            const p = PACKS[id];
            const on = p.id === pack.id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && setPackId(id)}
                className={[
                  "text-left rounded-xl p-4 border-2 transition-colors",
                  on ? "border-ink bg-white cursor-default" : "border-transparent bg-white/70 hover:border-sage cursor-pointer",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{p.label}</span>
                  {on && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4E6B0E] bg-[#EAF5D0] rounded-full px-2 py-0.5">
                      <Check size={11} />Active
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-text-sec mt-1">{p.description}</div>
                <div className="text-[11px] text-text-ter mt-2">Demo company: {p.company}</div>
              </button>
            );
          })}
        </div>

        <div className="mb-1 text-xl font-display font-bold text-ink">Custom Values</div>
        <div className="text-[13px] text-text-sec mb-6">
          Add custom values for the lookup fields used in Tag Entry and Stock Locator. System defaults can't be removed.
        </div>

        <div className="bg-white rounded-xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.07)] mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold text-ink mb-0.5">New here?</div>
            <div className="text-[13px] text-text-sec">Take a quick guided tour of the Manager workflow.</div>
          </div>
          <button
            onClick={onStartTour}
            className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-medium cursor-pointer hover:brightness-110 border-0"
          >
            <Compass size={15} />Take a tour
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {TABLES.map((table) => (
            <LookupSection key={table} table={table} values={lookups[table]} onAdd={lookups.addValue} onDelete={lookups.deleteValue} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LookupSection({
  table,
  values,
  onAdd,
  onDelete,
}: {
  table: LookupTable;
  values: { code: string; label: string; isSystem: boolean }[];
  onAdd: (table: LookupTable, code: string, label: string) => { ok: true } | { ok: false; error: string };
  onDelete: (table: LookupTable, code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const result = onAdd(table, code, label);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode("");
    setLabel("");
    setError(null);
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
      <div className="text-sm font-semibold text-ink mb-3">{LOOKUP_TABLE_LABELS[table]}</div>

      <div className="flex flex-col gap-1.5 mb-4">
        {values.length === 0 && (
          <div className="text-[13px] text-text-ter px-3 py-2">No values yet — add one below.</div>
        )}
        {values.map((v) => (
          <div key={v.code} className="flex items-center gap-3 bg-[#F9FAFB] rounded-md px-3 py-2">
            <span className="font-mono text-[13px] font-semibold text-text w-28 truncate">{v.code}</span>
            <span className="flex-1 text-[13px] text-text-sec truncate">{v.label}</span>
            {v.isSystem && (
              <span className="bg-[#E5E7EB] text-text-sec text-[10px] font-medium px-2 py-[3px] rounded-xl whitespace-nowrap">System</span>
            )}
            <button
              onClick={() => !v.isSystem && onDelete(table, v.code)}
              disabled={v.isSystem}
              aria-label={`Delete ${v.code}`}
              title={v.isSystem ? "System defaults can't be deleted" : "Delete"}
              className={[
                "p-1.5 rounded-md border-0 bg-transparent",
                v.isSystem ? "text-text-ter/50 cursor-not-allowed" : "text-text-sec cursor-pointer hover:text-coral",
              ].join(" ")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <div className="text-[10px] text-text-ter mb-1">Code</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. YC"
            className="w-full border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral"
          />
        </div>
        <div className="flex-[2]">
          <div className="text-[10px] text-text-ter mb-1">Label / Description</div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Yellow Cedar"
            className="w-full border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral"
          />
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 px-3.5 py-1.5 text-[13px] rounded-md bg-coral text-white font-semibold cursor-pointer hover:brightness-95 whitespace-nowrap"
        >
          <Plus size={14} />Add
        </button>
      </div>
      {error && <div className="text-[12px] text-coral mt-2">{error}</div>}
    </div>
  );
}
