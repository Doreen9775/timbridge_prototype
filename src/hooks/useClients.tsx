import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Client } from "@/lib/types";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS_SHORT[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// CRM store — mirrors the useLookups localStorage-backed Provider pattern. First load
// seeds from INITIAL_CLIENTS (the customer strings deduped out of the legacy salesOrders
// seed); subsequent loads read what's persisted, so edits survive page reloads.
//
// The key is versioned: because load() persists the seed once and then never reconciles
// it, a device that first loaded the app under an older INITIAL_CLIENTS shape would stay
// stuck with stale records (e.g. missing territory/contact). Bump this suffix whenever the
// seed shape changes so every device re-seeds from the current INITIAL_CLIENTS. Prototype
// tradeoff: bumping drops clients created via "New Client" on that device.
// The key and seed now come from the active industry pack (lib/packs.ts
// `clientsStorageKey`, e.g. "timbridge_clients_v3"), so each demo company keeps its own CRM.

function load(key: string, seed: Client[]): Client[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // One-time migration: seed and persist so future sessions read from storage.
      save(key, seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seed;
  } catch {
    return seed;
  }
}

function save(key: string, clients: Client[]) {
  try {
    localStorage.setItem(key, JSON.stringify(clients));
  } catch {
    // ignore storage errors (private mode / quota)
  }
}

interface ClientsContextValue {
  clients: Client[];
  clientById: Map<string, Client>;
  // Convenience resolver — never throws; returns a fallback name for orphan FKs so the
  // UI doesn't blank out if a client is edited/deleted while an SO still references it.
  getClientName: (id: string) => string;
  updateClient: (id: string, patch: Partial<Omit<Client, "id" | "createdAt">>) => void;
  // Mints a new client id + createdAt. Returns the id so callers can deep-link/open the drawer.
  createClient: (draft: Omit<Client, "id" | "createdAt">) => string;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function ClientsProvider({ children, seed, storageKey }: { children: ReactNode; seed: Client[]; storageKey: string }) {
  const [clients, setClients] = useState<Client[]>(() => load(storageKey, seed));

  const updateClient = useCallback((id: string, patch: Partial<Omit<Client, "id" | "createdAt">>) => {
    setClients((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      save(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const createClient = useCallback((draft: Omit<Client, "id" | "createdAt">): string => {
    let newId = "";
    setClients((prev) => {
      // Numeric-suffix id, gap-tolerant: max existing numeric suffix + 1. Handles the
      // legacy "C-0001..C-0003" seed and any prior deletions without id collision.
      const maxN = prev.reduce((m, c) => {
        const n = Number(c.id.replace(/^C-/, ""));
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      newId = `C-${String(maxN + 1).padStart(4, "0")}`;
      const next = [...prev, { ...draft, id: newId, createdAt: nowStamp() }];
      save(storageKey, next);
      return next;
    });
    return newId;
  }, [storageKey]);

  const value = useMemo<ClientsContextValue>(() => {
    const map = new Map(clients.map((c) => [c.id, c]));
    return {
      clients,
      clientById: map,
      getClientName: (id: string) => map.get(id)?.name ?? "Unknown",
      updateClient,
      createClient,
    };
  }, [clients, updateClient, createClient]);

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients(): ClientsContextValue {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used within ClientsProvider");
  return ctx;
}
