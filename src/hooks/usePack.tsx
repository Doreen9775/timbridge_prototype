import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PACK, PACKS, type IndustryPack, type PackId } from "@/lib/packs";
import { PRODUCT_PROFILES, type ProductProfile } from "@/lib/products";

// Active industry pack — which demo company the workspace shows. Persisted to
// localStorage (key `timbridge_industry_pack`) so a reload stays on the same company.
const STORAGE_KEY = "timbridge_industry_pack";

function readPack(): PackId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v in PACKS ? (v as PackId) : DEFAULT_PACK;
  } catch {
    return DEFAULT_PACK;
  }
}

interface PackContextValue {
  pack: IndustryPack;
  profile: ProductProfile; // the pack's product profile (units, quantity, pricing)
  setPackId: (id: PackId) => void;
}

const PackContext = createContext<PackContextValue | null>(null);

export function PackProvider({ children }: { children: ReactNode }) {
  const [packId, setId] = useState<PackId>(readPack);
  const setPackId = useCallback((id: PackId) => {
    setId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore — the switch still applies for this session */
    }
  }, []);
  const value = useMemo(() => {
    const pack = PACKS[packId];
    return { pack, profile: PRODUCT_PROFILES[pack.productType], setPackId };
  }, [packId, setPackId]);
  return <PackContext.Provider value={value}>{children}</PackContext.Provider>;
}

export function usePack(): PackContextValue {
  const ctx = useContext(PackContext);
  if (!ctx) throw new Error("usePack must be used within PackProvider");
  return ctx;
}
