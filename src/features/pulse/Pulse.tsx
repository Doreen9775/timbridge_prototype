import { useEffect, useMemo, useState } from "react";
import { volumeForQty } from "@/lib/products";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ApprovalRequest, EntryFilter, Role, SalesOrder, SalesOrderFilter, Tag } from "@/lib/types";
import { ACTIVE_STATUSES, RANGE_OPTIONS, buildOrderMetrics, inRange, isoToMs, msToIso, resolveRange, startOfTodayMs, type DateRange, type RangeKey } from "@/lib/analytics";
import { ChartExportButton } from "./parts";
import { C, csvCell, csvFilename, downloadCsv } from "./pulseUtils";
import { SalesTab } from "./SalesTab";
import { OverviewTab } from "./OverviewTab";
import { ReportsTab } from "./ReportsTab";
import { InventoryExtras } from "./InventoryExtras";

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
  approvalRequests: ApprovalRequest[];
  role: Role;
  // Drill-through: every chart navigates to the operational page behind its numbers.
  onNavigateToLocator?: (filter: EntryFilter) => void;
  onNavigateToSales?: (filter: SalesOrderFilter) => void;
  onOpenClient?: (clientId: string) => void;
  onOpenSo?: (soId: string) => void;
  onOpenApprovals?: () => void;
}

// Tabs are organised by the question being asked, not by chart-vs-table.
type TabKey = "overview" | "inventory" | "sales" | "reports";

const TAB_BLURB: Record<TabKey, string> = {
  overview: "How the business is doing, and what needs attention today.",
  inventory: "Stock flow, turnover, aging, value and receiving quality.",
  sales: "What sold, who bought it, and where orders are held up.",
  reports: "Exportable reports for your role — orders, clients, stock and approvals.",
};

export function Pulse({ tags, salesOrders, approvalRequests, role, onNavigateToLocator, onNavigateToSales, onOpenClient, onOpenSo, onOpenApprovals }: PulseProps) {
  // Reports are role-aware (see ReportsTab): Manager and Sales each get their own library.
  const canSeeReports = role !== "floor";
  const [tab, setTab] = useState<TabKey>("overview");

  // Global period — one picker drives every period-based figure on the page. Cards that
  // show a point-in-time figure (aging, pending queues) are labelled "As of today".
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const todayMs = useMemo(() => startOfTodayMs(), []);
  const range = useMemo(() => resolveRange(rangeKey, todayMs), [rangeKey, todayMs]);

  // Defense-in-depth: if Sales somehow lands with tab=reports (e.g. role toggle mid-view), snap back.
  useEffect(() => {
    if (!canSeeReports && tab === "reports") setTab("overview");
  }, [canSeeReports, tab]);

  // Freshness label for the active tab — computed from the freshest underlying record
  // (Analytics: latest tag.date; Reports: latest tag history event). No polling / sync
  // clock (see helper block above). `nowMs` is captured per-mount via useMemo — matching
  // AnalyticsTab's todayMs convention — since Pulse remounts on each nav visit.
  const nowMs = useMemo(() => new Date().getTime(), []);
  const freshestMs = tab === "inventory" ? latestTagDateMs(tags) : latestHistoryMs(tags);
  const updatedLabel = freshestMs === null ? null : `Updated ${shortRelative(freshestMs, nowMs)}`;

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto" data-onboarding="pulse-page">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Pulse
            </h1>
            <p className="text-sm text-text-sec mt-1">{TAB_BLURB[tab]}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {(
              <div className="flex bg-white border border-sage rounded-full p-[3px] gap-[2px]" role="group" aria-label="Reporting period" data-onboarding="pulse-period">
                {RANGE_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setRangeKey(o.key)}
                    title={o.label}
                    aria-pressed={rangeKey === o.key}
                    className={[
                      "px-3 py-[5px] rounded-full border-0 cursor-pointer text-xs font-medium",
                      rangeKey === o.key ? "bg-ink text-white" : "bg-transparent text-text-sec hover:text-text",
                    ].join(" ")}
                  >
                    {o.short}
                  </button>
                ))}
              </div>
            )}
            {updatedLabel && (
              <span className="text-xs text-text-ter whitespace-nowrap" title="Freshness of the data feeding this tab">
                {range.label} · {updatedLabel}
              </span>
            )}
          </div>
        </div>

        <div className="mb-5 border-b border-sage flex gap-1">
          <TabButton label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabButton label="Inventory" active={tab === "inventory"} onClick={() => setTab("inventory")} />
          <TabButton label="Sales" active={tab === "sales"} onClick={() => setTab("sales")} dataOnboarding="pulse-sales-tab" />
          {canSeeReports && (
            <TabButton label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} dataOnboarding="pulse-reports-tab" />
          )}
        </div>

        {tab === "overview" && (
          <OverviewTab
            tags={tags}
            salesOrders={salesOrders}
            approvalRequests={approvalRequests}
            role={role}
            range={range}
            todayMs={todayMs}
            onNavigateToLocator={onNavigateToLocator}
            onNavigateToSales={onNavigateToSales}
            onOpenApprovals={onOpenApprovals}
            onOpenTab={setTab}
          />
        )}
        {tab === "inventory" && (
          <AnalyticsTab tags={tags} salesOrders={salesOrders} role={role} range={range} onNavigateToLocator={onNavigateToLocator} onNavigateToSales={onNavigateToSales} />
        )}
        {tab === "sales" && (
          <SalesTab
            tags={tags}
            salesOrders={salesOrders}
            approvalRequests={approvalRequests}
            role={role}
            range={range}
            todayMs={todayMs}
            onNavigateToSales={onNavigateToSales}
            onOpenClient={onOpenClient}
            onOpenSo={onOpenSo}
            onOpenApprovals={onOpenApprovals}
          />
        )}
        {tab === "reports" && canSeeReports && <ReportsTab tags={tags} salesOrders={salesOrders} approvalRequests={approvalRequests} role={role} range={range} todayMs={todayMs} />}
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

