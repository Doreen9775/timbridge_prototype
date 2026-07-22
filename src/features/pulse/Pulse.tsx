import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { AlertTriangle, Download } from "lucide-react";
import type { Role, SalesOrder, Tag } from "@/lib/types";
import { Button } from "@/components/shared/Button";

// Brand palette mirrors Dashboard.tsx — recharts needs hex values, not Tailwind classes.
const C = {
  ink: "#1F1F1F",
  coral: "#F0542B",
  lime: "#AADB1E",
  sage: "#B7CDC2",
  textSec: "#6B7280",
  textTer: "#9CA3AF",
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Small helpers (parseHistoryDate/daysInYard are duplicated from AvailableToSell
// intentionally to keep the reuse-of-pattern boundary local. If a third caller
// appears, promote to lib/history.ts). ─────────────────────────────────────────
function parseHistoryDate(t: string): Date | null {
  const m = t.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return null;
  const d = new Date(Number(m[3]), monthIdx, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysInYard(tag: Tag, todayMs: number): number {
  const received = tag.history[0]?.t ? parseHistoryDate(tag.history[0].t) : null;
  const fallback = received ?? new Date(tag.date);
  const diff = todayMs - fallback.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// CSV cell escaper — mirrors the StockLocator csvCell to keep export behavior consistent
// across features (RFC 4180 quoting, doubled quotes for embedded ").
const csvCell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;

function csvFilename(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `timbridge_${prefix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.csv`;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ISO YYYY-MM-DD → ISO week-start (Monday of that week) as YYYY-MM-DD.
function isoWeekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // 0 for Monday → 6 for Sunday
  date.setDate(date.getDate() - diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDay(iso: string): string {
  const parts = iso.split("-").map(Number);
  return `${MONTHS_SHORT[parts[1] - 1]} ${parts[2]}`;
}

function shortMonth(key: string): string {
  const [yStr, mStr] = key.split("-");
  return `${MONTHS_SHORT[Number(mStr) - 1]} ${yStr.slice(2)}`;
}

interface PulseProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  role: Role;
}

type TabKey = "analytics" | "reports";

export function Pulse({ tags, salesOrders, role }: PulseProps) {
  const canSeeReports = role === "manager";
  const [tab, setTab] = useState<TabKey>("analytics");

  // Defense-in-depth: if Sales somehow lands with tab=reports (e.g. role toggle mid-view), snap back.
  useEffect(() => {
    if (!canSeeReports && tab === "reports") setTab("analytics");
  }, [canSeeReports, tab]);

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Pulse
          </h1>
          <p className="text-sm text-text-sec mt-1">
            {tab === "analytics"
              ? "Inventory flow, species velocity, and yard aging."
              : "Shortage & asset breakdown by species and grade."}
          </p>
        </div>

        <div className="mb-5 border-b border-sage flex gap-1">
          <TabButton label="Analytics" active={tab === "analytics"} onClick={() => setTab("analytics")} />
          {canSeeReports && (
            <TabButton label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} />
          )}
        </div>

        {tab === "analytics" ? (
          <AnalyticsTab tags={tags} />
        ) : (
          <ReportsTab tags={tags} salesOrders={salesOrders} />
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-4 py-2 text-[13px] cursor-pointer border-0 bg-transparent -mb-px border-b-2",
        active ? "border-ink text-ink font-semibold" : "border-transparent text-text-sec hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ tags }: { tags: Tag[] }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const todayMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  // Chart 1: FBM entered per bucket, from tag.date grouped by week (Monday) or by month.
  const trendData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const t of tags) {
      const key = period === "week" ? isoWeekStart(t.date) : t.date.slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + t.fbm);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: period === "week" ? shortDay(k) : shortMonth(k), fbm: v }));
  }, [tags, period]);

  // Chart 2: Reserved + Shipped FBM per species (grouped bars). Only include species
  // that show up in the current data to keep the chart readable.
  const velocityData = useMemo(() => {
    const bySpecies = new Map<string, { reserved: number; shipped: number }>();
    for (const t of tags) {
      const g = bySpecies.get(t.species) ?? { reserved: 0, shipped: 0 };
      if (t.status === "Reserved") g.reserved += t.fbm;
      if (t.status === "Shipped") g.shipped += t.fbm;
      bySpecies.set(t.species, g);
    }
    return Array.from(bySpecies.entries())
      .map(([species, v]) => ({
        // W.R. Cedar short label to keep the axis readable, matches Dashboard's convention.
        name: species === "Western Red Cedar" ? "W.R. Cedar" : species,
        reserved: v.reserved,
        shipped: v.shipped,
      }))
      .filter((d) => d.reserved > 0 || d.shipped > 0)
      .sort((a, b) => b.reserved + b.shipped - (a.reserved + a.shipped));
  }, [tags]);

  // Chart 3: Available-only tags bucketed by days-in-yard.
  const AGING_BUCKETS = [
    { min: 0, max: 7, label: "0–7d" },
    { min: 8, max: 30, label: "8–30d" },
    { min: 31, max: 60, label: "31–60d" },
    { min: 61, max: 90, label: "61–90d" },
    { min: 91, max: Infinity, label: "91+d" },
  ];
  const agingData = useMemo(() => {
    const available = tags.filter((t) => t.status === "Available");
    return AGING_BUCKETS.map((b) => {
      const count = available.filter((t) => {
        const d = daysInYard(t, todayMs);
        return d >= b.min && d <= b.max;
      }).length;
      return { label: b.label, count, isAging: b.min >= 91 };
    });
  }, [tags, todayMs]);

  const agingMax = Math.max(...agingData.map((d) => d.count), 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Chart 1: FBM trend */}
      <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-display font-semibold text-text">FBM entered by {period}</div>
          <div className="flex bg-[#F3F4F6] rounded-full p-[3px] gap-[2px]">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={[
                  "px-3.5 py-[5px] rounded-full border-0 cursor-pointer text-xs font-medium",
                  period === p ? "bg-ink text-white" : "bg-transparent text-text-sec hover:text-text",
                ].join(" ")}
              >
                {p === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
        {trendData.length === 0 ? (
          <div className="text-[13px] text-text-ter py-10 text-center">No entry data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barCategoryGap="30%" accessibilityLayer={false}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} FBM`]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} />
              <Bar dataKey="fbm" fill={C.ink} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 2 + 3 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="text-[13px] font-display font-semibold text-text mb-4">Species sales velocity (Reserved + Shipped FBM)</div>
          {velocityData.length === 0 ? (
            <div className="text-[13px] text-text-ter py-10 text-center">No sales activity yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData} barCategoryGap="25%" accessibilityLayer={false}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
                <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()} FBM`, name]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar dataKey="reserved" name="Reserved" fill={C.lime} radius={[3, 3, 0, 0]} />
                <Bar dataKey="shipped" name="Shipped" fill={C.ink} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-display font-semibold text-text">Days-in-yard distribution (Available)</div>
            {agingData.some((d) => d.isAging && d.count > 0) && (
              <div className="text-[11px] text-coral font-semibold flex items-center gap-1">
                <AlertTriangle size={12} />Aging inventory
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData} barCategoryGap="30%" accessibilityLayer={false}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.max(agingMax + 1, 3)]} />
              <Tooltip formatter={(v) => [`${v} tag${Number(v) === 1 ? "" : "s"}`]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {agingData.map((d, i) => (
                  <Cell key={i} fill={d.isAging ? C.coral : C.ink} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────

interface ShortageRow {
  species: string;
  grade: string;
  physicalFbm: number;
  reservedFbm: number;
  availableFbm: number;
  availableCount: number;
  hasOpenDemand: boolean;
  shortage: boolean;
}

function ReportsTab({ tags, salesOrders }: { tags: Tag[]; salesOrders: SalesOrder[] }) {
  const rows: ShortageRow[] = useMemo(() => {
    // Group by species+grade, aggregating FBM per lifecycle state. Shipped is excluded
    // from Physical (already out the gate); Pending/Received count toward Physical since
    // they're on-yard even if not yet quotable.
    const groups = new Map<string, ShortageRow>();
    for (const t of tags) {
      const key = `${t.species}|${t.grade}`;
      const g = groups.get(key) ?? {
        species: t.species,
        grade: t.grade,
        physicalFbm: 0,
        reservedFbm: 0,
        availableFbm: 0,
        availableCount: 0,
        hasOpenDemand: false,
        shortage: false,
      };
      if (t.status !== "Shipped") g.physicalFbm += t.fbm;
      if (t.status === "Reserved") g.reservedFbm += t.fbm;
      if (t.status === "Available") {
        g.availableFbm += t.fbm;
        g.availableCount += 1;
      }
      groups.set(key, g);
    }

    // Cross-reference Open SO line items: does any Open SO reference a tag in this group?
    const openSoTagIds = new Set(
      salesOrders.filter((so) => so.status === "Open").flatMap((so) => so.lineItems.map((li) => li.tagId)),
    );
    const tagById = new Map(tags.map((t) => [t.id, t]));
    for (const tagId of openSoTagIds) {
      const t = tagById.get(tagId);
      if (!t) continue;
      const key = `${t.species}|${t.grade}`;
      const g = groups.get(key);
      if (g) g.hasOpenDemand = true;
    }

    return Array.from(groups.values())
      .map((g) => ({ ...g, shortage: g.hasOpenDemand && g.availableFbm === 0 }))
      .sort((a, b) => {
        // Shortages float to the top, then alphabetical by species then grade.
        if (a.shortage !== b.shortage) return a.shortage ? -1 : 1;
        return a.species.localeCompare(b.species) || a.grade.localeCompare(b.grade);
      });
  }, [tags, salesOrders]);

  const shortageCount = rows.filter((r) => r.shortage).length;

  const handleExport = () => {
    const HEADERS = ["Species", "Grade", "Physical FBM", "Reserved FBM", "Available FBM", "Available Count", "Open Demand", "Shortage"];
    const lines = [
      HEADERS.map(csvCell).join(","),
      ...rows.map((r) =>
        [r.species, r.grade, r.physicalFbm, r.reservedFbm, r.availableFbm, r.availableCount, r.hasOpenDemand ? "Yes" : "No", r.shortage ? "Yes" : "No"]
          .map(csvCell)
          .join(","),
      ),
    ];
    downloadCsv(lines.join("\r\n"), csvFilename("shortage_report"));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[13px] font-display font-semibold text-text">Shortage & Asset — by Species and Grade</div>
          {shortageCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-coral bg-coral/10 rounded-full px-2 py-0.5">
              <AlertTriangle size={11} />
              {shortageCount} shortage{shortageCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <Button variant="primary" onClick={handleExport} leftIcon={<Download size={14} />} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-sage">
                {["Species", "Grade", "Physical FBM", "Reserved FBM", "Available FBM", "Available Count", "Open Demand", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${
                      i >= 2 && i <= 5 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.species}|${r.grade}`}
                  className={[
                    "border-b border-[#F3F4F6]",
                    r.shortage
                      ? "bg-coral/[0.06] hover:bg-coral/[0.12]"
                      : `${i % 2 === 0 ? "bg-transparent" : "bg-[#FAFAFA]"} hover:bg-sage/15`,
                  ].join(" ")}
                >
                  <td className={`px-3.5 py-[11px] whitespace-nowrap ${r.shortage ? "text-coral font-semibold" : "text-ink font-semibold"}`}>
                    {r.species}
                  </td>
                  <td className={`px-3.5 py-[11px] whitespace-nowrap ${r.shortage ? "text-coral" : "text-text"}`}>{r.grade}</td>
                  <td className="px-3.5 py-[11px] text-right tabular-nums">{r.physicalFbm.toLocaleString()}</td>
                  <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{r.reservedFbm.toLocaleString()}</td>
                  <td className={`px-3.5 py-[11px] text-right tabular-nums ${r.availableFbm === 0 ? "text-coral font-semibold" : "text-ink font-semibold"}`}>
                    {r.availableFbm.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{r.availableCount}</td>
                  <td className="px-3.5 py-[11px]">
                    {r.hasOpenDemand ? (
                      <span className="text-[11px] font-medium text-text bg-sage/40 rounded-full px-2 py-0.5">Yes</span>
                    ) : (
                      <span className="text-[11px] text-text-ter">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-[11px] text-right">
                    {r.shortage && (
                      <span title="Open demand with no Available inventory" className="inline-flex items-center gap-1 text-[11px] font-semibold text-coral">
                        <AlertTriangle size={12} />Shortage
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-text-sec">No inventory to report.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-text-ter">
        <span className="font-semibold">Shortage rule:</span> flagged rows have at least one Open Sales Order line item referencing this species+grade group but zero Available FBM to satisfy new demand.
      </div>
    </div>
  );
}
