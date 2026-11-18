import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Client, SalesOrder, Tag } from "@/lib/types";
import type { IndustryPack } from "@/lib/packs";
import {
  CONNECTORS, DEFAULT_ACCOUNTING, buildBill, buildInvoice, nextDocId, todayIso,
  type AccountingSettings, type FinDoc, type Receipt, type SyncLogEntry,
} from "@/lib/finance";
import { buildFinanceSeed } from "@/lib/finance-seed";

// Finance store — invoices, bills, the sync log and the accounting connection.
// Documents live in memory and reset on reload like orders and tags (they are seeded
// from the pack's history); accounting settings persist per pack in localStorage
// (key `timbridge_accounting_<pack id>`), like other configuration.
//
// QuickBooks is mocked: "sending" assigns a QuickBooks id and logs it; payments are
// seeded, and a prototype-only action records one as if it had been entered in
// QuickBooks. A real connector would replace exactly those calls.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function loadSettings(key: string, company: string): AccountingSettings {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...DEFAULT_ACCOUNTING, companyName: company, ...JSON.parse(raw) };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_ACCOUNTING, companyName: company };
}

export interface FinanceStore {
  docs: FinDoc[];
  log: SyncLogEntry[];
  settings: AccountingSettings;
  // Customers QuickBooks already has (mock): the pack's seed clients plus any created by a sync.
  knownCustomers: Set<string>;
  canSync: boolean; // a two-way connector is selected and connected
  createInvoices: (items: { so: SalesOrder; client: Client | undefined }[], tags: Tag[]) => FinDoc[];
  createBills: (rcs: Receipt[], tags: Tag[]) => FinDoc[];
  deleteDraft: (id: string) => void;
  send: (ids: string[]) => void; // to the accounting system, or mark exported when CSV-only
  recordPayment: (id: string, amount: number) => void; // prototype stand-in for a payment entered in QuickBooks
  updateSettings: (patch: Partial<AccountingSettings>) => void;
}

