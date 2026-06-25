import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { LOOKUP_TABLE_LABELS, type LookupTable } from "@/lib/lookups";
import { useLookups } from "@/hooks/useLookups";

const TABLES: LookupTable[] = ["species", "grades", "states", "milling", "locations"];

export function CustomValuesSettings() {
  const lookups = useLookups();

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[800px] mx-auto">
        <div className="mb-1 text-xl font-display font-bold text-ink">Custom Values</div>
        <div className="text-[13px] text-text-sec mb-6">
          Add custom values for the lookup fields used in Tag Entry and Stock Locator. System defaults can't be removed.
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
