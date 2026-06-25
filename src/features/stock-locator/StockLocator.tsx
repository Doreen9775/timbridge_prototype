import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Scan, ChevronDown, ChevronLeft, ChevronRight, X, Download, Maximize2, Minimize2, Filter, RotateCcw, Pencil } from "lucide-react";
import type { Tag, Species, Grade, MoistureState, Milling, TagStatus, EntryFilter, Role, SalesOrder, SalesOrderStatus } from "@/lib/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmationBanner } from "@/components/shared/ConfirmationBanner";
import { calcBoardFeet, calcLineal, calcFbm } from "@/lib/fbm";
import { useRecentRecords } from "@/hooks/useRecentRecords";
import { useLookups } from "@/hooks/useLookups";

const STATUS_OPTIONS = ["Pending", "Received", "Available", "Reserved", "Shipped", "Discrepancy"];

// The 6-state lifecycle (kickoff §4.5) — valid forward transitions only, keyed by current status.
// Available → Reserved additionally requires an eligible (Open) Sales Order to link to.
const VALID_TRANSITIONS: Record<TagStatus, TagStatus[]> = {
  Pending: ["Received", "Discrepancy"],
  Received: ["Available", "Discrepancy"],
  Available: ["Reserved", "Discrepancy"],
  Reserved: ["Available", "Shipped"],
  Discrepancy: ["Pending"],
  Shipped: [],
};
// Species/Grade/State/Milling/Location option lists now come from useLookups() (system defaults
// + Manager-added custom values, src/lib/lookups.ts) instead of hardcoded consts.

// ── Date helpers (Entry Date column + calendar filter) ──
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// "2026-06-01" → "Jun 01, 2026"
function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

const toISO = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// "Jun 23 2026 14:32" — for movement-history events written on save.
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS_SHORT[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Pricing block (Manager-only) — cost/marketValue are optional, so render "—" when absent.
function formatUSD(v?: number): string {
  return v === undefined ? "—" : `$${v.toFixed(2)}`;
}
function formatMargin(cost?: number, marketValue?: number): string {
  if (cost === undefined || marketValue === undefined) return "—";
  const margin = marketValue - cost;
  const pct = cost === 0 ? "—" : `${Math.round((margin / cost) * 100)}%`;
  return `$${margin.toFixed(2)} (${pct})`;
}

// Linked Transactions status pill — reuses StatusBadge's exact color tokens (no new palette),
// remapped onto SalesOrderStatus since the two status unions mostly don't overlap.
const SO_STATUS_STYLES: Record<SalesOrderStatus, string> = {
  Open: "bg-[#EEF0F2] text-[#6B7280]", // neutral gray, same as Tag "Pending"
  Picked: "bg-[#EAF5D0] text-[#4E6B0E]", // lime, same as Tag "Reserved"
  Shipped: "bg-[#D9DDE3] text-[#3B4250]", // darker gray, same as Tag "Shipped"
  Cancelled: "bg-[#FCE0D7] text-[#B23A1A]", // coral alert, same as Tag "Discrepancy"
};
function SOStatusPill({ status }: { status: SalesOrderStatus }) {
  return <span className={`whitespace-nowrap inline-block px-2.5 py-[3px] rounded-xl text-[11px] font-medium ${SO_STATUS_STYLES[status]}`}>{status}</span>;
}

// Set-equality on string arrays — drives the "Apply Now" enabled state.
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((v) => s.has(v));
}

