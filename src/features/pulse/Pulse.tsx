import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, Download, Minus } from "lucide-react";
import type { EntryFilter, Role, SalesOrder, SalesOrderFilter, Tag } from "@/lib/types";
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

// ── "Updated X ago" freshness helpers ───────────────────────────────────────────
// Display-layer only: derive the freshest underlying record for each tab (no live
// sync clock, no polling). Analytics reads tag.date (date-only); Reports reads the
// latest parsed history event (incl. time). Both fold to "max across all tags".

// Latest tag.date (ISO YYYY-MM-DD, parsed at local midnight) → epoch ms, or null when empty.
function latestTagDateMs(tags: Tag[]): number | null {
  let max = -Infinity;
  for (const t of tags) {
    const [y, m, d] = t.date.split("-").map(Number);
    const ms = new Date(y, m - 1, d).getTime();
    if (!Number.isNaN(ms) && ms > max) max = ms;
  }
  return max === -Infinity ? null : max;
}

// Parse a history stamp *including* time ("Jun 01 2026 08:12") → epoch ms, or null.
// Time is optional so a bare "Jun 01 2026" still parses (falls back to midnight).
function parseHistoryStampMs(t: string): number | null {
  const m = t.match(/^([A-Za-z]{3}) (\d{2}) (\d{4})(?: (\d{2}):(\d{2}))?/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return null;
  const ms = new Date(Number(m[3]), monthIdx, Number(m[2]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Latest history event across all tags → epoch ms, or null when there are none.
function latestHistoryMs(tags: Tag[]): number | null {
  let max = -Infinity;
  for (const t of tags) {
    for (const ev of t.history) {
      const ms = parseHistoryStampMs(ev.t);
      if (ms !== null && ms > max) max = ms;
    }
  }
  return max === -Infinity ? null : max;
}

// Short relative label matching the app's tag.updated convention ("just now"/"3h ago"/"2d ago").
function shortRelative(ms: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (s < 60) return "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
  // Drill-through: Analytics charts navigate to a pre-filtered Stock Locator / Sales Orders.
  onNavigateToLocator?: (filter: EntryFilter) => void;
  onNavigateToSales?: (filter: SalesOrderFilter) => void;
}

type TabKey = "analytics" | "reports";

export function Pulse({ tags, salesOrders, role, onNavigateToLocator, onNavigateToSales }: PulseProps) {
  const canSeeReports = role === "manager";
  const [tab, setTab] = useState<TabKey>("analytics");

  // Defense-in-depth: if Sales somehow lands with tab=reports (e.g. role toggle mid-view), snap back.
  useEffect(() => {
    if (!canSeeReports && tab === "reports") setTab("analytics");
  }, [canSeeReports, tab]);

  // Freshness label for the active tab — computed from the freshest underlying record
  // (Analytics: latest tag.date; Reports: latest tag history event). No polling / sync
  // clock (see helper block above). `nowMs` is captured per-mount via useMemo — matching
  // AnalyticsTab's todayMs convention — since Pulse remounts on each nav visit.
  const nowMs = useMemo(() => new Date().getTime(), []);
  const freshestMs = tab === "analytics" ? latestTagDateMs(tags) : latestHistoryMs(tags);
  const updatedLabel = freshestMs === null ? null : `Updated ${shortRelative(freshestMs, nowMs)}`;

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto" data-onboarding="pulse-page">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Pulse
            </h1>
            <p className="text-sm text-text-sec mt-1">
              {tab === "analytics"
                ? "Inventory flow, species velocity, and yard aging."
                : "Shortage & asset breakdown by species and grade."}
            </p>
          </div>
          {updatedLabel && (
            <span className="text-xs text-text-ter whitespace-nowrap mt-1" title="Freshness of the data feeding this tab">
              {updatedLabel}
            </span>
          )}
        </div>

        <div className="mb-5 border-b border-sage flex gap-1">
          <TabButton label="Analytics" active={tab === "analytics"} onClick={() => setTab("analytics")} />
          {canSeeReports && (
            <TabButton label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} dataOnboarding="pulse-reports-tab" />
          )}
        </div>

        {tab === "analytics" ? (
          <AnalyticsTab tags={tags} onNavigateToLocator={onNavigateToLocator} onNavigateToSales={onNavigateToSales} />
        ) : (
          <ReportsTab tags={tags} salesOrders={salesOrders} />
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick, dataOnboarding }: { label: string; active: boolean; onClick: () => void; dataOnboarding?: string }) {
  return (
    <button
      onClick={onClick}
      data-onboarding={dataOnboarding}
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

// Compact per-chart CSV export affordance — lives in each chart's own header (not a
// page-level export). Disabled + tooltip when the chart has no data, mirroring the
// Reports tab's disabled Export button.
function ChartExportButton({ onClick, disabled, ariaLabel }: { onClick: () => void; disabled: boolean; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "No data to export" : "Export CSV"}
      aria-label={ariaLabel}
      className={[
        "flex items-center justify-center w-7 h-7 rounded-md border bg-white transition-colors",
        disabled
          ? "border-sage/50 text-text-ter opacity-50 cursor-not-allowed"
          : "border-sage text-text-sec hover:border-coral hover:text-coral cursor-pointer",
      ].join(" ")}
    >
      <Download size={14} />
    </button>
  );
}

// Period-over-period delta badge for the FBM chart. `delta` is null when there's no
// prior bucket to compare against; a flat (rounds-to-0) delta also renders the muted
// dash — never a misleading "0%". Up = lime (positive highlight), down = coral (matches
// the shortage badge), flat/no-prior = muted gray.
function TrendDeltaBadge({ delta, period }: { delta: { pct: number; dir: "up" | "down" | "flat" } | null; period: "week" | "month" }) {
  const suffix = period === "week" ? "vs last week" : "vs last month";
  if (!delta || delta.dir === "flat") {
    return (
      <span
        title={delta ? `No change ${suffix}` : `No prior ${period} to compare`}
        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-text-ter bg-[#F3F4F6] rounded-full px-2 py-0.5"
      >
        <Minus size={11} />
      </span>
    );
  }
  const up = delta.dir === "up";
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5",
        up ? "text-lime bg-lime/15" : "text-coral bg-coral/10",
      ].join(" ")}
    >
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {up ? "+" : ""}{delta.pct}% {suffix}
    </span>
  );
}

function AnalyticsTab({
  tags,
  onNavigateToLocator,
  onNavigateToSales,
}: {
  tags: Tag[];
  onNavigateToLocator?: (filter: EntryFilter) => void;
  onNavigateToSales?: (filter: SalesOrderFilter) => void;
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const todayMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  // Chart 1: FBM entered per bucket, from tag.date grouped by week (Monday) or by month.
  // `key` is the raw bucket key (Monday ISO / "YYYY-MM") kept so a bar click can resolve
  // back to the exact set of entry dates in that bucket.
  const trendData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const t of tags) {
      const key = period === "week" ? isoWeekStart(t.date) : t.date.slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + t.fbm);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ key: k, label: period === "week" ? shortDay(k) : shortMonth(k), fbm: v }));
  }, [tags, period]);

  // Period-over-period delta: latest bucket vs the immediately prior one. Null when
  // there's no prior bucket (or its FBM is 0) so the badge shows the muted dash instead
  // of a misleading 0%. Direction is decided on the rounded %, so a sub-0.5% change
  // reads as flat rather than "+0%". Recomputes with the Weekly/Monthly toggle.
  const trendDelta = useMemo<{ pct: number; dir: "up" | "down" | "flat" } | null>(() => {
    if (trendData.length < 2) return null;
    const latest = trendData[trendData.length - 1].fbm;
    const prior = trendData[trendData.length - 2].fbm;
    if (prior <= 0) return null;
    const pct = Math.round(((latest - prior) / prior) * 100);
    return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
  }, [trendData]);

  // Chart 2: Reserved + Shipped FBM per species (grouped bars). Only include species
  // that show up in the current data to keep the chart readable. `species` keeps the
  // full (un-shortened) name so a bar click can filter Sales Orders by it.
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
        species,
        // W.R. Cedar short label to keep the axis readable, matches Dashboard's convention.
        name: species === "Western Red Cedar" ? "W.R. Cedar" : species,
        reserved: v.reserved,
        shipped: v.shipped,
      }))
      .filter((d) => d.reserved > 0 || d.shipped > 0)
      .sort((a, b) => b.reserved + b.shipped - (a.reserved + a.shipped));
  }, [tags]);

  // Chart 3: Available-only tags bucketed by days-in-yard. `min`/`max` are kept so a bar
  // click can re-resolve the exact Available tag IDs in that bucket.
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
      return { label: b.label, count, isAging: b.min >= 91, min: b.min, max: b.max };
    });
  }, [tags, todayMs]);

  const agingMax = Math.max(...agingData.map((d) => d.count), 1);

  // ── Drill-through handlers ──────────────────────────────────────────────────
  // Recharts passes the clicked bar's rectangle item; `.payload` holds the original datum.
  // Zero-value bars have zero height and aren't clickable, so no guard-against-dead-click
  // is needed beyond skipping empty result sets.

  // Chart 1: bar → Stock Locator filtered to every entry date in that week/month bucket.
  const handleTrendClick = (payload: { key?: string } | undefined) => {
    const key = payload?.key;
    if (!key) return;
    const dates = Array.from(
      new Set(
        tags
          .filter((t) => (period === "week" ? isoWeekStart(t.date) : t.date.slice(0, 7)) === key)
          .map((t) => t.date),
      ),
    ).sort();
    if (dates.length === 0) return;
    onNavigateToLocator?.({ dates });
  };

  // Chart 2: Reserved bar → Sales Orders (species + Open/Picked); Shipped bar → (species + Shipped).
  const handleVelocityClick = (species: string | undefined, kind: "reserved" | "shipped") => {
    if (!species) return;
    onNavigateToSales?.({
      species: [species],
      status: kind === "reserved" ? ["Open", "Picked"] : ["Shipped"],
    });
  };

  // Chart 3: bar → Stock Locator filtered to Available tags in that days-in-yard bucket.
  const handleAgingClick = (payload: { min?: number; max?: number; label?: string } | undefined) => {
    if (payload?.min === undefined || payload.max === undefined) return;
    const { min, max, label } = payload;
    const ids = tags
      .filter((t) => {
        if (t.status !== "Available") return false;
        const d = daysInYard(t, todayMs);
        return d >= min && d <= max;
      })
      .map((t) => t.id);
    if (ids.length === 0) return;
    onNavigateToLocator?.({
      status: ["Available"],
      tagIds: ids,
      filterLabel: `${ids.length} Available tag${ids.length === 1 ? "" : "s"} · ${label} in yard`,
    });
  };

  // ── CSV export handlers ─────────────────────────────────────────────────────
  // Reuse the shared csvCell (RFC 4180) / csvFilename / downloadCsv helpers; CRLF
  // line joins, same as the Reports tab export.

  // Chart 1: one row per bucket — ISO bucket key + FBM. Slug tracks the active toggle.
  const handleExportTrend = () => {
    const bucketHeader = period === "week" ? "Week Of" : "Month";
    const lines = [
      [bucketHeader, "FBM"].map(csvCell).join(","),
      ...trendData.map((d) => [d.key, d.fbm].map(csvCell).join(",")),
    ];
    downloadCsv(lines.join("\r\n"), csvFilename(period === "week" ? "fbm_by_week" : "fbm_by_month"));
  };

  // Chart 2: one row per species — full species name + Reserved/Shipped FBM.
  const handleExportVelocity = () => {
    const lines = [
      ["Species", "Reserved FBM", "Shipped FBM"].map(csvCell).join(","),
      ...velocityData.map((d) => [d.species, d.reserved, d.shipped].map(csvCell).join(",")),
    ];
    downloadCsv(lines.join("\r\n"), csvFilename("species_velocity"));
  };

  // Chart 3: one row per bucket (all five, incl. empty) — bucket label, count, and the
  // Available tag IDs in that bucket (re-resolved here, same rule as the drill-through).
  const handleExportAging = () => {
    const available = tags.filter((t) => t.status === "Available");
    const lines = [
      ["Bucket", "Tag Count", "Tag IDs"].map(csvCell).join(","),
      ...AGING_BUCKETS.map((b) => {
        const ids = available
          .filter((t) => {
            const d = daysInYard(t, todayMs);
            return d >= b.min && d <= b.max;
          })
          .map((t) => t.id)
          .sort();
        return [b.label, ids.length, ids.join("; ")].map(csvCell).join(",");
      }),
    ];
    downloadCsv(lines.join("\r\n"), csvFilename("days_in_yard"));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Chart 1: FBM trend */}
      <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-display font-semibold text-text">FBM entered by {period}</div>
            <TrendDeltaBadge delta={trendDelta} period={period} />
          </div>
          <div className="flex items-center gap-2">
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
            <ChartExportButton onClick={handleExportTrend} disabled={trendData.length === 0} ariaLabel="Export FBM by period as CSV" />
          </div>
        </div>
        {trendData.length === 0 ? (
          <div className="text-[13px] text-text-ter py-10 text-center">No entry data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barCategoryGap="30%" accessibilityLayer={false}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} FBM`]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} cursor={{ fill: C.sage, fillOpacity: 0.25 }} />
              <Bar
                dataKey="fbm"
                fill={C.ink}
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                activeBar={{ fillOpacity: 0.8 }}
                onClick={(data) => handleTrendClick((data as unknown as { payload?: { key?: string } }).payload)}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 2 + 3 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-display font-semibold text-text">Species sales velocity (Reserved + Shipped FBM)</div>
            <ChartExportButton onClick={handleExportVelocity} disabled={velocityData.length === 0} ariaLabel="Export species velocity as CSV" />
          </div>
          {velocityData.length === 0 ? (
            <div className="text-[13px] text-text-ter py-10 text-center">No sales activity yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData} barCategoryGap="25%" accessibilityLayer={false}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
                <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()} FBM`, name]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} cursor={{ fill: C.sage, fillOpacity: 0.25 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar
                  dataKey="reserved"
                  name="Reserved"
                  fill={C.lime}
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  activeBar={{ fillOpacity: 0.8 }}
                  onClick={(data) => handleVelocityClick((data as unknown as { payload?: { species?: string } }).payload?.species, "reserved")}
                />
                <Bar
                  dataKey="shipped"
                  name="Shipped"
                  fill={C.ink}
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  activeBar={{ fillOpacity: 0.8 }}
                  onClick={(data) => handleVelocityClick((data as unknown as { payload?: { species?: string } }).payload?.species, "shipped")}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-display font-semibold text-text">Days-in-yard distribution (Available)</div>
            <div className="flex items-center gap-2">
              {agingData.some((d) => d.isAging && d.count > 0) && (
                <div className="text-[11px] text-coral font-semibold flex items-center gap-1">
                  <AlertTriangle size={12} />Aging inventory
                </div>
              )}
              <ChartExportButton onClick={handleExportAging} disabled={agingData.every((d) => d.count === 0)} ariaLabel="Export days-in-yard as CSV" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData} barCategoryGap="30%" accessibilityLayer={false}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.max(agingMax + 1, 3)]} />
              <Tooltip formatter={(v) => [`${v} tag${Number(v) === 1 ? "" : "s"}`]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} cursor={{ fill: C.sage, fillOpacity: 0.25 }} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                activeBar={{ fillOpacity: 0.8 }}
                onClick={(data) => handleAgingClick((data as unknown as { payload?: { min?: number; max?: number; label?: string } }).payload)}
              >
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
