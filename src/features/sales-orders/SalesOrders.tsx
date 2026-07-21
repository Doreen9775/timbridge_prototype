import { useCallback, useEffect, useMemo, useState } from "react";
import type { SalesOrder, SalesOrderStatus, Tag } from "@/lib/types";
import { PillFilter } from "@/features/stock-locator/filters";
import { Pagination, DEFAULT_PAGE_SIZE, usePagedSlice } from "@/components/shared/Pagination";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { FilterBar } from "@/components/shared/FilterBar";
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

interface SalesOrdersProps {
  salesOrders: SalesOrder[];
  tags: Tag[];
  openSoId?: string | null;
  onSoOpened?: () => void;
  onAdvanceStatus: (soId: string, next: SalesOrderStatus) => void;
  onUpdateSalesOrder: (so: SalesOrder) => void;
  onConfirmDraft: (soId: string, lineItems: DraftLineItem[]) => { ok: true } | { ok: false; unavailableIds: string[] };
  onOpenTag: (id: string) => void;
  onOpenClient: (id: string) => void;
  onCreateApproval: (draft: ApprovalDraft) => void;
  requesterIdentity: string;
}

export function SalesOrders({ salesOrders, tags, openSoId, onSoOpened, onAdvanceStatus, onUpdateSalesOrder, onConfirmDraft, onOpenTag, onOpenClient, onCreateApproval, requesterIdentity }: SalesOrdersProps) {
  const { clientById, getClientName } = useClients();
  const [statusF, setStatusF] = useState<string[]>([]);
  const [customerF, setCustomerF] = useState<string[]>([]);
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

  const filtered = useMemo(
    () =>
      salesOrders.filter((so) => {
        if (statusF.length && !statusF.includes(so.status)) return false;
        if (customerF.length && !customerF.includes(getClientName(so.clientId))) return false;
        return true;
      }),
    [salesOrders, statusF, customerF, getClientName],
  );

  useEffect(() => {
    setPage(1);
  }, [statusF, customerF, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageRows = usePagedSlice(filtered, page, pageSize);

  const filtersActive = statusF.length > 0 || customerF.length > 0;
  const resetFilters = () => {
    setStatusF([]);
    setCustomerF([]);
  };

  const selectedSo = selected ? salesOrders.find((so) => so.id === selected) ?? null : null;

  const handleOpenTag = (id: string) => {
    onOpenTag(id);
    closeDrawer();
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
        </FilterBar>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-sage">
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
                    <td colSpan={6} className="p-10 text-center text-text-sec">
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