export function useFinanceStore(pack: IndustryPack, seed: { tags: Tag[]; salesOrders: SalesOrder[]; clients: Client[] }): FinanceStore {
  const settingsKey = `timbridge_accounting_${pack.id}`;
  const [settings, setSettings] = useState<AccountingSettings>(() => loadSettings(settingsKey, pack.company));
  const [initial] = useState(() => buildFinanceSeed(seed.tags, seed.salesOrders, seed.clients, loadSettings(settingsKey, pack.company)));
  const [docs, setDocs] = useState<FinDoc[]>(initial.docs);
  const [log, setLog] = useState<SyncLogEntry[]>(initial.log);
  const [knownCustomers, setKnownCustomers] = useState<Set<string>>(() => new Set(seed.clients.map((c) => c.id)));

  const connector = CONNECTORS.find((c) => c.id === settings.connector);
  const canSync = !!connector?.syncs && settings.connected;

  const addLog = useCallback((text: string) => setLog((prev) => [{ at: nowStamp(), text }, ...prev].slice(0, 60)), []);

  // Send documents out. With QuickBooks connected each gets a QuickBooks id (and a
  // missing customer is created first); CSV-only marks them exported — the caller
  // downloads the file.
  const sendDocs = useCallback(
    (targets: FinDoc[], current: AccountingSettings) => {
      const conn = CONNECTORS.find((c) => c.id === current.connector);
      const syncing = !!conn?.syncs && current.connected;
      const ids = new Set(targets.filter((d) => d.sync.state === "not_sent").map((d) => d.id));
      if (ids.size === 0) return;
      const at = nowStamp();
      setDocs((prev) => {
        let n = prev.reduce((m, d) => Math.max(m, Number(d.sync.externalId?.match(/(\d+)$/)?.[1] ?? 0)), 4100);
        return prev.map((d) => {
          if (!ids.has(d.id)) return d;
          n += 1;
          return syncing
            ? { ...d, sync: { state: "synced", externalId: `QB-${d.kind === "bill" ? "B" : ""}${n}`, at } }
            : { ...d, sync: { state: "exported", at } };
        });
      });
      if (syncing) {
        const newCustomers = targets.filter((d) => d.kind === "invoice" && d.partyId && !knownCustomers.has(d.partyId));
        if (newCustomers.length) {
          setKnownCustomers((prev) => new Set([...prev, ...newCustomers.map((d) => d.partyId!)]));
          newCustomers.forEach((d) => addLog(`Created customer "${d.partyName}" in QuickBooks`));
        }
        targets.filter((d) => ids.has(d.id)).forEach((d) => addLog(`Sent ${d.id} to QuickBooks (${d.partyName}, $${d.subtotal.toLocaleString()})`));
      } else {
        addLog(`Exported ${ids.size} document${ids.size === 1 ? "" : "s"} to CSV`);
      }
    },
    [addLog, knownCustomers],
  );

  // Draft documents from events. Built against the current list in one pass so a batch
  // gets consecutive numbers; an order or receipt that already has a document is skipped.
  const createInvoices = useCallback(
    (items: { so: SalesOrder; client: Client | undefined }[], tags: Tag[]) => {
      const created: FinDoc[] = [];
      let pool = docs;
      for (const { so, client } of items) {
        if (pool.some((d) => d.kind === "invoice" && d.sourceId === so.id)) continue;
        const doc = buildInvoice(so, tags, client, nextDocId(pool, "invoice"), settings);
        created.push(doc);
        pool = [...pool, doc];
      }
      if (created.length === 0) return created;
      setDocs((prev) => [...prev, ...created.filter((c) => !prev.some((d) => d.id === c.id))]);
      created.forEach((d) => addLog(`Drafted ${d.id} for ${items.find((it) => it.so.id === d.sourceId)?.so.boom ? `boom ${items.find((it) => it.so.id === d.sourceId)!.so.boom!.id}` : d.sourceId} (${d.partyName})`));
      if (settings.autoSend && canSync) sendDocs(created, settings);
      return created;
    },
    [docs, settings, canSync, addLog, sendDocs],
  );

  const createBills = useCallback(
    (rcs: Receipt[], tags: Tag[]) => {
      const created: FinDoc[] = [];
      let pool = docs;
      for (const rc of rcs) {
        if (pool.some((d) => d.kind === "bill" && d.sourceId === rc.key)) continue;
        const doc = buildBill(rc, tags, nextDocId(pool, "bill"), settings);
        created.push(doc);
        pool = [...pool, doc];
      }
      if (created.length === 0) return created;
      setDocs((prev) => [...prev, ...created.filter((c) => !prev.some((d) => d.id === c.id))]);
      created.forEach((d) => addLog(`Drafted ${d.id} for ${d.partyName}`));
      if (settings.autoSend && canSync) sendDocs(created, settings);
      return created;
    },
    [docs, settings, canSync, addLog, sendDocs],
  );

  const deleteDraft = useCallback(
    (id: string) => {
      setDocs((prev) => prev.filter((d) => !(d.id === id && d.sync.state === "not_sent")));
      addLog(`Deleted draft ${id}`);
    },
    [addLog],
  );

  const send = useCallback((ids: string[]) => sendDocs(docs.filter((d) => ids.includes(d.id)), settings), [docs, settings, sendDocs]);

  const recordPayment = useCallback(
    (id: string, amount: number) => {
      const iso = todayIso();
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, payments: [...d.payments, { date: iso, amount, ref: `QB-PMT-${Date.now() % 100000}` }] } : d)));
      const doc = docs.find((d) => d.id === id);
      addLog(`${doc?.kind === "bill" ? "Bill payment" : "Payment"} of $${amount.toLocaleString()} recorded in QuickBooks for ${id}`);
    },
    [docs, addLog],
  );

  const updateSettings = useCallback(
    (patch: Partial<AccountingSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(settingsKey, JSON.stringify(next));
        } catch {
          /* ignore — applies for this session */
        }
        return next;
      });
      if (patch.connected === true) addLog(`Connected to QuickBooks Online (${pack.company})`);
      if (patch.connected === false) addLog("Disconnected from QuickBooks Online");
    },
    [settingsKey, addLog, pack.company],
  );

  return useMemo(
    () => ({ docs, log, settings, knownCustomers, canSync, createInvoices, createBills, deleteDraft, send, recordPayment, updateSettings }),
    [docs, log, settings, knownCustomers, canSync, createInvoices, createBills, deleteDraft, send, recordPayment, updateSettings],
  );
}

const FinanceContext = createContext<FinanceStore | null>(null);

export function FinanceProvider({ value, children }: { value: FinanceStore; children: ReactNode }) {
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceStore {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
