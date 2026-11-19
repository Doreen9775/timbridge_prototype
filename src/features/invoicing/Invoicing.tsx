import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileText, Link2, Plug, Send, Trash2, X } from "lucide-react";
import type { Role, SalesOrder, Tag } from "@/lib/types";
import { useFinance } from "@/hooks/useFinance";
import { useClients } from "@/hooks/useClients";
import { usePack } from "@/hooks/usePack";
import { Button } from "@/components/shared/Button";
import {
  CONNECTORS, balanceOf, billForTag, docsToCsv, invoiceCost, invoiceForTag, invoiceLines, paidOf, readyToBill, readyToInvoice, shipDateOf, statusOf, todayIso,
  type DocStatus, type FinDoc, type FinDocKind,
} from "@/lib/finance";

// Invoicing — where business events become accounting documents.
// Manager runs it: drafts, sends, bills, sync log, connection. Sales sees it read-only:
// customer invoices with their status, due dates, payments and balances (so they can
// answer "has it been invoiced?" and follow up on overdue accounts) — no actions, and
// nothing on the payables side (bills) or the accounting connection.
//   Invoices tab: shipped orders / delivered booms waiting for an invoice, then every
//                 invoice with its QuickBooks status and payments read back.
//   Bills tab:    stock received from outside sellers waiting for a bill, then bills.
//   Sync tab:     what was sent to / read from the accounting system.
// Amounts are before tax; the accounting system applies tax from each document's tax code.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
};
const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (v: number) => `$${Math.round(v).toLocaleString()}`;

const STATUS_STYLE: Record<DocStatus, string> = {
  Draft: "bg-[#F9FAF8] text-text-sec border border-dashed border-sage",
  Open: "bg-[#EEF0F2] text-[#4B5563]",
  "Partially paid": "bg-[#EAF5D0] text-[#4E6B0E]",
  Paid: "bg-[#DCE7E1] text-[#33473C]",
  Overdue: "bg-[#FCE0D7] text-[#B23A1A]",
};
function StatusPill({ status }: { status: DocStatus }) {
  return <span className={`whitespace-nowrap inline-block rounded-xl px-2.5 py-[3px] text-[11px] font-medium ${STATUS_STYLE[status]}`}>{status}</span>;
}

function download(csv: string, name: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Tab = "invoice" | "bill" | "sync";
type StatusFilter = "all" | DocStatus;

interface InvoicingProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  onOpenSo: (soId: string) => void;
  onOpenClient: (clientId: string) => void;
  onOpenSettings: () => void;
  role: Role;
  openDocId?: string | null; // deep link from an order, boom, lot or client
  onDocOpened?: () => void;
  onOpenTag?: (tagId: string) => void;
}

