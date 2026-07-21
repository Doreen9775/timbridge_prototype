import { useCallback, useEffect, useMemo, useState } from "react";
import type { Client, SalesOrder } from "@/lib/types";
import { Pagination, DEFAULT_PAGE_SIZE, usePagedSlice } from "@/components/shared/Pagination";
import { FilterBar } from "@/components/shared/FilterBar";
import { useClients } from "@/hooks/useClients";
import { ClientDetail } from "./ClientDetail";

function formatDate(display: string): string {
  // createdAt uses the display timestamp convention "Jun 01 2026 09:00" — extract just the day.
  const m = display.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})/);
  if (!m) return display;
  return `${m[1]} ${m[2]}, ${m[3]}`;
}

interface ClientsProps {
  salesOrders: SalesOrder[];
  openClientId?: string | null;
  onClientOpened?: () => void;
  onOpenSo: (id: string) => void;
}

export function Clients({ salesOrders, openClientId, onClientOpened, onOpenSo }: ClientsProps) {
  const { clients, updateClient } = useClients();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
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

  // O(1) per-client SO count for the table column.
  const soCountByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const so of salesOrders) {
      map.set(so.clientId, (map.get(so.clientId) ?? 0) + 1);
    }
    return map;
  }, [salesOrders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [c.name, c.contactName, c.phone, c.email, c.address].filter(Boolean).join(" ").toLowerCase();
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

  const handleOpenSo = (id: string) => {
    onOpenSo(id);
    closeDrawer();
  };

  const handleSave = (patch: Partial<Omit<Client, "id" | "createdAt">>) => {
    if (!selected) return;
    updateClient(selected, patch);
  };

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Client Profiles
          </h1>
          <p className="text-sm text-text-sec mt-1">
            Customer contact info and the sales orders linked to each account.
          </p>
        </div>

        <FilterBar
          filtersActive={false}
          onReset={() => setSearch("")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name, contact, phone, email…",
            maxWidth: "420px",
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
                  {["Client ID", "Name", "Contact", "Phone", "Email", "Orders", "Created"].map((h) => (
                    <th
                      key={h}
                      className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${
                        h === "Orders" ? "text-right" : "text-left"
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
                  const soCount = soCountByClient.get(c.id) ?? 0;
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
                      <td className="px-3.5 py-[11px] font-mono text-text-sec whitespace-nowrap">{c.id}</td>
                      <td className="px-3.5 py-[11px] font-semibold text-ink">{c.name}</td>
                      <td className="px-3.5 py-[11px] text-text-sec">{c.contactName ?? <span className="text-text-ter">—</span>}</td>
                      <td className="px-3.5 py-[11px] text-text-sec whitespace-nowrap">{c.phone ?? <span className="text-text-ter">—</span>}</td>
                      <td className="px-3.5 py-[11px] text-text-sec">{c.email ?? <span className="text-text-ter">—</span>}</td>
                      <td className="px-3.5 py-[11px] text-right tabular-nums">{soCount}</td>
                      <td className="px-3.5 py-[11px] text-text-sec text-xs whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-text-sec">
                      {search ? "No clients match your search." : "No clients yet."}
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
          salesOrders={salesOrders}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClose={closeDrawer}
          onSave={handleSave}
          onOpenSo={handleOpenSo}
        />
      )}
    </div>
  );
}
