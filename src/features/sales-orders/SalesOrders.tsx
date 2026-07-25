import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import type { SalesOrder, SalesOrderFilter, SalesOrderStatus, Tag } from "@/lib/types";
import { PillFilter } from "@/features/stock-locator/filters";
import { Pagination, DEFAULT_PAGE_SIZE, usePagedSlice } from "@/components/shared/Pagination";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/shared/Button";
import { SalesOrderPanel, type DraftLineItem } from "./SalesOrderPanel";
import type { ApprovalDraft } from "@/features/approvals/RequestApprovalForm";
import { useClients } from "@/hooks/useClients";

const STATUS_OPTIONS: SalesOrderStatus[] = ["Open", "Picked", "Shipped", "Cancelled"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUSD(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Extended (net) line value including any per-line discount.
function lineExtended(li: { qty: number; unitPrice: number; discountPct?: number }): number {
  return li.qty * li.unitPrice * (1 - (li.discountPct ?? 0) / 100);
}

interface SalesOrdersProps {
  salesOrders: SalesOrder[];
  tags: Tag[];
  openSoId?: string | null;
  onSoOpened?: () => void;
  salesFilter?: SalesOrderFilter | null;
  onClearSalesFilter?: () => void;
  onAdvanceStatus: (soId: string, next: SalesOrderStatus) => void;
  onUpdateSalesOrder: (so: SalesOrder) => void;
  onConfirmDraft: (soId: string, lineItems: DraftLineItem[]) => { ok: true } | { ok: false; unavailableIds: string[] };
  onOpenTag: (id: string) => void;
  onOpenClient: (id: string) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}

export function SalesOrders({ salesOrders, tags, openSoId, onSoOpened, salesFilter, onClearSalesFilter, onAdvanceStatus, onUpdateSalesOrder, onConfirmDraft, onOpenTag, onOpenClient, onCreateApproval, requesterIdentity }: SalesOrdersProps) {
  const { clientById, getClientName } = useClients();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<string[]>([]);
  const [customerF, setCustomerF] = useState<string[]>([]);
  const [speciesF, setSpeciesF] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const openSo = useCallback((id: string) => {
    setSelected(id);
    setFullscreen(false);
  }, []);
  const closeDrawer = useCallback(() => {
    setSelected(null);
    setFullscreen(false);
  }, []);

  // Deep-link entry point (Stock Locator's Linked Transactions → this page).
  useEffect(() => {
    if (openSoId) {
      openSo(openSoId);
      onSoOpened?.();
    }
  }, [openSoId, openSo, onSoOpened]);

  // Filter is by resolved client name (matches the PillFilter's plain-string API).
  // Trade-off: if a client is renamed the pill list updates naturally on next render.
  const customerOpts = useMemo(
    () => Array.from(new Set(salesOrders.map((so) => getClientName(so.clientId)))).sort(),
    [salesOrders, getClientName],
  );

  // Species an SO touches, via its line-item tags (an SO has no species of its own).
  // Memoized as a per-SO Set so both the options list and the filter predicate share it.
  const speciesBySo = useMemo(() => {
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const map = new Map<string, Set<string>>();
    for (const so of salesOrders) {
      const set = new Set<string>();
      for (const li of so.lineItems) {
        const sp = tagById.get(li.tagId)?.species;
        if (sp) set.add(sp);
      }
      map.set(so.id, set);
    }
    return map;
  }, [salesOrders, tags]);

  // Options = only species that appear on at least one order (mirrors the Customer
  // filter's "derive from data" approach — every option yields ≥1 result).
  const speciesOpts = useMemo(
    () => Array.from(new Set([...speciesBySo.values()].flatMap((s) => [...s]))).sort(),
    [speciesBySo],
  );

  // Deep-link entry point (Pulse species-velocity drill-through): apply the incoming
  // species + status filter once, then consume-and-clear it in App (same one-shot
  // pattern as Stock Locator's entryFilter — navigating away and back won't re-apply).
  useEffect(() => {
    if (!salesFilter) return;
    if (salesFilter.species) setSpeciesF(salesFilter.species);
    if (salesFilter.status) setStatusF(salesFilter.status);
    onClearSalesFilter?.();
  }, [salesFilter, onClearSalesFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return salesOrders.filter((so) => {
      if (statusF.length && !statusF.includes(so.status)) return false;
      if (customerF.length && !customerF.includes(getClientName(so.clientId))) return false;
      if (speciesF.length) {
        const soSpecies = speciesBySo.get(so.id);
        if (!soSpecies || !speciesF.some((sp) => soSpecies.has(sp))) return false;
      }
      if (q) {
        const hay = [so.id, getClientName(so.clientId), so.status].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [salesOrders, search, statusF, customerF, speciesF, speciesBySo, getClientName]);

  useEffect(() => {
    setPage(1);
  }, [search, statusF, customerF, speciesF, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageRows = usePagedSlice(filtered, page, pageSize);

  const filtersActive = search.trim().length > 0 || statusF.length > 0 || customerF.length > 0 || speciesF.length > 0;
  const resetFilters = () => {
    setSearch("");
    setStatusF([]);
    setCustomerF([]);
    setSpeciesF([]);
  };

  const selectedSo = selected ? salesOrders.find((so) => so.id === selected) ?? null : null;

  const handleOpenTag = (id: string) => {
    onOpenTag(id);
    closeDrawer();
  };

  // Multi-select for PDF export (both roles). Selection is independent of the
  // row-click drawer — the checkbox cell stops propagation.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const toggleChecked = (id: string) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allFilteredChecked = filtered.length > 0 && filtered.every((so) => checkedIds.has(so.id));
  const someFilteredChecked = filtered.some((so) => checkedIds.has(so.id));
  const toggleAllFiltered = () =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) filtered.forEach((so) => next.delete(so.id));
      else filtered.forEach((so) => next.add(so.id));
      return next;
    });
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someFilteredChecked && !allFilteredChecked;
  }, [someFilteredChecked, allFilteredChecked]);

  // Export selected orders as a print-formatted document (browser Save-as-PDF). No PDF
  // dependency and no pop-up window (which browsers block) — we print through a hidden
  // same-document iframe.
  const exportSelected = () => {
    const orders = salesOrders.filter((so) => checkedIds.has(so.id));
    if (orders.length === 0) return;
    const tagById = new Map(tags.map((t) => [t.id, t]));
    let grand = 0;
    const sections = orders
      .map((so) => {
        const rows = so.lineItems
          .map((li) => {
            const t = tagById.get(li.tagId);
            const dims = t ? `${t.species} · ${t.grade} · ${t.thick}×${t.width}×${t.length}'` : "—";
            return `<tr><td class="mono">${escapeHtml(li.tagId)}</td><td>${escapeHtml(dims)}</td><td class="r">${li.qty.toLocaleString()}</td><td class="r">${formatUSD(li.unitPrice)}</td><td class="r">${li.discountPct ? li.discountPct + "%" : "—"}</td><td class="r">${formatUSD(lineExtended(li))}</td></tr>`;
          })
          .join("");
        const total = so.lineItems.reduce((s, li) => s + lineExtended(li), 0);
        grand += total;
        return `<section>
          <div class="so-head"><span class="so-id">${escapeHtml(so.id)}</span><span class="pill">${escapeHtml(so.status)}</span></div>
          <div class="meta">${escapeHtml(getClientName(so.clientId))} · Created ${escapeHtml(formatDate(so.date))}${so.expectedShipDate ? " · Expected ship " + escapeHtml(formatDate(so.expectedShipDate)) : ""}</div>
          ${so.notes ? `<div class="notes">${escapeHtml(so.notes)}</div>` : ""}
          <table class="lines"><thead><tr><th>Tag</th><th>Species / Dims</th><th class="r">Qty</th><th class="r">Unit $</th><th class="r">Disc</th><th class="r">Extended</th></tr></thead><tbody>${rows}</tbody></table>
          <div class="total">Order total: <strong>${formatUSD(total)}</strong></div>
        </section>`;
      })
      .join("");
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Timbridge Sales Orders</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1F1F1F;margin:32px}
        h1{font-size:20px;margin:0 0 2px}
        .sub{font-size:12px;color:#666;margin-bottom:20px}
        section{border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin-bottom:14px;page-break-inside:avoid}
        .so-head{display:flex;align-items:center;gap:8px}
        .so-id{font-family:ui-monospace,monospace;font-weight:700;font-size:15px}
        .pill{font-size:10px;text-transform:uppercase;letter-spacing:.04em;background:#EEE;border-radius:999px;padding:2px 8px}
        .meta{font-size:12px;color:#555;margin-top:3px}
        .notes{font-size:12px;color:#333;margin-top:6px;font-style:italic}
        table.lines{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
        table.lines th{text-align:left;color:#666;font-weight:600;border-bottom:1px solid #ddd;padding:4px 6px}
        table.lines td{padding:4px 6px;border-bottom:1px solid #f0f0f0}
        .r{text-align:right}
        .mono{font-family:ui-monospace,monospace}
        .total{text-align:right;font-size:13px;margin-top:8px}
        @media print{body{margin:12mm}}
      </style></head><body>
      <h1>Timbridge — Sales Orders</h1>
      <div class="sub">${orders.length} order${orders.length === 1 ? "" : "s"} · Grand total ${formatUSD(grand)}</div>
      ${sections}
      </body></html>`;

    // Hidden iframe printing — avoids the pop-up window that browsers block.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow?.document;
    if (!idoc) {
      iframe.remove();
      return;
    }
    idoc.open();
    idoc.write(doc);
    idoc.close();
    const win = iframe.contentWindow!;
    const cleanup = () => iframe.remove();
    win.onafterprint = cleanup;
    // Let the iframe lay out, then open the print dialog. A long fallback removes the
    // node if onafterprint never fires (e.g. the user cancels in some browsers).
    window.setTimeout(() => {
      win.focus();
      win.print();
      window.setTimeout(cleanup, 60000);
    }, 200);
  };

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Sales Orders
          </h1>
          <p className="text-sm text-text-sec mt-1">
            Customer orders and the tags they've reserved or shipped.
          </p>
        </div>

        {/* Search + Export on top, filters below — mirrors Stock Locator's header. */}
        <div className="flex gap-3 mb-4 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SO #, client, status..."
              className="w-full py-2.5 pl-[38px] pr-3 text-sm border border-sage rounded-lg outline-none bg-white box-border"
            />
          </div>
          <Button
            variant="primary"
            onClick={exportSelected}
            disabled={checkedIds.size === 0}
            leftIcon={<Download size={14} />}
            title={checkedIds.size === 0 ? "Select one or more orders to export" : `Export ${checkedIds.size} selected order${checkedIds.size === 1 ? "" : "s"} to PDF`}
          >
            Export PDF{checkedIds.size > 0 ? ` (${checkedIds.size})` : ""}
          </Button>
        </div>

        <FilterBar
          filtersActive={filtersActive}
          onReset={resetFilters}
          rightSlot={
            <div className="text-[12px] text-text-ter">
              {filtered.length} {filtered.length === 1 ? "order" : "orders"}
            </div>
          }
        >
          <PillFilter label="Status" options={STATUS_OPTIONS} applied={statusF} onApply={setStatusF} />
          <PillFilter label="Customer" options={customerOpts} applied={customerF} onApply={setCustomerF} />
          <PillFilter label="Species" options={speciesOpts} applied={speciesF} onApply={setSpeciesF} />
        </FilterBar>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-sage">
                  <th className="pl-3.5 pr-1 py-2.5 w-9">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredChecked}
                      onChange={toggleAllFiltered}
                      aria-label="Select all"
                      className="accent-coral w-4 h-4 cursor-pointer align-middle"
                    />
                  </th>
                  {["SO Number", "Customer", "Status", "Line Items", "Total", "Created"].map((h) => (
                    <th
                      key={h}
                      className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${
                        h === "Line Items" || h === "Total" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((so, i) => {
                  const total = so.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
                  const isSelected = selected === so.id;
                  return (
                    <tr
                      key={so.id}
                      onClick={() => (isSelected ? closeDrawer() : openSo(so.id))}
                      className={[
                        "border-b border-[#F3F4F6] cursor-pointer",
                        isSelected
                          ? "bg-coral/[0.12] hover:bg-coral/[0.18]"
                          : `${i % 2 === 0 ? "bg-transparent" : "bg-[#FAFAFA]"} hover:bg-sage/20`,
                      ].join(" ")}
                    >
                      <td className="pl-3.5 pr-1 py-[11px]" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checkedIds.has(so.id)}
                          onChange={() => toggleChecked(so.id)}
                          aria-label={`Select ${so.id}`}
                          className="accent-coral w-4 h-4 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="px-3.5 py-[11px] font-mono text-ink font-semibold whitespace-nowrap">{so.id}</td>
                      <td className="px-3.5 py-[11px]" onClick={(e) => e.stopPropagation()}>
                        {clientById.has(so.clientId) ? (
                          <button
                            onClick={() => onOpenClient(so.clientId)}
                            className="text-text hover:text-coral hover:underline cursor-pointer bg-transparent border-0 p-0 text-left"
                          >
                            {getClientName(so.clientId)}
                          </button>
                        ) : (
                          <span className="text-text-ter italic">Unknown</span>
                        )}
                      </td>
                      <td className="px-3.5 py-[11px]">
                        <SOStatusPill status={so.status} />
                      </td>
                      <td className="px-3.5 py-[11px] text-right tabular-nums">{so.lineItems.length}</td>
                      <td className="px-3.5 py-[11px] text-right tabular-nums text-ink font-semibold">{formatUSD(total)}</td>
                      <td className="px-3.5 py-[11px] text-text-sec text-xs whitespace-nowrap">{formatDate(so.date)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-text-sec">
                      No sales orders match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="orders"
          />
        </div>
      </div>

      {selectedSo && (
        <SalesOrderPanel
          key={selectedSo.id}
          mode="view"
          so={selectedSo}
          allTags={tags}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClose={closeDrawer}
          onUpdateSalesOrder={onUpdateSalesOrder}
          onConfirmDraft={onConfirmDraft}
          onAdvanceStatus={onAdvanceStatus}
          onOpenTag={handleOpenTag}
          onOpenClient={(id) => { onOpenClient(id); closeDrawer(); }}
          onCreateApproval={onCreateApproval}
          requesterIdentity={requesterIdentity}
        />
      )}
    </div>
  );
}
