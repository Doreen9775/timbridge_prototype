import { useMemo, useState, type ReactNode } from "react";
import { Search, Scan, ChevronDown, X } from "lucide-react";
import type { Tag } from "@/lib/types";
import { StatusBadge } from "@/components/shared/StatusBadge";

const STATUS_OPTIONS = ["All", "Pending", "Received", "Available", "Reserved", "Shipped", "Discrepancy"];
const SPECIES_OPTIONS = ["All", "SPF", "Doug Fir", "Western Red Cedar", "Hem-Fir"];
const YARD_OPTIONS = ["All", "YD-A", "YD-B", "YD-C"];

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-2.5 pr-7 py-1.5 text-[13px] border border-sage rounded-md bg-white text-text outline-none cursor-pointer"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-sec" />
    </div>
  );
}

interface StockLocatorProps {
  tags: Tag[];
  floorView: boolean;
}

export function StockLocator({ tags, floorView }: StockLocatorProps) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All");
  const [speciesF, setSpeciesF] = useState("All");
  const [yardF, setYardF] = useState("All");
  const [lowQty, setLowQty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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
          matchQ &&
          (statusF === "All" || t.status === statusF) &&
          (speciesF === "All" || t.species === speciesF) &&
          (yardF === "All" || t.yard === yardF) &&
          (!lowQty || t.qty < 50)
        );
      }),
    [tags, search, statusF, speciesF, yardF, lowQty],
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

  const filtersActive = search !== "" || statusF !== "All" || speciesF !== "All" || yardF !== "All" || lowQty;
  const resetFilters = () => {
    setSearch(""); setStatusF("All"); setSpeciesF("All"); setYardF("All"); setLowQty(false);
  };

  if (floorView) {
    return (
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
              <button className="w-full p-4 bg-coral text-white border-0 rounded-lg text-lg font-semibold cursor-pointer">Update Location</button>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center text-text-sec text-lg py-10">No tags found</div>}
        </div>
      </div>
    );
  }

  const summaryCards: [string, ReactNode, string][] = [
    ["Total Tags", totals.total, "text-ink"],
    ["Available", totals.available, "text-[#4E6B0E]"],
    ["Total FBM", `${totals.fbm.toLocaleString()} fbm`, "text-ink"],
    ["Reserved", totals.reserved, "text-coral"],
  ];

  return (
    <div className="p-6 bg-cream min-h-full relative">
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Tag ID, species, grade, or location..."
          className="w-full py-2.5 pl-[38px] pr-3 text-sm border border-sage rounded-lg outline-none bg-white box-border"
        />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <FilterSelect value={statusF} onChange={setStatusF} options={STATUS_OPTIONS} />
        <FilterSelect value={speciesF} onChange={setSpeciesF} options={SPECIES_OPTIONS} />
        <FilterSelect value={yardF} onChange={setYardF} options={YARD_OPTIONS} />
        <button
          onClick={() => setLowQty(!lowQty)}
          className={[
            "px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border",
            lowQty ? "border-coral bg-coral/10 text-coral" : "border-sage bg-transparent text-text-sec",
          ].join(" ")}
        >
          Low Qty
        </button>
        {filtersActive && (
          <button
            onClick={resetFilters}
            className="px-3.5 py-1.5 text-[13px] rounded-md cursor-pointer border border-sage bg-transparent text-text-sec flex items-center gap-1 hover:text-coral hover:border-coral"
          >
            <X size={13} />Reset filters
          </button>
        )}
        <span className="ml-auto text-xs text-text-ter self-center">Last synced 14:32</span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {summaryCards.map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-lg px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="text-[11px] text-text-sec mb-1">{label}</div>
            <div className={`text-[22px] font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-sage">
              {["Tag ID", "Species", "Grade", "Dimensions", "Qty", "FBM", "Location", "Status", "Updated"].map((h) => (
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
                  onClick={() => setSelected(t.id)}
                  className={[
                    "border-b border-[#F3F4F6] cursor-pointer hover:bg-sage/20",
                    hl ? "bg-coral/[0.07]" : i % 2 === 0 ? "bg-transparent" : "bg-[#FAFAFA]",
                  ].join(" ")}
                >
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
                  <td className="px-3.5 py-[11px] text-text-ter text-xs">{t.updated}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-10 text-center text-text-sec">No tags match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selTag && <DetailDrawer tag={selTag} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DetailDrawer({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const crumbs: string[] = ["Mill", "→", tag.yard, "→", tag.section, "→", tag.rack, "→", tag.bin];
  const specs: [string, string][] = [
    ["Species", tag.species], ["Grade", tag.grade],
    ["Dimensions", `${tag.thick}×${tag.width} × ${tag.length}'`], ["State", tag.state],
    ["Milling", tag.milling], ["FBM", tag.fbm.toLocaleString()],
    ["Qty", `${tag.qty} pcs`], ["Yard", tag.yard],
  ];
  return (
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.12)] z-[100] overflow-y-auto">
      <div className="px-5 pt-5 pb-4 border-b border-sage flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-base font-bold text-coral">{tag.id}</span>
          <StatusBadge status={tag.status} />
        </div>
        <button onClick={onClose} className="bg-transparent border-0 cursor-pointer text-text-sec"><X size={18} /></button>
      </div>
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
        <div className="grid grid-cols-2 gap-2 mb-5">
          {specs.map(([k, v]) => (
            <div key={k} className="bg-[#F9FAFB] rounded-md px-3 py-2">
              <div className="text-[10px] text-text-ter mb-0.5">{k}</div>
              <div className="text-[13px] font-medium text-text">{v}</div>
            </div>
          ))}
        </div>

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
    </div>
  );
}