// Shared dropdown shell: trigger (label + count badge + chevron) → click-outside popover → Apply Now footer.
function FilterDropdown({
  label,
  appliedCount,
  applyEnabled,
  onApply,
  width = "w-[300px]",
  children,
  note,
}: {
  label: string;
  appliedCount: number;
  applyEnabled: boolean;
  onApply: () => void;
  width?: string;
  children: ReactNode;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  const apply = () => {
    onApply();
    setOpen(false);
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border bg-white",
          appliedCount > 0 ? "border-coral text-coral hover:bg-coral/5" : "border-sage text-text-sec hover:border-coral hover:text-coral",
        ].join(" ")}
      >
        <span>{label}</span>
        {appliedCount > 0 && (
          <span className="bg-coral text-white rounded-full text-[10px] leading-none px-1.5 py-0.5 font-semibold">{appliedCount}</span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 top-[calc(100%+6px)] ${width} bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-sage z-50 overflow-hidden`}>
            <div className="p-4">{children}</div>
            <div className="px-4 pb-4 pt-1">
              <div className="text-[11px] text-text-ter mb-3 border-t border-sage/60 pt-3">{note}</div>
              <button
                onClick={apply}
                disabled={!applyEnabled}
                className={[
                  "w-full py-2 rounded-lg text-[13px] font-semibold transition-colors",
                  applyEnabled ? "bg-coral text-white cursor-pointer hover:brightness-95" : "bg-sage/30 text-text-ter cursor-not-allowed",
                ].join(" ")}
              >
                Apply Now
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select pill list (Species / Status / Location).
function PillFilter({ label, options, applied, onApply }: { label: string; options: string[]; applied: string[]; onApply: (v: string[]) => void }) {
  const [draft, setDraft] = useState<string[]>(applied);
  // Re-sync the draft to the applied set whenever it changes (e.g. global Reset Filter).
  useEffect(() => setDraft(applied), [applied]);
  const toggle = (o: string) => setDraft((d) => (d.includes(o) ? d.filter((x) => x !== o) : [...d, o]));
  return (
    <FilterDropdown
      label={label}
      appliedCount={applied.length}
      applyEnabled={!sameSet(draft, applied)}
      onApply={() => onApply(draft)}
      note="*You can choose multiple"
    >
      <div className="text-sm font-semibold text-ink mb-3">Select {label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = draft.includes(o);
          return (
            <button
              key={o}
              onClick={() => toggle(o)}
              className={[
                "px-3.5 py-1.5 text-[13px] rounded-full border cursor-pointer transition-colors",
                on ? "bg-coral text-white border-coral hover:brightness-95" : "bg-white text-text border-sage hover:border-coral hover:text-coral",
              ].join(" ")}
            >
              {o}
            </button>
          );
        })}
      </div>
    </FilterDropdown>
  );
}

// Multi-date calendar (Entry Date filter).
function DateFilter({ applied, onApply }: { applied: string[]; onApply: (v: string[]) => void }) {
  const [draft, setDraft] = useState<string[]>(applied);
  useEffect(() => setDraft(applied), [applied]);
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const toggle = (iso: string) => setDraft((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso]));
  const shift = (delta: number) => setView((v) => {
    const m = v.m + delta;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <FilterDropdown
      label="Date"
      appliedCount={applied.length}
      applyEnabled={!sameSet(draft, applied)}
      onApply={() => onApply(draft)}
      width="w-[320px]"
      note="*You can choose multiple dates"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-ink">{MONTHS[view.m]} {view.y}</div>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="w-7 h-7 rounded-md bg-sage/20 hover:bg-sage/40 flex items-center justify-center cursor-pointer"><ChevronLeft size={15} /></button>
          <button onClick={() => shift(1)} aria-label="Next month" className="w-7 h-7 rounded-md bg-sage/20 hover:bg-sage/40 flex items-center justify-center cursor-pointer"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w, i) => <div key={i} className="text-[11px] text-text-ter font-medium py-1">{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = toISO(view.y, view.m, d);
          const on = draft.includes(iso);
          return (
            <div key={i} className="flex justify-center">
              <button
                onClick={() => toggle(iso)}
                className={[
                  "w-8 h-8 rounded-lg text-[13px] cursor-pointer transition-colors",
                  on ? "bg-coral text-white font-semibold hover:brightness-95" : "text-text hover:bg-sage/30",
                ].join(" ")}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </FilterDropdown>
  );
}

// ── CSV export (no library; built from the same filtered array as the table) ──
const CSV_HEADERS = ["Tag ID", "Species", "Grade", "Thickness", "Width", "Length", "Pieces", "Total FBM", "Location", "Status", "Received Date", "Supplier"];

const csvCell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;

function buildStockCsv(tags: Tag[]): string {
  const rows = tags.map((t) =>
    [t.id, t.species, t.grade, t.thick, t.width, t.length, t.qty, t.fbm, `${t.yard} · ${t.section} · ${t.rack}`, t.status, t.history[0]?.t ?? "", t.supplier ?? ""]
      .map(csvCell)
      .join(","),
  );
  return [CSV_HEADERS.map(csvCell).join(","), ...rows].join("\r\n");
}

function csvFilename(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `timbridge_stock_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.csv`;
}

interface StockLocatorProps {
  tags: Tag[];
  floorView: boolean;
  role: Role;
  openTagId?: string | null;
  onTagOpened?: () => void;
  onUpdateTag?: (tag: Tag) => void;
  entryFilter?: EntryFilter | null;
  onClearEntryFilter?: () => void;
  salesOrders: SalesOrder[];
  onLinkSalesOrder?: (soId: string, tagId: string, qty: number, unitPrice: number) => void;
}

export function StockLocator({ tags, floorView, role, openTagId, onTagOpened, onUpdateTag, entryFilter, onClearEntryFilter, salesOrders, onLinkSalesOrder }: StockLocatorProps) {
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [statusF, setStatusF] = useState<string[]>([]);
  const [speciesF, setSpeciesF] = useState<string[]>([]);
  const [gradeF, setGradeF] = useState<string[]>([]);
  const [stateF, setStateF] = useState<string[]>([]);
  const [millingF, setMillingF] = useState<string[]>([]);
  const [yardF, setYardF] = useState<string[]>([]);
  const [lowQty, setLowQty] = useState(false);
  // Hard ID-set gate from entryFilter (composes with the bar filters; cleared by Reset Filter).
  const [idSet, setIdSet] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmTagId, setConfirmTagId] = useState<string | null>(null);
  const { pushRecord } = useRecentRecords();
  const lookups = useLookups();

  // Open a tag's detail drawer and record it as recently accessed (push hook).
  const openTag = useCallback((id: string) => {
    setSelected(id);
    pushRecord({ type: "tag", id, label: id });
  }, [pushRecord]);

  // Closing always returns to the compact (non-fullscreen) state.
  const closeDrawer = useCallback(() => {
    setSelected(null);
    setFullscreen(false);
  }, []);

  // Row click toggles: clicking the already-open tag closes its detail; otherwise open it.
  const handleRowClick = (id: string) => {
    if (selected === id) closeDrawer();
    else openTag(id);
  };

  // Entry point for the Recent dropdown: open the requested tag, then clear the request.
  useEffect(() => {
    if (openTagId) {
      openTag(openTagId);
      onTagOpened?.();
    }
  }, [openTagId, openTag, onTagOpened]);

  // Entry-surface filter: apply once when an entryFilter arrives, then consume-and-clear it in App
  // (same as openTagId). The applied state lives in the local bar/idSet for this visit only — so it's
  // a one-shot: navigating away and back does NOT re-apply. Reset Filter / the banner clear it.
  useEffect(() => {
    if (!entryFilter) return;
    if (entryFilter.status) setStatusF(entryFilter.status);
    if (entryFilter.species) setSpeciesF(entryFilter.species);
    if (entryFilter.lowQty !== undefined) setLowQty(entryFilter.lowQty);
    if (entryFilter.tagIds) setIdSet(entryFilter.tagIds);
    onClearEntryFilter?.();
  }, [entryFilter, onClearEntryFilter]);

  const filtered = useMemo(
    () =>
      tags.filter((t) => {
        const q = search.toLowerCase();
        const matchQ =
          !q ||
          t.id.toLowerCase().includes(q) ||
          t.species.toLowerCase().includes(q) ||
          t.grade.toLowerCase().includes(q) ||
          t.yard.toLowerCase().includes(q);
        return (
          (idSet === null || idSet.includes(t.id)) &&
          matchQ &&
          (dates.length === 0 || dates.includes(t.date)) &&
          (statusF.length === 0 || statusF.includes(t.status)) &&
          (speciesF.length === 0 || speciesF.includes(t.species)) &&
          (gradeF.length === 0 || gradeF.includes(t.grade)) &&
          (stateF.length === 0 || stateF.includes(t.state)) &&
          (millingF.length === 0 || millingF.includes(t.milling)) &&
          (yardF.length === 0 || yardF.includes(t.yard)) &&
          (!lowQty || t.qty < 50)
        );
      }),
    [tags, search, dates, statusF, speciesF, gradeF, stateF, millingF, yardF, lowQty, idSet],
  );

  const totals = useMemo(
    () => ({
      total: filtered.length,
      available: filtered.filter((t) => t.status === "Available").length,
      fbm: filtered.reduce((s, t) => s + t.fbm, 0),
      reserved: filtered.filter((t) => t.status === "Reserved").length,
    }),
    [filtered],
  );

  const selTag = selected ? tags.find((t) => t.id === selected) ?? null : null;

  const filtersActive = search !== "" || dates.length > 0 || statusF.length > 0 || speciesF.length > 0 || gradeF.length > 0 || stateF.length > 0 || millingF.length > 0 || yardF.length > 0 || lowQty || idSet !== null;
  const resetFilters = () => {
    setSearch(""); setDates([]); setStatusF([]); setSpeciesF([]); setGradeF([]); setStateF([]); setMillingF([]); setYardF([]); setLowQty(false);
    setIdSet(null);
    onClearEntryFilter?.();
  };

  // Row selection — export is gated on at least one checked tag, regardless of filters.
  const toggleChecked = (id: string) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allFilteredChecked = filtered.length > 0 && filtered.every((t) => checkedIds.has(t.id));
  const someFilteredChecked = filtered.some((t) => checkedIds.has(t.id));
  const toggleAllFiltered = () =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((t) => {
        if (allFilteredChecked) next.delete(t.id);
        else next.add(t.id);
      });
      return next;
    });

  // Header "select all" reflects a partial selection with the indeterminate state.
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someFilteredChecked && !allFilteredChecked;
  }, [someFilteredChecked, allFilteredChecked]);

  const handleExport = () => {
    if (checkedIds.size === 0) return;
    const toExport = tags.filter((t) => checkedIds.has(t.id));
    const blob = new Blob([buildStockCsv(toExport)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Post-creation confirmation banner — shown iff a tagIds entry-filter is active (one-shot).
  const idCount = idSet?.length ?? 0;
  const banner = idCount > 0 ? (
    <ConfirmationBanner
      message={`${idCount} tag${idCount === 1 ? "" : "s"} created`}
      actionLabel="View all stock"
      onAction={resetFilters}
      onDismiss={resetFilters}
    />
  ) : null;

  if (floorView) {
    const confirmTag = confirmTagId ? tags.find((t) => t.id === confirmTagId) ?? null : null;
    return (
      <>
      {banner}
      <div className="p-6 bg-cream min-h-full">
        <div className="relative mb-6">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sec" />
          <Scan size={22} className="absolute right-4 top-1/2 -translate-y-1/2 text-coral cursor-pointer" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scan tag barcode or type ID..."
            className="w-full py-[18px] px-[52px] text-xl border-2 border-sage rounded-[10px] outline-none bg-white box-border"
          />
        </div>
        <div className="flex flex-col gap-4">
          {filtered.slice(0, 5).map((t) => (
            <div key={t.id} className="bg-white rounded-xl p-5 border border-sage">
              <div className="flex justify-between items-start mb-3">
                <span className="font-mono text-[22px] font-bold text-coral">{t.id}</span>
                <StatusBadge status={t.status} size="lg" />
              </div>
              <div className="text-xl text-text mb-2">📍 {t.yard} · {t.section} · {t.rack}</div>
              <div className="text-base text-text-sec mb-4">{t.species} · {t.grade} · {t.thick}×{t.width} × {t.length}' · {t.qty} pcs</div>
              {t.status === "Pending" ? (
                <button
                  onClick={() => setConfirmTagId(t.id)}
                  className="w-full min-h-[44px] p-4 bg-lime text-ink border-0 rounded-lg text-lg font-semibold cursor-pointer hover:brightness-95"
                >
                  Confirm Receipt
                </button>
              ) : (
                <button className="w-full min-h-[44px] p-4 bg-coral text-white border-0 rounded-lg text-lg font-semibold cursor-pointer hover:brightness-95">Update Location</button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center text-text-sec text-lg py-10">No tags found</div>}
        </div>
      </div>
      {confirmTag && (
        <FloorConfirmSheet
          tag={confirmTag}
          onClose={() => setConfirmTagId(null)}
          onSave={(updated) => {
            onUpdateTag?.(updated);
            setConfirmTagId(null);
          }}
        />
      )}
      </>
    );
  }

  const summaryCards: [string, ReactNode][] = [
    ["Total Tags", totals.total],
    ["Available", totals.available],
    ["Total FBM", `${totals.fbm.toLocaleString()} fbm`],
    ["Reserved", totals.reserved],
  ];
  // Colored summary cards (reference layout, brand colors): white + sage + coral + lime.
  const cardThemes = [
    { card: "bg-white", label: "text-text-sec", value: "text-ink" }, // Total Tags
    { card: "bg-sage", label: "text-ink/70", value: "text-ink" }, // Available
    { card: "bg-white", label: "text-text-sec", value: "text-ink" }, // Total FBM (same as Total Tags)
    { card: "bg-lime", label: "text-ink/70", value: "text-ink" }, // Reserved
  ];

  return (
    <>
    {banner}
    <div className="p-6 bg-cream min-h-full relative">
      <div className="max-w-[1600px] mx-auto">
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Tag ID, species, grade, or location..."
          className="w-full py-2.5 pl-[38px] pr-3 text-sm border border-sage rounded-lg outline-none bg-white box-border"
        />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <span className="flex items-center gap-1.5 text-[13px] text-text-sec font-medium pr-1">
          <Filter size={15} />Filter By
        </span>
        <DateFilter applied={dates} onApply={setDates} />
        <PillFilter label="Species" options={lookups.species.map((v) => v.code)} applied={speciesF} onApply={setSpeciesF} />
        <PillFilter label="Grade" options={lookups.grades.map((v) => v.code)} applied={gradeF} onApply={setGradeF} />
        <PillFilter label="State" options={lookups.states.map((v) => v.code)} applied={stateF} onApply={setStateF} />
        <PillFilter label="Milling" options={lookups.milling.map((v) => v.code)} applied={millingF} onApply={setMillingF} />
        <PillFilter label="Status" options={STATUS_OPTIONS} applied={statusF} onApply={setStatusF} />
        <PillFilter label="Location" options={lookups.locations.map((v) => v.code)} applied={yardF} onApply={setYardF} />
        <button
          onClick={() => setLowQty(!lowQty)}
          className={[
            "px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border",
            lowQty ? "border-coral bg-coral/10 text-coral hover:bg-coral/20" : "border-sage bg-transparent text-text-sec hover:border-coral hover:text-coral",
          ].join(" ")}
        >
          Low Qty
        </button>
        {filtersActive && (
          <button
            onClick={resetFilters}
            className="px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border border-sage bg-transparent text-text-sec flex items-center gap-1 hover:text-coral hover:border-coral"
          >
            <RotateCcw size={13} />Reset Filter
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={checkedIds.size === 0}
            title={checkedIds.size === 0 ? "Select one or more tags to export" : `Export ${checkedIds.size} selected tag${checkedIds.size === 1 ? "" : "s"}`}
            className={[
              "px-3.5 py-1.5 text-[13px] rounded-md border flex items-center gap-1.5 transition-colors",
              checkedIds.size === 0
                ? "border-sage bg-white text-text-ter opacity-60 cursor-not-allowed"
                : "border-coral bg-coral text-white cursor-pointer hover:brightness-95",
            ].join(" ")}
          >
            <Download size={14} />Export CSV{checkedIds.size > 0 ? ` (${checkedIds.size})` : ""}
          </button>
          <span className="text-xs text-text-ter self-center">Last synced 14:32</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {summaryCards.map(([label, value], i) => {
          const th = cardThemes[i % cardThemes.length];
          return (
            <div key={label} className={`${th.card} rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]`}>
              <div className={`text-[11px] mb-1 ${th.label}`}>{label}</div>
              <div className={`text-[22px] font-display font-bold ${th.value}`}>{value}</div>
            </div>
          );
        })}
      </div>

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
              {["Tag ID", "Species", "Grade", "Dimensions", "Qty", "FBM", "Location", "Status", "Entry Date", "Updated"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-left text-text-sec font-medium whitespace-nowrap text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const hl = !!search && (t.id.toLowerCase().includes(search.toLowerCase()) || t.species.toLowerCase().includes(search.toLowerCase()));
              return (
                <tr
                  key={t.id}
                  onClick={() => handleRowClick(t.id)}
                  className={[
                    "border-b border-[#F3F4F6] cursor-pointer hover:bg-sage/20",
                    hl ? "bg-coral/[0.07]" : i % 2 === 0 ? "bg-transparent" : "bg-[#FAFAFA]",
                  ].join(" ")}
                >
                  <td className="pl-3.5 pr-1 py-[11px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(t.id)}
                      onChange={() => toggleChecked(t.id)}
                      aria-label={`Select ${t.id}`}
                      className="accent-coral w-4 h-4 cursor-pointer align-middle"
                    />
                  </td>
                  <td className="px-3.5 py-[11px] font-mono text-coral font-semibold whitespace-nowrap">{t.id}</td>
                  <td className="px-3.5 py-[11px]">{t.species}</td>
                  <td className="px-3.5 py-[11px]">{t.grade}</td>
                  <td className="px-3.5 py-[11px] font-mono whitespace-nowrap">{t.thick}×{t.width} × {t.length}'</td>
                  <td className={`px-3.5 py-[11px] ${t.qty < 50 ? "text-coral font-semibold" : "text-text"}`}>{t.qty}</td>
                  <td className="px-3.5 py-[11px] text-text-sec">{t.fbm.toLocaleString()}</td>
                  <td className="px-3.5 py-[11px]">
                    <span className="bg-sage/40 text-ink font-mono text-[11px] px-2 py-[3px] rounded-[5px]">{t.yard} · {t.section} · {t.rack}</span>
                  </td>
                  <td className="px-3.5 py-[11px]"><StatusBadge status={t.status} /></td>
                  <td className="px-3.5 py-[11px] text-text-sec text-xs whitespace-nowrap">{formatEntryDate(t.date)}</td>
                  <td className="px-3.5 py-[11px] text-text-ter text-xs">{t.updated}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="p-10 text-center text-text-sec">No tags match your filters</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      </div>

      {selTag && (
        <DetailDrawer
          key={selTag.id}
          tag={selTag}
          fullscreen={fullscreen}
          role={role}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClose={closeDrawer}
          onSave={onUpdateTag}
          salesOrders={salesOrders}
          onLinkSalesOrder={onLinkSalesOrder}
        />
      )}
    </div>
    </>
  );
}

// Floor-only action sheet for a Pending tag — "Confirm Receipt" entry point from the floor card
// list. Two outcomes: Confirm as Received (Pending → Received → Available, no QC step, location
// editable) or Flag Discrepancy (→ Discrepancy, optional note).
function FloorConfirmSheet({ tag, onClose, onSave }: { tag: Tag; onClose: () => void; onSave: (tag: Tag) => void }) {
  const [step, setStep] = useState<"choose" | "receive" | "discrepancy">("choose");
  const [yard, setYard] = useState(tag.yard);
  const [section, setSection] = useState(tag.section);
  const [rack, setRack] = useState(tag.rack);
  const [bin, setBin] = useState(tag.bin);
  const [note, setNote] = useState("");

  const fieldCls = "w-full min-h-[44px] border border-sage rounded-lg px-3 text-base bg-white text-text outline-none focus:border-coral";
  const field = (label: string, node: ReactNode) => (
    <label className="block">
      <div className="text-xs text-text-ter mb-1">{label}</div>
      {node}
    </label>
  );

  const confirmReceived = () => {
    onSave({
      ...tag,
      yard, section, rack, bin,
      status: "Available",
      updated: "just now",
      history: [
        ...tag.history,
        { e: `Confirmed received at ${yard}/${section}/${rack}/${bin}`, t: nowStamp(), w: "Floor" },
        { e: "Released — available to sell", t: nowStamp(), w: "System" },
      ],
    });
  };

  const flagDiscrepancy = () => {
    onSave({
      ...tag,
      status: "Discrepancy",
      updated: "just now",
      history: [...tag.history, { e: note.trim() ? `Flagged: ${note.trim()}` : "Flagged: discrepancy on arrival", t: nowStamp(), w: "Floor" }],
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-ink/40 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <span className="font-mono text-xl font-bold text-coral">{tag.id}</span>
          <button onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-sec hover:text-coral cursor-pointer bg-transparent border-0">
            <X size={22} />
          </button>
        </div>

        {step === "choose" && (
          <>
            <div className="text-base text-text-sec mb-6">
              Expected: {tag.species} · {tag.grade} · {tag.qty} pcs
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep("receive")}
                className="w-full min-h-[44px] py-3 bg-lime text-ink rounded-lg text-lg font-semibold cursor-pointer hover:brightness-95"
              >
                Confirm as Received
              </button>
              <button
                onClick={() => setStep("discrepancy")}
                className="w-full min-h-[44px] py-3 bg-white border-2 border-coral text-coral rounded-lg text-lg font-semibold cursor-pointer hover:bg-coral/5"
              >
                Flag Discrepancy
              </button>
            </div>
          </>
        )}

        {step === "receive" && (
          <>
            <div className="text-base text-text-sec mb-3">Confirm yard location</div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {field("Yard", <input className={fieldCls} value={yard} onChange={(e) => setYard(e.target.value)} />)}
              {field("Section", <input className={fieldCls} value={section} onChange={(e) => setSection(e.target.value)} />)}
              {field("Rack", <input className={fieldCls} value={rack} onChange={(e) => setRack(e.target.value)} />)}
              {field("Bin", <input className={fieldCls} value={bin} onChange={(e) => setBin(e.target.value)} />)}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("choose")} className="flex-1 min-h-[44px] py-3 border border-sage rounded-lg text-base text-text-sec cursor-pointer hover:border-coral hover:text-coral">Back</button>
              <button onClick={confirmReceived} className="flex-1 min-h-[44px] py-3 bg-coral text-white rounded-lg text-base font-semibold cursor-pointer hover:brightness-95">Save</button>
            </div>
          </>
        )}

        {step === "discrepancy" && (
          <>
            <div className="text-base text-text-sec mb-3">Note (optional)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. qty short 5 pcs"
              className="w-full border border-sage rounded-lg p-3 text-base mb-6 outline-none focus:border-coral"
            />
            <div className="flex gap-3">
              <button onClick={() => setStep("choose")} className="flex-1 min-h-[44px] py-3 border border-sage rounded-lg text-base text-text-sec cursor-pointer hover:border-coral hover:text-coral">Back</button>
              <button onClick={flagDiscrepancy} className="flex-1 min-h-[44px] py-3 bg-coral text-white rounded-lg text-base font-semibold cursor-pointer hover:brightness-95">Save</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailDrawer({
  tag,
  fullscreen,
  role,
  onToggleFullscreen,
  onClose,
  onSave,
  salesOrders,
  onLinkSalesOrder,
}: {
  tag: Tag;
  fullscreen: boolean;
  role: Role;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onSave?: (tag: Tag) => void;
  salesOrders: SalesOrder[];
  onLinkSalesOrder?: (soId: string, tagId: string, qty: number, unitPrice: number) => void;
}) {
  const isManager = role === "manager";
  const showLinkedTransactions = role !== "floor";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Tag>(tag);
  const canEdit = !!onSave;
  const lookups = useLookups();
  const linkedSOs = useMemo(
    () => salesOrders.flatMap((so) => so.lineItems.filter((li) => li.tagId === tag.id).map((li) => ({ so, li }))),
    [salesOrders, tag.id],
  );

  // Status dropdown (Manager only) — valid forward transitions from the in-progress draft status.
  // Available → Reserved is gated on at least one Open Sales Order to link; confirming "Reserved"
  // queues that link (created on Save, not immediately — so Cancel can't leave an orphaned link).
  const eligibleSOs = useMemo(() => salesOrders.filter((so) => so.status === "Open"), [salesOrders]);
  const statusOptions = VALID_TRANSITIONS[draft.status].filter((s) => s !== "Reserved" || eligibleSOs.length > 0);
  const [statusConfirm, setStatusConfirm] = useState<{ next: TagStatus; soId: string } | null>(null);
  const [pendingSOLink, setPendingSOLink] = useState<{ soId: string; qty: number; unitPrice: number } | null>(null);

  const startEdit = () => { setDraft(tag); setPendingSOLink(null); setEditing(true); };
  const cancelEdit = () => { setPendingSOLink(null); setEditing(false); };
  const saveEdit = () => {
    const fbm = calcFbm(draft.thick, draft.width, draft.length, draft.qty);
    const updated: Tag = {
      ...draft,
      fbm,
      updated: "just now",
      history: [
        ...draft.history,
        draft.status !== tag.status
          ? { e: `Status changed to ${draft.status} via Stock Locator`, t: nowStamp(), w: "DW" }
          : { e: "Edited via Stock Locator", t: nowStamp(), w: "DW" },
      ],
    };
    onSave?.(updated);
    if (pendingSOLink) {
      onLinkSalesOrder?.(pendingSOLink.soId, tag.id, pendingSOLink.qty, pendingSOLink.unitPrice);
      setPendingSOLink(null);
    }
    setEditing(false);
  };

  const crumbs: string[] = ["Mill", "→", tag.yard, "→", tag.section, "→", tag.rack, "→", tag.bin];
  const specs: [string, string][] = [
    ["Species", tag.species], ["Grade", tag.grade],
    ["Dimensions", `${tag.thick}×${tag.width} × ${tag.length}'`], ["State", tag.state],
    ["Milling", tag.milling], ["FBM", tag.fbm.toLocaleString()],
    ["Qty", `${tag.qty} pcs`], ["Yard", tag.yard],
  ];

  // Edit-form styling + a small label-wrapper helper (a plain function, not a component,
  // so inputs keep focus across keystrokes).
  const inputCls = "w-full border border-sage rounded-md px-2 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral";
  const field = (label: string, node: ReactNode) => (
    <label className="block">
      <div className="text-[10px] text-text-ter mb-0.5">{label}</div>
      {node}
    </label>
  );

  const header = (
    <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-base font-bold text-coral">{tag.id}</span>
        <StatusBadge status={editing ? draft.status : tag.status} />
      </div>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <>
            <button onClick={cancelEdit} className="px-3 py-1 text-[13px] rounded-md border border-sage text-text-sec hover:text-coral hover:border-coral cursor-pointer">Cancel</button>
            <button onClick={saveEdit} className="px-3.5 py-1 text-[13px] rounded-md bg-coral text-white font-semibold hover:brightness-95 cursor-pointer">Save</button>
            <button
              onClick={onToggleFullscreen}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </>
        ) : (
          <>
            {canEdit && (
              <button onClick={startEdit} aria-label="Edit" title="Edit" className="flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-md border border-sage text-text-sec hover:text-coral hover:border-coral cursor-pointer">
                <Pencil size={13} />Edit
              </button>
            )}
            <button
              onClick={onToggleFullscreen}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"><X size={18} /></button>
          </>
        )}
      </div>
    </div>
  );

  const editBody = (
    <div className="p-5 space-y-5">
      {isManager && (
        <div>
          <div className="text-xs text-text-sec mb-2">Status</div>
          <select
            className={inputCls}
            value={draft.status}
            disabled={statusOptions.length === 0}
            onChange={(e) => {
              const next = e.target.value as TagStatus;
              if (next === draft.status) return;
              setStatusConfirm({ next, soId: eligibleSOs[0]?.id ?? "" });
            }}
          >
            <option value={draft.status}>{draft.status}</option>
            {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {statusOptions.length === 0 && (
            <div className="text-[10px] text-text-ter mt-1">Shipped is a final state — no further transitions.</div>
          )}
        </div>
      )}

      <div>
        <div className="text-xs text-text-sec mb-2">Location</div>
        <div className={`grid gap-2 ${fullscreen ? "grid-cols-4" : "grid-cols-2"}`}>
          {field("Yard", (
            <select className={inputCls} value={draft.yard} onChange={(e) => setDraft((d) => ({ ...d, yard: e.target.value }))}>
              {lookups.locations.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
            </select>
          ))}
          {field("Section", <input className={inputCls} value={draft.section} onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))} />)}
          {field("Rack", <input className={inputCls} value={draft.rack} onChange={(e) => setDraft((d) => ({ ...d, rack: e.target.value }))} />)}
          {field("Bin", <input className={inputCls} value={draft.bin} onChange={(e) => setDraft((d) => ({ ...d, bin: e.target.value }))} />)}
        </div>
      </div>

      <div>
        <div className="text-xs text-text-sec mb-2">Product Specs</div>
        <div className={`grid gap-2 ${fullscreen ? "grid-cols-4" : "grid-cols-2"}`}>
          {field("Species", (
            <select className={inputCls} value={draft.species} onChange={(e) => setDraft((d) => ({ ...d, species: e.target.value as Species }))}>
              {lookups.species.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
            </select>
          ))}
          {field("Grade", (
            <select className={inputCls} value={draft.grade} onChange={(e) => setDraft((d) => ({ ...d, grade: e.target.value as Grade }))}>
              {lookups.grades.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
            </select>
          ))}
          {field("Thickness (in)", <input type="number" min="0" step="0.5" className={inputCls} value={draft.thick} onChange={(e) => setDraft((d) => ({ ...d, thick: Number(e.target.value) }))} />)}
          {field("Width (in)", <input type="number" min="0" step="0.5" className={inputCls} value={draft.width} onChange={(e) => setDraft((d) => ({ ...d, width: Number(e.target.value) }))} />)}
          {field("Length (ft)", <input type="number" min="0" className={inputCls} value={draft.length} onChange={(e) => setDraft((d) => ({ ...d, length: Number(e.target.value) }))} />)}
          {field("Qty (pcs)", <input type="number" min="0" className={inputCls} value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: Number(e.target.value) }))} />)}
          {field("State", (
            <select className={inputCls} value={draft.state} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value as MoistureState }))}>
              {lookups.states.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
            </select>
          ))}
          {field("Milling", (
            <select className={inputCls} value={draft.milling} onChange={(e) => setDraft((d) => ({ ...d, milling: e.target.value as Milling }))}>
              {lookups.milling.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
            </select>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-text-sec mb-2">Units (auto)</div>
        <div className="bg-[#F9FAFB] rounded-md px-4 py-3 flex items-end justify-between">
          <div>
            <div className="text-2xl font-display font-bold text-ink leading-none">{calcBoardFeet(draft.thick, draft.width, draft.length, draft.qty).toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">BF</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-text leading-none">{draft.qty.toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">pcs</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-text leading-none">{calcLineal(draft.length, draft.qty).toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">lf</div>
          </div>
        </div>
        <div className="text-[10px] text-text-ter mt-1.5">FBM updates to {calcFbm(draft.thick, draft.width, draft.length, draft.qty).toLocaleString()} on save. ID, traceability and movement history stay read-only.</div>
      </div>

      {isManager && (
        <div>
          <div className="text-xs text-text-sec mb-2">Pricing</div>
          <div className="bg-[#F9FAFB] rounded-md px-4 py-3 mb-2 flex items-end justify-between">
            <div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.cost ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) }))}
                className="w-20 border border-sage rounded-md px-1.5 py-1 text-base font-semibold text-text outline-none focus:border-coral"
              />
              <div className="text-[10px] text-text-ter mt-1">cost / unit</div>
            </div>
            <div className="text-right">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.marketValue ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, marketValue: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) }))}
                className="w-20 border border-sage rounded-md px-1.5 py-1 text-base font-semibold text-text outline-none focus:border-coral text-right"
              />
              <div className="text-[10px] text-text-ter mt-1">value / unit</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-ink leading-none">{formatMargin(draft.cost, draft.marketValue)}</div>
              <div className="text-[10px] text-text-ter mt-1">margin</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const viewBody = (
    <div className="p-5">
        <div className="text-xs text-text-sec mb-2">Location</div>
        <div className="flex items-center gap-1.5 mb-5 flex-wrap">
          {crumbs.map((s, i) => {
            const isArrow = s === "→";
            const isBin = s === tag.bin && !isArrow;
            return (
              <span
                key={i}
                className={[
                  "text-xs rounded-[5px]",
                  isArrow ? "text-text-ter" : "font-mono px-2 py-[3px]",
                  isBin ? "bg-coral text-white" : isArrow ? "" : "bg-sage/40 text-ink",
                ].join(" ")}
              >
                {s}
              </span>
            );
          })}
        </div>

        <div className="text-xs text-text-sec mb-2">Product Specs</div>
        <div className={`grid gap-2 mb-5 ${fullscreen ? "grid-cols-4" : "grid-cols-2"}`}>
          {specs.map(([k, v]) => (
            <div key={k} className="bg-[#F9FAFB] rounded-md px-3 py-2">
              <div className="text-[10px] text-text-ter mb-0.5">{k}</div>
              <div className="text-[13px] font-medium text-text">{v}</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-text-sec mb-2">Units</div>
        <div className="bg-[#F9FAFB] rounded-md px-4 py-3 mb-5 flex items-end justify-between">
          <div>
            <div className="text-2xl font-display font-bold text-ink leading-none">{calcBoardFeet(tag.thick, tag.width, tag.length, tag.qty).toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">BF</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-text leading-none">{tag.qty.toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">pcs</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-text leading-none">{calcLineal(tag.length, tag.qty).toLocaleString()}</div>
            <div className="text-[10px] text-text-ter mt-1">lf</div>
          </div>
        </div>

        {isManager && (
          <>
            <div className="text-xs text-text-sec mb-2">Pricing</div>
            <div className="bg-[#F9FAFB] rounded-md px-4 py-3 mb-5 flex items-end justify-between">
              <div>
                <div className="text-base font-semibold text-text leading-none">{formatUSD(tag.cost)}</div>
                <div className="text-[10px] text-text-ter mt-1">cost / unit</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold text-text leading-none">{formatUSD(tag.marketValue)}</div>
                <div className="text-[10px] text-text-ter mt-1">value / unit</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-display font-bold text-ink leading-none">{formatMargin(tag.cost, tag.marketValue)}</div>
                <div className="text-[10px] text-text-ter mt-1">margin</div>
              </div>
            </div>
          </>
        )}

        {showLinkedTransactions && (
          <div className="mb-5">
            <div className="text-xs text-text-sec mb-2">Linked Transactions</div>
            {linkedSOs.length === 0 ? (
              <div className="bg-[#F9FAFB] rounded-md px-4 py-3 text-[13px] text-text-ter">No linked transactions yet</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {linkedSOs.map(({ so, li }) => (
                  <div key={so.id} className="bg-[#F9FAFB] rounded-md px-3 py-2 flex items-center gap-2 text-[13px]">
                    <span
                      title="Sales Order detail coming soon"
                      className="font-mono font-semibold text-coral cursor-pointer hover:underline"
                    >
                      {so.id}
                    </span>
                    <span className="flex-1 text-text truncate">{so.customer}</span>
                    <SOStatusPill status={so.status} />
                    <span className="text-text-sec whitespace-nowrap">{li.qty.toLocaleString()} pcs</span>
                    <span className="text-text-sec whitespace-nowrap">${li.unitPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tag.parentLog && (
          <div className="mb-5">
            <div className="text-xs text-text-sec mb-2">Traceability</div>
            <div className="bg-sage/20 rounded-lg p-3 border border-sage">
              <div className="text-[11px] text-text-sec mb-1.5">↑ Parent Log</div>
              <div className="font-mono text-[13px] text-coral font-semibold">{tag.parentLog}</div>
              <div className="text-[11px] text-text-sec mt-2">↓ Sibling boards from same production run share this log ID</div>
            </div>
          </div>
        )}

        <div className="text-xs text-text-sec mb-2">Movement History</div>
        {tag.history.map((h, i) => (
          <div key={i} className="flex gap-3 mb-3">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full mt-[3px] ${i === 0 ? "bg-coral" : "bg-sage"}`} />
              {i < tag.history.length - 1 && <div className="w-0.5 flex-1 bg-sage my-1" />}
            </div>
            <div className="flex-1 pb-2">
              <div className="text-[13px] text-text">{h.e}</div>
              <div className="text-[11px] text-text-ter mt-0.5">{h.t} · {h.w}</div>
            </div>
          </div>
        ))}
      </div>
  );

  const body = editing ? editBody : viewBody;

  // Small confirmation dialog before a status change is committed to the draft (overlays
  // whichever drawer layout is active — fullscreen or side panel — so it's defined once).
  const statusConfirmDialog = statusConfirm && (
    <div className="fixed inset-0 z-[110] bg-ink/40 flex items-center justify-center p-6" onClick={() => setStatusConfirm(null)}>
      <div className="bg-white w-full max-w-sm rounded-xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)]" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-ink mb-1">Change status?</div>
        <div className="text-[13px] text-text-sec mb-4">
          {draft.status} → <span className="font-semibold text-text">{statusConfirm.next}</span>
        </div>
        {statusConfirm.next === "Reserved" && (
          <div className="mb-4">
            <div className="text-xs text-text-sec mb-1.5">Link to Sales Order</div>
            <select
              className={inputCls}
              value={statusConfirm.soId}
              onChange={(e) => setStatusConfirm((c) => (c ? { ...c, soId: e.target.value } : c))}
            >
              {eligibleSOs.map((so) => <option key={so.id} value={so.id}>{so.id} — {so.customer}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setStatusConfirm(null)} className="px-3 py-1.5 text-[13px] rounded-md border border-sage text-text-sec hover:text-coral hover:border-coral cursor-pointer">Cancel</button>
          <button
            onClick={() => {
              setDraft((d) => ({ ...d, status: statusConfirm.next }));
              if (statusConfirm.next === "Reserved" && statusConfirm.soId) {
                setPendingSOLink({ soId: statusConfirm.soId, qty: tag.qty, unitPrice: tag.marketValue ?? 0 });
              }
              setStatusConfirm(null);
            }}
            className="px-3.5 py-1.5 text-[13px] rounded-md bg-coral text-white font-semibold hover:brightness-95 cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-ink/40 flex items-center justify-center p-6"
        onClick={editing ? undefined : onClose}
      >
        <div
          className="bg-white w-full max-w-3xl max-h-[90vh] rounded-xl overflow-y-auto shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          {body}
        </div>
        {statusConfirmDialog}
      </div>
    );
  }

  return (
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.12)] z-[100] overflow-y-auto">
      {header}
      {body}
      {statusConfirmDialog}
    </div>
  );
}