export function Invoicing({ tags, salesOrders, onOpenSo, onOpenClient, onOpenSettings, role, openDocId, onDocOpened, onOpenTag }: InvoicingProps) {
  const readOnly = role !== "manager";
  const finance = useFinance();
  const { clientById, getClientName } = useClients();
  const { pack } = usePack();
  const [tab, setTab] = useState<Tab>("invoice");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  // Arriving from an order / boom / lot / client: open that document on its tab.
  useEffect(() => {
    if (!openDocId) return;
    const doc = finance.docs.find((d) => d.id === openDocId);
    if (doc && (doc.kind === "invoice" || !readOnly)) {
      setTab(doc.kind);
      setStatusF("all");
      setOpenDoc(doc.id);
    }
    onDocOpened?.();
  }, [openDocId, finance.docs, onDocOpened, readOnly]);
  const today = todayIso();
  const connector = CONNECTORS.find((c) => c.id === finance.settings.connector)!;
  const sendLabel = finance.canSync ? "Send to QuickBooks" : "Export CSV";

  // ── Ready queues ────────────────────────────────────────────────────────────
  const toInvoice = useMemo(
    () =>
      readyToInvoice(salesOrders, finance.docs)
        .map((so) => ({ so, shipped: shipDateOf(so, tags), amount: invoiceLines(so, tags).reduce((s, l) => s + l.amount, 0) }))
        .sort((a, b) => a.shipped.localeCompare(b.shipped)),
    [salesOrders, finance.docs, tags],
  );
  const toBill = useMemo(() => readyToBill(tags, finance.docs), [tags, finance.docs]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const inv = finance.docs.filter((d) => d.kind === "invoice");
    const bills = finance.docs.filter((d) => d.kind === "bill");
    const sent = (d: FinDoc) => d.sync.state !== "not_sent";
    const overdue = inv.filter((d) => statusOf(d, today) === "Overdue");
    return {
      notInvoiced: toInvoice.reduce((s, r) => s + r.amount, 0),
      notInvoicedCount: toInvoice.length,
      drafts: inv.filter((d) => !sent(d)).length,
      receivable: inv.filter(sent).reduce((s, d) => s + balanceOf(d), 0),
      overdue: overdue.reduce((s, d) => s + balanceOf(d), 0),
      overdueCount: overdue.length,
      payable: bills.filter(sent).reduce((s, d) => s + balanceOf(d), 0),
    };
  }, [finance.docs, toInvoice, today]);

  const list = useMemo(
    () =>
      finance.docs
        .filter((d) => d.kind === tab)
        .filter((d) => statusF === "all" || statusOf(d, today) === statusF)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [finance.docs, tab, statusF, today],
  );
  const draftsChecked = list.filter((d) => checked.has(d.id) && d.sync.state === "not_sent");

  const sendDocs = (docs: FinDoc[]) => {
    if (docs.length === 0) return;
    if (!finance.canSync) download(docsToCsv(docs), `timbridge_${tab === "bill" ? "bills" : "invoices"}_${today}.csv`);
    finance.send(docs.map((d) => d.id));
    setChecked(new Set());
  };

  const selected = openDoc ? finance.docs.find((d) => d.id === openDoc) ?? null : null;
  const orderName = (soId: string) => {
    const so = salesOrders.find((o) => o.id === soId);
    return so?.boom ? `${so.boom.id}` : soId;
  };
  const statusTabs: StatusFilter[] = ["all", "Draft", "Open", "Partially paid", "Overdue", "Paid"];

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto" data-onboarding="invoicing-page">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>Invoicing</h1>
            <p className="text-sm text-text-sec mt-1">
              {readOnly
                ? "Customer invoices, payments and balances, kept in step with the accounting system."
                : "Turn deliveries and receipts into invoices and bills, and keep them in step with your accounting system."}{" "}
              Amounts in {finance.settings.currency}, before tax.
            </p>
          </div>
          <button
            type="button"
            onClick={readOnly ? undefined : onOpenSettings}
            disabled={readOnly}
            className={`flex items-center gap-2 bg-white border border-sage rounded-full pl-3 pr-4 py-1.5 text-[12px] ${readOnly ? "cursor-default" : "cursor-pointer hover:border-ink"}`}
            title={readOnly ? "Invoices are kept in step with this accounting system" : "Accounting settings"}
          >
            {finance.canSync ? <Link2 size={14} className="text-[#4E6B0E]" /> : <Plug size={14} className="text-text-sec" />}
            <span className="font-semibold text-ink">{connector.label}</span>
            <span className="text-text-sec">
              {connector.syncs ? (finance.settings.connected ? `Connected · ${finance.settings.companyName}` : "Not connected") : "CSV export"}
            </span>
          </button>
        </div>

        {readOnly && (
          <div className="mb-4 text-[12px] text-text-sec bg-white border border-sage rounded-lg px-4 py-2.5">
            View only — invoices are created and sent by the office. Contact a Manager to change one.
          </div>
        )}
        <div className={`grid grid-cols-2 gap-4 mb-5 ${readOnly ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          <Kpi label={`${pack.terms.shipped}, not invoiced`} value={money0(kpi.notInvoiced)} sub={`${kpi.notInvoicedCount} ${kpi.notInvoicedCount === 1 ? pack.terms.order.toLowerCase() : pack.terms.orders.toLowerCase()} · ${kpi.drafts} invoice draft${kpi.drafts === 1 ? "" : "s"} unsent`} alert={kpi.notInvoicedCount > 0} />
          <Kpi label="Open receivables" value={money0(kpi.receivable)} sub="sent invoices, unpaid balance" />
          <Kpi label="Overdue" value={money0(kpi.overdue)} sub={`${kpi.overdueCount} invoice${kpi.overdueCount === 1 ? "" : "s"} past due`} alert={kpi.overdueCount > 0} />
          {/* Payables are the company's own debts — Manager only. */}
          {!readOnly && <Kpi label="Bills to pay" value={money0(kpi.payable)} sub="sent bills, unpaid balance" />}
        </div>

        <div className="mb-5 border-b border-sage flex gap-1">
          {((readOnly ? [["invoice", "Invoices"]] : [["invoice", "Invoices"], ["bill", "Bills"], ["sync", "Sync activity"]]) as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setChecked(new Set());
                setStatusF("all");
              }}
              className={`px-4 py-2 text-[13px] cursor-pointer border-0 bg-transparent -mb-px border-b-2 ${tab === k ? "border-ink text-ink font-semibold" : "border-transparent text-text-sec hover:text-ink"}`}
            >
              {label}
              {k === "invoice" && toInvoice.length > 0 && <span className="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-coral/10 text-coral">{toInvoice.length}</span>}
              {k === "bill" && toBill.length > 0 && <span className="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-coral/10 text-coral">{toBill.length}</span>}
            </button>
          ))}
        </div>

        {tab === "sync" ? (
          <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] divide-y divide-[#F3F4F6]">
            {finance.log.length === 0 && <div className="p-10 text-center text-text-sec text-[13px]">Nothing sent yet.</div>}
            {finance.log.map((e, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-4 text-[13px]">
                <span className="text-text">{e.text}</span>
                <span className="text-text-ter text-[11px] whitespace-nowrap">{e.at}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Where each document is in the flow — the same four steps every time. */}
            <FlowStrip
              kind={tab}
              counts={(() => {
                const mine = finance.docs.filter((d) => d.kind === tab);
                return [
                  tab === "invoice" ? toInvoice.length : toBill.length,
                  mine.filter((d) => d.sync.state === "not_sent").length,
                  mine.filter((d) => d.sync.state !== "not_sent" && balanceOf(d) > 0.005).length,
                  mine.filter((d) => d.sync.state !== "not_sent" && balanceOf(d) <= 0.005).length,
                ];
              })()}
              shippedWord={pack.terms.shipped}
              auto={finance.settings.invoiceTrigger === "onDelivery"}
              system={connector.syncs ? connector.label : "CSV export"}
              onPick={(i) => setStatusF(i === 1 ? "Draft" : i === 3 ? "Paid" : "all")}
            />

            {/* Ready queue */}
            {tab === "invoice" ? (
              <ReadyCard
                title={`Ready to invoice`}
                hint={`${pack.terms.orders} ${pack.terms.shipped.toLowerCase()} with no invoice yet${finance.settings.invoiceTrigger === "onDelivery" ? " — new ones are drafted automatically on delivery" : ""}`}
                empty={`Every ${pack.terms.shipped.toLowerCase()} ${pack.terms.order.toLowerCase()} has an invoice.`}
                count={toInvoice.length}
                readOnly={readOnly}
                onCreateAll={() => finance.createInvoices(toInvoice.map((r) => ({ so: r.so, client: clientById.get(r.so.clientId) })), tags)}
                head={[pack.terms.order, "Customer", pack.terms.shipped, "Amount"]}
                rows={toInvoice.map((r) => ({
                  key: r.so.id,
                  cells: [
                    <button key="o" type="button" onClick={() => onOpenSo(r.so.id)} className="font-mono font-semibold text-ink hover:text-coral bg-transparent border-0 p-0 cursor-pointer">{orderName(r.so.id)}</button>,
                    getClientName(r.so.clientId),
                    fmtDate(r.shipped),
                    money(r.amount),
                  ],
                  action: () => finance.createInvoices([{ so: r.so, client: clientById.get(r.so.clientId) }], tags),
                }))}
                actionLabel="Create invoice"
              />
            ) : (
              <ReadyCard
                title="Ready to bill"
                hint="Stock received from outside sellers with no bill yet (in-house production has nothing to pay)"
                empty="Every receipt from a seller has a bill."
                count={toBill.length}
                readOnly={readOnly}
                onCreateAll={() => finance.createBills(toBill, tags)}
                head={["Seller", "Received", pack.terms.tags, "Amount"]}
                rows={toBill.map((rc) => ({
                  key: rc.key,
                  cells: [rc.supplier, fmtDate(rc.date), String(rc.tags.length), money(rc.amount)],
                  action: () => finance.createBills([rc], tags),
                }))}
                actionLabel="Create bill"
              />
            )}

            {/* Documents */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 mt-6">
              <div className="flex bg-white border border-sage rounded-full p-[3px] gap-[2px]">
                {statusTabs.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusF(st)}
                    className={`px-3 py-[5px] rounded-full border-0 cursor-pointer text-xs font-medium ${statusF === st ? "bg-ink text-white" : "bg-transparent text-text-sec hover:text-text"}`}
                  >
                    {st === "all" ? "All" : st}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" leftIcon={<Download size={13} />} onClick={() => download(docsToCsv(list), `timbridge_${tab === "bill" ? "bills" : "invoices"}_${today}.csv`)} disabled={list.length === 0}>
                  Export list
                </Button>
                {!readOnly && (
                  <Button size="sm" variant="primary" leftIcon={finance.canSync ? <Send size={13} /> : <Download size={13} />} disabled={draftsChecked.length === 0} onClick={() => sendDocs(draftsChecked)}>
                    {sendLabel}{draftsChecked.length > 0 ? ` (${draftsChecked.length})` : ""}
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-sage">
                      <th className="pl-3.5 pr-1 py-2.5 w-9" />
                      {[tab === "invoice" ? "Invoice" : "Bill", tab === "invoice" ? "Customer" : "Seller", "For", "Date", "Due", "Amount", "Paid", "Balance", "Status", connector.syncs ? "QuickBooks" : "Export"].map((h, i) => (
                        <th key={h} className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${i >= 5 && i <= 7 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((d, i) => {
                      const st = statusOf(d, today);
                      const draft = d.sync.state === "not_sent";
                      return (
                        <tr key={d.id} onClick={() => setOpenDoc(d.id)} className={`border-b border-[#F3F4F6] cursor-pointer ${i % 2 ? "bg-[#FAFAFA]" : ""} hover:bg-sage/20`}>
                          <td className="pl-3.5 pr-1 py-[11px]" onClick={(e) => e.stopPropagation()}>
                            {draft && !readOnly && (
                              <input
                                type="checkbox"
                                checked={checked.has(d.id)}
                                onChange={() =>
                                  setChecked((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(d.id)) next.delete(d.id);
                                    else next.add(d.id);
                                    return next;
                                  })
                                }
                                aria-label={`Select ${d.id}`}
                                className="accent-coral w-4 h-4 cursor-pointer align-middle"
                              />
                            )}
                          </td>
                          <td className="px-3.5 py-[11px] font-mono font-semibold text-ink whitespace-nowrap">{d.id}</td>
                          <td className="px-3.5 py-[11px]">{d.partyName}</td>
                          <td className="px-3.5 py-[11px] text-text-sec whitespace-nowrap">{d.kind === "invoice" ? orderName(d.sourceId) : `Received ${fmtDate(d.sourceId.split("|")[1])}`}</td>
                          <td className="px-3.5 py-[11px] text-text-sec whitespace-nowrap">{fmtDate(d.date)}</td>
                          <td className={`px-3.5 py-[11px] whitespace-nowrap ${st === "Overdue" ? "text-coral font-semibold" : "text-text-sec"}`}>{fmtDate(d.dueDate)}</td>
                          <td className="px-3.5 py-[11px] text-right tabular-nums">{money(d.subtotal)}</td>
                          <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{money(paidOf(d))}</td>
                          <td className="px-3.5 py-[11px] text-right tabular-nums font-semibold">{money(balanceOf(d))}</td>
                          <td className="px-3.5 py-[11px]"><StatusPill status={st} /></td>
                          <td className="px-3.5 py-[11px] text-[12px] whitespace-nowrap">
                            {d.sync.state === "synced" ? (
                              <span className="inline-flex items-center gap-1 text-[#4E6B0E]"><CheckCircle2 size={12} />{d.sync.externalId}</span>
                            ) : d.sync.state === "exported" ? (
                              <span className="text-text-sec">Exported</span>
                            ) : (
                              <span className="text-text-ter">Not sent</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {list.length === 0 && (
                      <tr><td colSpan={11} className="p-10 text-center text-text-sec">No {tab === "invoice" ? "invoices" : "bills"} match.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <DocDrawer
          doc={selected}
          sendLabel={sendLabel}
          canSync={finance.canSync}
          readOnly={readOnly}
          onClose={() => setOpenDoc(null)}
          onSend={() => sendDocs([selected])}
          onDelete={() => {
            finance.deleteDraft(selected.id);
            setOpenDoc(null);
          }}
          onRecordPayment={(amt) => finance.recordPayment(selected.id, amt)}
          links={
            <DocLinks
              doc={selected}
              docs={finance.docs}
              tags={tags}
              showCost={!readOnly}
              onOpenDoc={(id) => setOpenDoc(id)}
              onOpenTag={onOpenTag}
              orderName={orderName}
              onOpenSo={onOpenSo}
            />
          }
          onOpenSource={selected.kind === "invoice" ? () => onOpenSo(selected.sourceId) : undefined}
          onOpenParty={selected.partyId ? () => onOpenClient(selected.partyId!) : undefined}
          sourceLabel={selected.kind === "invoice" ? `${pack.terms.order} ${orderName(selected.sourceId)}` : `Receipt of ${fmtDate(selected.sourceId.split("|")[1])}`}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="bg-white rounded-[10px] px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
      <div className="text-[12px] text-text-sec flex items-center gap-1">
        {alert && <AlertTriangle size={12} className="text-coral" />}
        {label}
      </div>
      <div className="text-[24px] font-bold text-ink leading-tight mt-1.5 tabular-nums" style={{ fontFamily: "Montserrat, sans-serif" }}>{value}</div>
      <div className="text-[11px] text-text-ter mt-0.5">{sub}</div>
    </div>
  );
}

function ReadyCard({ title, hint, empty, count, head, rows, actionLabel, onCreateAll, readOnly }: {
  readOnly?: boolean;
  title: string;
  hint: string;
  empty: string;
  count: number;
  head: string[];
  rows: { key: string; cells: React.ReactNode[]; action: () => void }[];
  actionLabel: string;
  onCreateAll: () => void;
}) {
  return (
    <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-display font-semibold text-text flex items-center gap-2">
            {title}
            {count > 0 && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-coral/10 text-coral">{count}</span>}
          </div>
          <div className="text-[11px] text-text-ter mt-0.5">{hint}</div>
        </div>
        {count > 1 && !readOnly && <Button size="sm" variant="primary" leftIcon={<FileText size={13} />} onClick={onCreateAll}>{actionLabel.replace("Create", "Create all")}s</Button>}
      </div>
      {count === 0 ? (
        <div className="px-5 pb-5 text-[13px] text-text-ter flex items-center gap-2"><CheckCircle2 size={14} className="text-[#4E6B0E]" />{empty}</div>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-sage bg-[#F9FAFB]">
              {head.map((h, i) => <th key={h} className={`px-5 py-2 text-text-sec font-medium text-xs ${i === head.length - 1 ? "text-right" : "text-left"}`}>{h}</th>)}
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[#F3F4F6] last:border-0">
                {r.cells.map((c, i) => <td key={i} className={`px-5 py-2.5 ${i === r.cells.length - 1 ? "text-right tabular-nums font-semibold" : ""}`}>{c}</td>)}
                {!readOnly && <td className="px-5 py-2.5 text-right"><Button size="sm" onClick={r.action}>{actionLabel}</Button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DocDrawer({ doc, sendLabel, canSync, readOnly, sourceLabel, onClose, onSend, onDelete, onRecordPayment, onOpenSource, onOpenParty, links }: {
  links?: React.ReactNode;
  doc: FinDoc;
  sendLabel: string;
  canSync: boolean;
  readOnly: boolean;
  sourceLabel: string;
  onClose: () => void;
  onSend: () => void;
  onDelete: () => void;
  onRecordPayment: (amount: number) => void;
  onOpenSource?: () => void;
  onOpenParty?: () => void;
}) {
  const today = todayIso();
  const st = statusOf(doc, today);
  const bal = balanceOf(doc);
  const kindLabel: Record<FinDocKind, string> = { invoice: "Invoice", bill: "Bill" };
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <div className="w-full max-w-[560px] h-full bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${kindLabel[doc.kind]} ${doc.id}`}>
        <div className="px-5 pt-5 pb-4 border-b border-sage flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-bold text-ink">{doc.id}</span>
              <StatusPill status={st} />
            </div>
            {onOpenParty ? (
              <button type="button" onClick={onOpenParty} className="mt-1 text-[13px] text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer">{doc.partyName}</button>
            ) : (
              <div className="mt-1 text-[13px] text-text">{doc.partyName}</div>
            )}
            {onOpenSource ? (
              <button type="button" onClick={onOpenSource} className="block text-[11px] text-text-ter hover:text-coral bg-transparent border-0 p-0 cursor-pointer mt-0.5">{sourceLabel}</button>
            ) : (
              <div className="text-[11px] text-text-ter mt-0.5">{sourceLabel}</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2 text-[13px]">
            <Info label="Date" value={fmtDate(doc.date)} />
            <Info label="Terms" value={doc.terms} />
            <Info label="Due" value={fmtDate(doc.dueDate)} alert={st === "Overdue"} />
          </div>

          <div>
            <div className="text-xs text-text-sec mb-2">Lines</div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-sage text-text-sec">
                  <th className="text-left font-medium py-1.5">Description</th>
                  <th className="text-right font-medium py-1.5">Qty</th>
                  <th className="text-right font-medium py-1.5">Rate</th>
                  <th className="text-right font-medium py-1.5">Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6]">
                    <td className="py-1.5 pr-2">{l.description}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{l.qty.toLocaleString()} {l.unit}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{money(l.unitPrice)}{l.discountPct ? ` −${l.discountPct}%` : ""}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-ink">
                  <td className="pt-2" colSpan={3}>Subtotal ({doc.currency})</td>
                  <td className="pt-2 text-right tabular-nums">{money(doc.subtotal)}</td>
                </tr>
                <tr className="text-text-sec">
                  <td className="pt-1" colSpan={4}>Tax code {doc.taxCode} — tax is calculated by the accounting system.</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {links}

          <div>
            <div className="text-xs text-text-sec mb-2">Accounting system</div>
            <div className="bg-[#F9FAFB] rounded-md px-3 py-2.5 text-[13px]">
              {doc.sync.state === "synced" && <span className="inline-flex items-center gap-1.5 text-[#4E6B0E]"><CheckCircle2 size={14} />In QuickBooks as {doc.sync.externalId} · sent {doc.sync.at}</span>}
              {doc.sync.state === "exported" && <span className="text-text-sec">Exported to CSV · {doc.sync.at}</span>}
              {doc.sync.state === "not_sent" && <span className="text-text-sec">Draft — not sent yet. Edits happen in the order; once sent, changes are made in the accounting system.</span>}
            </div>
          </div>

          <div>
            <div className="text-xs text-text-sec mb-2">Payments{canSync ? " (read from QuickBooks)" : ""}</div>
            {doc.payments.length === 0 ? (
              <div className="text-[13px] text-text-ter">No payments recorded.</div>
            ) : (
              <div className="space-y-1.5">
                {doc.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <span>{fmtDate(p.date)} <span className="text-text-ter text-[11px]">· {p.ref}</span></span>
                    <span className="tabular-nums font-semibold">{money(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-[13px] mt-3 pt-2 border-t border-[#F3F4F6]">
              <span className="text-text-sec">Balance</span>
              <span className="tabular-nums font-bold text-ink">{money(bal)}</span>
            </div>
          </div>

          {!readOnly && <div className="flex flex-wrap gap-2 border-t border-sage pt-4">
            {doc.sync.state === "not_sent" && (
              <>
                <Button variant="primary" leftIcon={canSync ? <Send size={14} /> : <Download size={14} />} onClick={onSend}>{sendLabel}</Button>
                <Button variant="destructive" leftIcon={<Trash2 size={14} />} onClick={onDelete}>Delete draft</Button>
              </>
            )}
            {doc.sync.state === "synced" && bal > 0 && (
              <Button onClick={() => onRecordPayment(bal)} title="Prototype only — stands in for a payment entered in QuickBooks and read back">
                Simulate payment in QuickBooks
              </Button>
            )}
          </div>}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-[#F9FAFB] rounded-md px-3 py-2">
      <div className="text-[10px] text-text-ter mb-0.5">{label}</div>
      <div className={`font-medium ${alert ? "text-coral" : "text-text"}`}>{value}</div>
    </div>
  );
}

// The four steps every invoice (or bill) goes through, with how many sit at each.
function FlowStrip({ kind, counts, shippedWord, auto, system, onPick }: {
  kind: "invoice" | "bill" | "sync";
  counts: number[];
  shippedWord: string;
  auto: boolean;
  system: string;
  onPick: (step: number) => void;
}) {
  const steps =
    kind === "bill"
      ? ["Stock received", "Bill drafted", `Sent to ${system}`, "Paid"]
      : [`Order ${shippedWord.toLowerCase()}`, "Invoice drafted", `Sent to ${system}`, "Paid"];
  const note =
    kind === "bill"
      ? "A bill is due when stock from an outside seller is received. Drafts follow the lots' cost until they are sent."
      : auto
        ? `An invoice is drafted automatically the moment an order is marked ${shippedWord}. Drafts follow the order until they are sent; after that ${system} owns them.`
        : `${shippedWord} orders wait in Ready to invoice until someone creates the invoice. Drafts follow the order until they are sent.`;
  return (
    <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] px-5 py-4 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPick(i)}
              className="flex items-center gap-2 bg-[#F9FAFB] hover:bg-sage/20 border border-sage/60 rounded-full pl-1.5 pr-3 py-1 cursor-pointer"
            >
              <span className={`min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-semibold flex items-center justify-center ${counts[i] > 0 && i < 2 ? "bg-coral text-white" : "bg-white text-text-sec border border-sage"}`}>{counts[i]}</span>
              <span className="text-[12px] text-ink font-medium">{label}</span>
            </button>
            {i < steps.length - 1 && <ArrowRight size={13} className="text-text-ter" />}
          </div>
        ))}
      </div>
      <div className="text-[11px] text-text-ter mt-2">{note}</div>
    </div>
  );
}

// Everything a document is connected to: its lots, and across the AR/AP line —
// an invoice's lots were bought on bills (their cost gives the margin); a bill's lots
// were sold on invoices or are still in stock.
function DocLinks({ doc, docs, tags, showCost, onOpenDoc, onOpenTag, orderName, onOpenSo }: {
  doc: FinDoc;
  docs: FinDoc[];
  tags: Tag[];
  showCost: boolean;
  onOpenDoc: (id: string) => void;
  onOpenTag?: (id: string) => void;
  orderName: (soId: string) => string;
  onOpenSo: (soId: string) => void;
}) {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const lotIds = Array.from(new Set(doc.lines.flatMap((l) => l.tagIds)));
  const chip = (id: string, onClick?: () => void) => (
    <button key={id} type="button" onClick={onClick} disabled={!onClick} className="font-mono text-[12px] font-semibold text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer disabled:text-ink disabled:cursor-default">
      {id}
    </button>
  );

  if (doc.kind === "invoice") {
    const bills = Array.from(new Set(lotIds.map((id) => tagById.get(id)).filter((t): t is Tag => !!t).map((t) => billForTag(docs, t)).filter((b): b is FinDoc => !!b)));
    const cost = invoiceCost(doc, tags);
    return (
      <div>
        <div className="text-xs text-text-sec mb-2">Linked records</div>
        <div className="bg-[#F9FAFB] rounded-md px-3 py-2.5 text-[13px] space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-text-sec w-24 shrink-0">Order</span>{chip(orderName(doc.sourceId), () => onOpenSo(doc.sourceId))}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-text-sec w-24 shrink-0">Lots shipped</span>{lotIds.map((id) => chip(id, onOpenTag ? () => onOpenTag(id) : undefined))}</div>
          {showCost && (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-text-sec w-24 shrink-0">Bought on</span>
                {bills.length ? bills.map((b) => chip(b.id, () => onOpenDoc(b.id))) : <span className="text-text-ter">no bill — in-house production or no cost on file</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-text-sec w-24 shrink-0">Margin</span>
                {cost === null ? (
                  <span className="text-text-ter">unknown — a lot has no cost on file</span>
                ) : (
                  <span className="text-ink">{money(doc.subtotal - cost)} <span className="text-text-sec">({doc.subtotal > 0 ? Math.round(((doc.subtotal - cost) / doc.subtotal) * 1000) / 10 : 0}%) · cost {money(cost)}</span></span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-text-sec mb-2">Where these lots are now</div>
      <div className="bg-[#F9FAFB] rounded-md px-3 py-2 text-[13px] divide-y divide-[#ECEAE7]">
        {lotIds.map((id) => {
          const t = tagById.get(id);
          const inv = invoiceForTag(docs, id);
          return (
            <div key={id} className="flex flex-wrap items-center gap-2 py-1.5">
              {chip(id, onOpenTag ? () => onOpenTag(id) : undefined)}
              <span className="text-text-sec">{t ? t.status : "—"}</span>
              <span className="flex-1" />
              {inv ? <span className="text-text-sec">sold on {chip(inv.id, () => onOpenDoc(inv.id))}</span> : <span className="text-text-ter">{t?.status === "Shipped" ? "shipped, not invoiced yet" : "not sold yet"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
