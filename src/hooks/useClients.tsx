import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { INITIAL_CLIENTS } from "@/lib/mock-data";
import type { Client } from "@/lib/types";

// CRM store — mirrors the useLookups localStorage-backed Provider pattern. First load
// seeds from INITIAL_CLIENTS (the customer strings deduped out of the legacy salesOrders
// seed); subsequent loads read what's persisted, so edits survive page reloads.
const STORAGE_KEY = "timbridge_clients";

function load(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // One-time migration: seed and persist so future sessions read from storage.
      save(INITIAL_CLIENTS);
      return INITIAL_CLIENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_CLIENTS;
  } catch {
    return INITIAL_CLIENTS;
  }
}

function save(clients: Client[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
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
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>(load);

  const updateClient = useCallback((id: string, patch: Partial<Omit<Client, "id" | "createdAt">>) => {
    setClients((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      save(next);
      return next;
    });
  }, []);

  const value = useMemo<ClientsContextValue>(() => {
    const map = new Map(clients.map((c) => [c.id, c]));
    return {
      clients,
      clientById: map,
      getClientName: (id: string) => map.get(id)?.name ?? "Unknown",
      updateClient,
    };
  }, [clients, updateClient]);

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients(): ClientsContextValue {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used within ClientsProvider");
  return ctx;
}