// Period-over-period delta badge for the FBM chart. `delta` is null when there's no
// prior bucket to compare against; a flat (rounds-to-0) delta also renders the muted
// dash — never a misleading "0%". Up = lime (positive highlight), down = coral (matches
// the shortage badge), flat/no-prior = muted gray.
function TrendDeltaBadge({ delta, period }: { delta: { pct: number; dir: "up" | "down" | "flat" } | null; period: "week" | "month" }) {
  const suffix = period === "week" ? "last full week vs prior" : "last full month vs prior";
  if (!delta || delta.dir === "flat") {
    return (
      <span
        title={delta ? `No change · ${suffix}` : `Not enough complete ${period}s to compare`}
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
      {up ? "+" : ""}{delta.pct}% · {suffix}
    </span>
  );
}

function AnalyticsTab({
  tags,
  salesOrders,
  role,
  range,
  onNavigateToLocator,
  onNavigateToSales,
}: {
  tags: Tag[];
  salesOrders: SalesOrder[];
  role: Role;
  range: DateRange;
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
      if (!inRange(isoToMs(t.date), range)) continue; // global period picker
      const key = period === "week" ? isoWeekStart(t.date) : t.date.slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + t.volume);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ key: k, label: period === "week" ? shortDay(k) : shortMonth(k), fbm: v }));
  }, [tags, period, range]);

  // Period-over-period delta: the last *complete* bucket vs the one before it. The
  // bucket containing today is still filling up, so comparing it would always read as a
  // collapse early in the week/month. Null when there aren't two complete buckets (or the
  // earlier one is 0) so the badge shows the muted dash instead of a misleading 0%.
  const trendDelta = useMemo<{ pct: number; dir: "up" | "down" | "flat" } | null>(() => {
    const todayIso = msToIso(todayMs);
    const currentKey = period === "week" ? isoWeekStart(todayIso) : todayIso.slice(0, 7);
    const complete = trendData.filter((d) => d.key !== currentKey);
    if (complete.length < 2) return null;
    const latest = complete[complete.length - 1].fbm;
    const prior = complete[complete.length - 2].fbm;
    if (prior <= 0) return null;
    const pct = Math.round(((latest - prior) / prior) * 100);
    return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
  }, [trendData, period, todayMs]);

  // Chart 2: FBM per species, read from Sales Orders (not tag status) so it agrees with
  // the Sales tab: "reserved" = on confirmed orders still to ship (live), "shipped" =
  // shipped within the period. Order ids are kept per bar for the drill-through.
  const velocityData = useMemo(() => {
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const bySpecies = new Map<string, { reserved: number; shipped: number; reservedIds: Set<string>; shippedIds: Set<string> }>();
    for (const m of buildOrderMetrics(salesOrders, tags)) {
      const active = ACTIVE_STATUSES.includes(m.so.status);
      const shippedInPeriod = m.so.status === "Shipped" && inRange(m.shippedMs ?? m.orderMs, range);
      if (!active && !shippedInPeriod) continue;
      for (const li of m.so.lineItems) {
        const t = tagById.get(li.tagId);
        if (!t) continue;
        const g = bySpecies.get(t.species) ?? { reserved: 0, shipped: 0, reservedIds: new Set<string>(), shippedIds: new Set<string>() };
        const fbm = volumeForQty(t, li.qty);
        if (active) {
          g.reserved += fbm;
          g.reservedIds.add(m.so.id);
        } else {
          g.shipped += fbm;
          g.shippedIds.add(m.so.id);
        }
        bySpecies.set(t.species, g);
      }
    }
    return Array.from(bySpecies.entries())
      .map(([species, v]) => ({
        species,
        // W.R. Cedar short label to keep the axis readable, matches Dashboard's convention.
        name: species === "Western Red Cedar" ? "W.R. Cedar" : species,
        reserved: Math.round(v.reserved),
        shipped: Math.round(v.shipped),
        reservedIds: [...v.reservedIds],
        shippedIds: [...v.shippedIds],
      }))
      .sort((a, b) => b.reserved + b.shipped - (a.reserved + a.shipped));
  }, [tags, salesOrders, range]);

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

  // Chart 2: bar → Sales Orders gated to exactly the orders behind it.
  const handleVelocityClick = (species: string | undefined, kind: "reserved" | "shipped") => {
    const row = velocityData.find((d) => d.species === species);
    const ids = row ? (kind === "reserved" ? row.reservedIds : row.shippedIds) : [];
    if (!species || ids.length === 0) return;
    onNavigateToSales?.({
      soIds: ids,
      filterLabel: kind === "reserved" ? `${species} · ${ids.length} order${ids.length === 1 ? "" : "s"} still to ship` : `${species} · ${ids.length} order${ids.length === 1 ? "" : "s"} shipped · ${range.label.toLowerCase()}`,
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
      ["Species", "On Order FBM", "Shipped FBM"].map(csvCell).join(","),
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
          <div className="text-[13px] text-text-ter py-10 text-center">No stock entered in this period.</div>
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
            <div>
              <div className="text-[13px] font-display font-semibold text-text">Species sales velocity</div>
              <div className="text-[11px] text-text-ter mt-0.5">FBM on order now vs shipped · {range.label.toLowerCase()} · from Sales Orders</div>
            </div>
            <ChartExportButton onClick={handleExportVelocity} disabled={velocityData.length === 0} ariaLabel="Export species velocity as CSV" />
          </div>
          {velocityData.length === 0 ? (
            <div className="text-[13px] text-text-ter py-10 text-center">No orders on the books or shipped in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData} barCategoryGap="25%" accessibilityLayer={false}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
                <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()} FBM`, name]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} cursor={{ fill: C.sage, fillOpacity: 0.25 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar
                  dataKey="reserved"
                  name="On order (Open + Picked)"
                  fill={C.lime}
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  activeBar={{ fillOpacity: 0.8 }}
                  onClick={(data) => handleVelocityClick((data as unknown as { payload?: { species?: string } }).payload?.species, "reserved")}
                />
                <Bar
                  dataKey="shipped"
                  name="Shipped in period"
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

      <InventoryExtras tags={tags} salesOrders={salesOrders} role={role} range={range} todayMs={todayMs} onNavigateToLocator={onNavigateToLocator} />
    </div>
  );
}
