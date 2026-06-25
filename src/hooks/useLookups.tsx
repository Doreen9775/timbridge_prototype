import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LOOKUP_TABLE_LABELS, SYSTEM_DEFAULTS, type LookupTable, type LookupValue } from "@/lib/lookups";

// Custom lookup values store (Settings → Custom Values). Mirrors the useRecentRecords
// localStorage+context pattern. Only user-added entries are persisted — system defaults
// are hardcoded (src/lib/lookups.ts) and are never written to storage.
const STORAGE_KEY = "timbridge_custom_lookups";
const MAX_CUSTOM_PER_TABLE = 50;

type CustomStore = Record<LookupTable, LookupValue[]>;

const EMPTY_STORE: CustomStore = { species: [], grades: [], states: [], milling: [], locations: [] };

function load(): CustomStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STORE, ...parsed };
  } catch {
    return EMPTY_STORE;
  }
}

function save(store: CustomStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors (private mode / quota)
  }
}

// System defaults merged with stored custom values, deduped by code (case-insensitive) —
// system default wins on conflict.
function merge(table: LookupTable, custom: LookupValue[]): LookupValue[] {
  const systemCodes = new Set(SYSTEM_DEFAULTS[table].map((v) => v.code.toLowerCase()));
  return [...SYSTEM_DEFAULTS[table], ...custom.filter((v) => !systemCodes.has(v.code.toLowerCase()))];
}

type AddResult = { ok: true } | { ok: false; error: string };

interface LookupsContextValue {
  species: LookupValue[];
  grades: LookupValue[];
  states: LookupValue[];
  milling: LookupValue[];
  locations: LookupValue[];
  addValue: (table: LookupTable, code: string, label: string) => AddResult;
  deleteValue: (table: LookupTable, code: string) => void;
}

const LookupsContext = createContext<LookupsContextValue | null>(null);

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<CustomStore>(load);

  const addValue = useCallback((table: LookupTable, code: string, label: string): AddResult => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return { ok: false, error: "Code cannot be empty." };

    const merged = merge(table, custom[table]);
    if (merged.some((v) => v.code.toLowerCase() === trimmedCode.toLowerCase())) {
      return { ok: false, error: `"${trimmedCode}" already exists in ${LOOKUP_TABLE_LABELS[table]}.` };
    }
    if (custom[table].length >= MAX_CUSTOM_PER_TABLE) {
      return { ok: false, error: `${LOOKUP_TABLE_LABELS[table]} already has the maximum of ${MAX_CUSTOM_PER_TABLE} custom values.` };
    }

    setCustom((prev) => {
      const next = { ...prev, [table]: [...prev[table], { code: trimmedCode, label: label.trim() || trimmedCode, isSystem: false }] };
      save(next);
      return next;
    });
    return { ok: true };
  }, [custom]);

  const deleteValue = useCallback((table: LookupTable, code: string) => {
    setCustom((prev) => {
      const next = { ...prev, [table]: prev[table].filter((v) => v.code !== code) };
      save(next);
      return next;
    });
  }, []);

  const value = useMemo<LookupsContextValue>(() => ({
    species: merge("species", custom.species),
    grades: merge("grades", custom.grades),
    states: merge("states", custom.states),
    milling: merge("milling", custom.milling),
    locations: merge("locations", custom.locations),
    addValue,
    deleteValue,
  }), [custom, addValue, deleteValue]);

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>;
}

export function useLookups(): LookupsContextValue {
  const ctx = useContext(LookupsContext);
  if (!ctx) throw new Error("useLookups must be used within LookupsProvider");
  return ctx;
}
