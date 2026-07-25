import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import type { Client, Role, SalesOrder, SalesOrderStatus, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";
import { Pagination, DEFAULT_PAGE_SIZE, usePagedSlice } from "@/components/shared/Pagination";
import { FilterBar } from "@/components/shared/FilterBar";
import { useClients } from "@/hooks/useClients";
import { ClientDetail } from "./ClientDetail";
import { ClientCreate } from "./ClientCreate";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Open" here means any SO that still ties up inventory — Draft/Open/Picked. Shipped
// and Cancelled are terminal and don't count against the customer's open exposure.
const OPEN_STATUSES: SalesOrderStatus[] = ["Draft", "Open", "Picked"];

// SO.date is an ISO YYYY-MM-DD; client.createdAt is a display string "Jun 01 2026 09:00".
// The "last activity" column ranks by whichever is newer.
function isoFromDisplay(display: string): string | null {
  const m = display.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return null;
  return `${m[3]}-${String(monthIdx + 1).padStart(2, "0")}-${m[2]}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS_SHORT[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

interface ClientsProps {
  tags: Tag[];
  role: Role;
  salesOrders: SalesOrder[];
  openClientId?: string | null;
  onClientOpened?: () => void;
  onOpenSo: (id: string) => void;
  onCreateSalesOrder: (
    clientId: string,
    lineItems: { tagId: string; qty: number; unitPrice: number; discountPct?: number }[],
    confirm: boolean,
    meta?: { notes?: string; expectedShipDate?: string },
  ) => { ok: true; soId: string } | { ok: false; unavailableIds: string[] };
  onViewOrders: (soId?: string) => void;
}

export function Clients({ tags, role, salesOrders, openClientId, onClientOpened, onOpenSo, onCreateSalesOrder, onViewOrders }: ClientsProps) {
  const { clients, updateClient, createClient } = useClients();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const openClient = useCallback((id: string) => {
    setSelected(id);
    setFullscreen(false);
  }, []);
  const closeDrawer = useCallback(() => {
    setSelected(null);
    setFullscreen(false);
  }, []);

  // Deep-link entry point (SO detail's customer chip → this page).
  useEffect(() => {
    if (openClientId) {
      openClient(openClientId);
      onClientOpened?.();
    }
  }, [openClientId, openClient, onClientOpened]);

  // Per-client aggregates: count of currently-Open SOs + most-recent SO date (ISO).
  // "Last activity" falls back to the client's createdAt when no orders exist.
  const activityByClient = useMemo(() => {
    const map = new Map<string, { openCount: number; lastSoIso: string | null }>();
    for (const so of salesOrders) {
      const cur = map.get(so.clientId) ?? { openCount: 0, lastSoIso: null };
      if (OPEN_STATUSES.includes(so.status)) cur.openCount += 1;
      if (!cur.lastSoIso || so.date > cur.lastSoIso) cur.lastSoIso = so.date;
      map.set(so.clientId, cur);
    }
    return map;
  }, [salesOrders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!q) return true;
      const hay = [c.name, c.contactName, c.phone, c.email, c.address, c.territory]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, search]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageRows = usePagedSlice(filtered, page, pageSize);

  const selectedClient = selected ? clients.find((c) => c.id === selected) ?? null : null;

  const filtersActive = search.trim().length > 0;
  const resetFilters = () => {
    setSearch("");
  };

  const handleOpenSo = (id: string) => {
    onOpenSo(id);
    closeDrawer();
  };

  const handleSave = (patch: Partial<Omit<Client, "id" | "createdAt">>) => {
    if (!selected) return;
    updateClient(selected, patch);
  };

  // Create → close the create panel and jump straight into the new client's detail
  // drawer so the user can immediately add follow-up info (address, notes, etc.).
  const handleCreate = (draft: Omit<Client, "id" | "createdAt">) => {
    const newId = createClient(draft);
    setCreating(false);
    setSelected(newId);
  };

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto" data-onboarding="clients-page">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Client Profiles
            </h1>
            <p className="text-sm text-text-sec mt-1">
              Customer contact info and the sales orders linked to each account.
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)} leftIcon={<UserPlus size={14} />}>
            New Client
          </Button>
        </div>

        <FilterBar
          filtersActive={filtersActive}
          onReset={resetFilters}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name, contact, phone, email…",
            maxWidth: "360px",
          }}
          rightSlot={
            <div className="text-[12px] text-text-ter">
              {filtered.length} {filtered.length === 1 ? "client" : "clients"}
            </div>
          }
        />

        <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-sage">
                  {["Customer", "Territory", "Contact", "Open Orders", "Last Activity"].map((h) => (
                    <th
                      key={h}
                      className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${
                        h === "Open Orders" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c, i) => {
                  const isSelected = selected === c.id;
                  const activity = activityByClient.get(c.id);
                  const openCount = activity?.openCount ?? 0;
                  const lastIso = activity?.lastSoIso ?? isoFromDisplay(c.createdAt);
                  const contactBits = [c.contactName, c.phone].filter(Boolean).join(" · ");
                  return (
                    <tr
                      key={c.id}
                      onClick={() => (isSelected ? closeDrawer() : openClient(c.id))}
                      className={[
                        "border-b border-[#F3F4F6] cursor-pointer",
                        isSelected
                          ? "bg-coral/[0.12] hover:bg-coral/[0.18]"
                          : `${i % 2 === 0 ? "bg-transparent" : "bg-[#FAFAFA]"} hover:bg-sage/20`,
                      ].join(" ")}
                    >
                      <td className="px-3.5 py-[11px]">
                        <div className="font-semibold text-ink">{c.name}</div>
                        <div className="font-mono text-[11px] text-text-ter">{c.id}</div>
                      </td>
                      <td className="px-3.5 py-[11px] text-text-sec">
                        {c.territory ?? <span className="text-text-ter">—</span>}
                      </td>
                      <td className="px-3.5 py-[11px] text-text-sec">
                        {contactBits || <span className="text-text-ter">—</span>}
                        {c.email && <div className="text-[11px] text-text-ter">{c.email}</div>}
                      </td>
                      <td className="px-3.5 py-[11px] text-right tabular-nums">
                        <span className={openCount > 0 ? "text-ink font-semibold" : "text-text-ter"}>
                          {openCount}
                        </span>
                      </td>
                      <td className="px-3.5 py-[11px] text-text-sec text-xs whitespace-nowrap">
                        {lastIso ? formatDate(lastIso) : <span className="text-text-ter">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-text-sec">
                      {filtersActive ? "No clients match your filters." : "No clients yet."}
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
            label="clients"
          />
        </div>
      </div>

      {selectedClient && (
        <ClientDetail
          key={selectedClient.id}
          client={selectedClient}
          tags={tags}
          role={role}
          salesOrders={salesOrders}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClose={closeDrawer}
          onSave={handleSave}
          onOpenSo={handleOpenSo}
          onCreateSalesOrder={onCreateSalesOrder}
          onViewOrders={onViewOrders}
        />
      )}

      {creating && (
        <ClientCreate onCancel={() => setCreating(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
