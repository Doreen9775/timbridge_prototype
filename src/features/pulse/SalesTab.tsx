import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { ApprovalRequest, Role, SalesOrder, SalesOrderFilter, SalesOrderStatus, Tag } from "@/lib/types";
import {
  ACTIVE_STATUSES, DAY_MS, buildOrderMetrics, buildSalesTrend, hasFullPrevPeriod, fmtMoney, fmtMoneyCompact, fmtPct, inPrevRange, inRange,
  parseStampMs, pctDelta,
  type DateRange, type OrderMetrics,
} from "@/lib/analytics";
import { useClients } from "@/hooks/useClients";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { Button } from "@/components/shared/Button";
import { Card, ChartExportButton, EmptyState, KpiCard, ShareBar, SnapshotTag, Stat } from "./parts";
import { C, TOOLTIP_STYLE, exportRows } from "./pulseUtils";

interface SalesTabProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  approvalRequests: ApprovalRequest[];
  role: Role;
  range: DateRange;
  todayMs: number;
  onNavigateToSales?: (filter: SalesOrderFilter) => void;
  onOpenClient?: (clientId: string) => void;
  onOpenSo?: (soId: string) => void;
  onOpenApprovals?: () => void;
}

const sum = (rows: OrderMetrics[], pick: (m: OrderMetrics) => number) => rows.reduce((s, m) => s + pick(m), 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const PIPELINE: { status: SalesOrderStatus; hint: string; color: string }[] = [
  { status: "Draft", hint: "Not yet confirmed", color: C.sage },
  { status: "Open", hint: "Confirmed, tags reserved", color: C.textTer },
  { status: "Picked", hint: "Pulled, awaiting truck", color: C.lime },
  { status: "Shipped", hint: "Out the gate", color: C.ink },
];

export function SalesTab({ tags, salesOrders, approvalRequests, role, range, todayMs, onNavigateToSales, onOpenClient, onOpenSo, onOpenApprovals }: SalesTabProps) {
  const { clientById, getClientName } = useClients();
  const isManager = role === "manager";

  const metrics = useMemo(() => buildOrderMetrics(salesOrders, tags), [salesOrders, tags]);
  // Only compare against the previous period when the order history fully covers it.
  const hasPrev = hasFullPrevPeriod(range, metrics.length ? Math.min(...metrics.map((m) => m.orderMs)) : null);

  // Everything placed in the period (any status) feeds the pipeline; only booked orders
  // (Open / Picked / Shipped) count as sales.
  const placed = useMemo(() => metrics.filter((m) => inRange(m.orderMs, range)), [metrics, range]);
  const booked = useMemo(() => placed.filter((m) => m.booked), [placed]);
  const prevBooked = useMemo(() => metrics.filter((m) => m.booked && inPrevRange(m.orderMs, range)), [metrics, range]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const net = sum(booked, (m) => m.net);
    const prevNet = sum(prevBooked, (m) => m.net);
    const gross = sum(booked, (m) => m.gross);
    const prevGross = sum(prevBooked, (m) => m.gross);
    const discount = gross - net;
    const prevDiscount = prevGross - prevNet;
    // Shipped FBM is attributed to the ship date, falling back to the order date when a
    // shipped order carries no ship stamp.
    const shippedIn = (pred: (ms: number) => boolean) =>
      sum(metrics.filter((m) => m.so.status === "Shipped" && pred(m.shippedMs ?? m.orderMs)), (m) => m.fbm);
    const withCost = booked.filter((m) => m.costKnown && m.net > 0);
    const prevWithCost = prevBooked.filter((m) => m.costKnown && m.net > 0);
    const margin = (rows: OrderMetrics[]) => {
      const n = sum(rows, (m) => m.net);
      return n > 0 ? (n - sum(rows, (m) => m.cost)) / n : null;
    };
    return {
      net, prevNet,
      orders: booked.length, prevOrders: prevBooked.length,
      aov: booked.length ? net / booked.length : 0,
      prevAov: prevBooked.length ? prevNet / prevBooked.length : 0,
      shippedFbm: shippedIn((ms) => inRange(ms, range)),
      prevShippedFbm: shippedIn((ms) => inPrevRange(ms, range)),
      discount, prevDiscount,
      discountRate: gross > 0 ? discount / gross : 0,
      margin: margin(withCost), prevMargin: margin(prevWithCost),
    };
  }, [booked, prevBooked, metrics, range]);

  const d = (cur: number, prev: number) => (hasPrev ? pctDelta(cur, prev) : null);

  // ── Trend: net booked sales per week (≤ ~3 months) or per month ─────────────
  const trend = useMemo(() => {
    const first = range.start ?? (metrics.length ? Math.min(...metrics.map((m) => m.orderMs)) : todayMs);
    return buildSalesTrend(booked, first, todayMs);
  }, [booked, metrics, range.start, todayMs]);

  const handleTrendClick = (payload: { ids?: string[]; full?: string } | undefined) => {
    if (!payload?.ids?.length) return;
    onNavigateToSales?.({ soIds: payload.ids, filterLabel: `${plural(payload.ids.length, "order")} placed · ${payload.full}` });
  };

  // ── Pipeline: orders placed in the period, by where they stand today ────────
  const pipeline = useMemo(() => {
    const stages = PIPELINE.map((p) => {
      const rows = placed.filter((m) => m.so.status === p.status);
      return { ...p, count: rows.length, net: sum(rows, (m) => m.net), ids: rows.map((m) => m.so.id) };
    });
    const cancelled = placed.filter((m) => m.so.status === "Cancelled");
    return {
      stages,
      max: Math.max(...stages.map((s) => s.net), 1),
      cancelled: { count: cancelled.length, net: sum(cancelled, (m) => m.net), ids: cancelled.map((m) => m.so.id) },
    };
  }, [placed]);

  const openStage = (status: SalesOrderStatus, ids: string[]) => {
    if (ids.length === 0) return;
    onNavigateToSales?.({ soIds: ids, filterLabel: `${plural(ids.length, `${status} order`)} · ${range.label.toLowerCase()}` });
  };

  // ── Clients + territories ───────────────────────────────────────────────────
  const clientRows = useMemo(() => {
    const byClient = new Map<string, { net: number; orders: number; fbm: number }>();
    for (const m of booked) {
      const g = byClient.get(m.so.clientId) ?? { net: 0, orders: 0, fbm: 0 };
      g.net += m.net;
      g.orders += 1;
      g.fbm += m.fbm;
      byClient.set(m.so.clientId, g);
    }
    return [...byClient.entries()]
      .map(([id, v]) => ({ id, name: getClientName(id), territory: clientById.get(id)?.territory ?? "—", ...v }))
      .sort((a, b) => b.net - a.net);
  }, [booked, clientById, getClientName]);

  const territoryRows = useMemo(() => {
    const byTerritory = new Map<string, { net: number; orders: number }>();
    for (const c of clientRows) {
      const g = byTerritory.get(c.territory) ?? { net: 0, orders: 0 };
      g.net += c.net;
      g.orders += c.orders;
      byTerritory.set(c.territory, g);
    }
    return [...byTerritory.entries()].map(([territory, v]) => ({ territory, ...v })).sort((a, b) => b.net - a.net);
  }, [clientRows]);

  const TOP_N = 6;
  const topClients = clientRows.slice(0, TOP_N);
  const totalNet = kpi.net;

  // ── Discounts & approvals ───────────────────────────────────────────────────
  const approvals = useMemo(() => {
    const inPeriod = approvalRequests.filter((r) => inRange(parseStampMs(r.createdAt), range));
    const resolved = inPeriod.filter((r) => r.status !== "Pending");
    const approved = resolved.filter((r) => r.status === "Approved").length;
    const hours = resolved
      .map((r) => {
        const a = parseStampMs(r.createdAt);
        const b = r.resolvedAt ? parseStampMs(r.resolvedAt) : null;
        return a !== null && b !== null ? (b - a) / 3_600_000 : null;
      })
      .filter((h): h is number => h !== null);
    return {
      requested: inPeriod.length,
      resolved: resolved.length,
      approvalRate: resolved.length ? approved / resolved.length : null,
      avgHours: hours.length ? hours.reduce((s, h) => s + h, 0) / hours.length : null,
      // Pending is a live queue, not a period figure.
      pendingNow: approvalRequests.filter((r) => r.status === "Pending").length,
    };
  }, [approvalRequests, range]);

  const discountedOrders = booked.filter((m) => m.discount > 0.005).length;

  // ── Fulfilment ──────────────────────────────────────────────────────────────
  const fulfilment = useMemo(() => {
    const shipped = metrics.filter((m) => m.so.status === "Shipped" && m.shippedMs !== null && inRange(m.shippedMs, range));
    const dayOf = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
    const withDue = shipped.filter((m) => m.dueMs !== null);
    const onTime = withDue.filter((m) => dayOf(m.shippedMs!) <= m.dueMs!).length;
    const leadDays = shipped.map((m) => (dayOf(m.shippedMs!) - m.orderMs) / DAY_MS);
    // Overdue is a live list: confirmed orders whose expected ship date has passed.
    const overdue = metrics
      .filter((m) => ACTIVE_STATUSES.includes(m.so.status) && m.dueMs !== null && m.dueMs < todayMs)
      .map((m) => ({ ...m, daysLate: Math.round((todayMs - m.dueMs!) / DAY_MS) }))
      .sort((a, b) => b.daysLate - a.daysLate);
    return {
      shippedCount: shipped.length,
      onTimeRate: withDue.length ? onTime / withDue.length : null,
      late: withDue.length - onTime,
      avgLead: leadDays.length ? leadDays.reduce((s, n) => s + n, 0) / leadDays.length : null,
      overdue,
    };
  }, [metrics, range, todayMs]);

  // ── Exports ─────────────────────────────────────────────────────────────────
  const exportTrend = () =>
    exportRows(trend.monthly ? "sales_by_month" : "sales_by_week", [trend.monthly ? "Month" : "Week Of", "Net Sales (USD)", "Orders"], trend.rows.map((r) => [r.label, r.net, r.orders]));
  const exportClients = () =>
    exportRows("sales_by_client", ["Client", "Territory", "Orders", "Net Sales (USD)", "FBM", "Share"], clientRows.map((c) => [c.name, c.territory, c.orders, Math.round(c.net), c.fbm, totalNet > 0 ? fmtPct(c.net / totalNet) : "0%"]));

  const periodHint = range.label;

  return (
    <div className="flex flex-col gap-5">
      {/* KPI row */}
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${isManager ? "xl:grid-cols-6" : "xl:grid-cols-5"}`} data-onboarding="pulse-sales-kpis">
        <KpiCard label="Booked sales" value={fmtMoney(kpi.net)} sub="Net of discounts" delta={d(kpi.net, kpi.prevNet)} />
        <KpiCard label="Orders" value={String(kpi.orders)} sub="Open, Picked or Shipped" delta={d(kpi.orders, kpi.prevOrders)} />
        <KpiCard label="Avg. order" value={fmtMoney(kpi.aov)} sub="Booked sales ÷ orders" delta={d(kpi.aov, kpi.prevAov)} />
        <KpiCard label="FBM shipped" value={kpi.shippedFbm.toLocaleString()} sub="By ship date" delta={d(kpi.shippedFbm, kpi.prevShippedFbm)} />
        <KpiCard label="Discount given" value={fmtMoney(kpi.discount)} sub={`${fmtPct(kpi.discountRate)} of list value`} delta={d(kpi.discount, kpi.prevDiscount)} neutralDelta />
        {/* Margin is finance data — Manager only, never rendered for Sales. */}
        {isManager && (
          <KpiCard
            label="Gross margin"
            value={kpi.margin === null ? "—" : fmtPct(kpi.margin)}
            sub={hasPrev && kpi.prevMargin !== null ? `Prev. period ${fmtPct(kpi.prevMargin)}` : "Orders with known cost"}
          />
        )}
      </div>

      {/* Trend + pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-2"
          title={`Booked sales by ${trend.monthly ? "month" : "week"}`}
          hint={`${periodHint} · by order date · click a bar to see its orders`}
          actions={<ChartExportButton onClick={exportTrend} disabled={booked.length === 0} ariaLabel="Export booked sales trend as CSV" />}
        >
          {booked.length === 0 ? (
            <EmptyState>No booked orders in this period.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trend.rows} barCategoryGap="28%" accessibilityLayer={false}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoneyCompact(Number(v))} width={48} />
                <Tooltip
                  formatter={(v, _n, item) => [`${fmtMoney(Number(v))} · ${plural((item?.payload as { orders?: number } | undefined)?.orders ?? 0, "order")}`, "Net sales"]}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: C.sage, fillOpacity: 0.25 }}
                />
                <Bar
                  dataKey="net"
                  fill={C.ink}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  activeBar={{ fillOpacity: 0.8 }}
                  onClick={(data) => handleTrendClick((data as unknown as { payload?: { ids?: string[]; full?: string } }).payload)}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Order pipeline" hint={`Orders placed · ${periodHint.toLowerCase()} · by current status`}>
          {placed.length === 0 ? (
            <EmptyState>No orders placed in this period.</EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {pipeline.stages.map((s) => (
                <button
                  key={s.status}
                  type="button"
                  onClick={() => openStage(s.status, s.ids)}
                  disabled={s.count === 0}
                  title={s.count === 0 ? undefined : `View ${plural(s.count, `${s.status} order`)}`}
                  className={`text-left bg-transparent border-0 p-0 w-full group ${s.count === 0 ? "cursor-default opacity-60" : "cursor-pointer"}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <SOStatusPill status={s.status} />
                      <span className="text-[11px] text-text-ter truncate">{s.hint}</span>
                    </div>
                    <div className="text-[12px] tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-ink group-hover:text-coral">{fmtMoney(s.net)}</span>
                      <span className="text-text-ter"> · {s.count}</span>
                    </div>
                  </div>
                  <ShareBar ratio={s.net / pipeline.max} color={s.color} />
                </button>
              ))}
              <div className="border-t border-[#F3F4F6] pt-3 flex items-center justify-between text-[12px]">
                <button
                  type="button"
                  onClick={() => openStage("Cancelled", pipeline.cancelled.ids)}
                  disabled={pipeline.cancelled.count === 0}
                  className={`flex items-center gap-2 bg-transparent border-0 p-0 ${pipeline.cancelled.count === 0 ? "cursor-default" : "cursor-pointer hover:underline"}`}
                >
                  <SOStatusPill status="Cancelled" />
                  <span className="text-text-sec">{plural(pipeline.cancelled.count, "order")}</span>
                </button>
                <span className="text-text-ter tabular-nums">{fmtMoney(pipeline.cancelled.net)} lost</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Clients + territories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-2"
          title="Top clients"
          hint={`Booked sales · ${periodHint.toLowerCase()} · click a client to open its profile`}
          actions={<ChartExportButton onClick={exportClients} disabled={clientRows.length === 0} ariaLabel="Export sales by client as CSV" />}
        >
          {topClients.length === 0 ? (
            <EmptyState>No client sales in this period.</EmptyState>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-sage">
                  {["Client", "Territory", "Orders", "Net sales", "Share"].map((h, i) => (
                    <th key={h} className={`px-2 pb-2 text-text-sec font-medium text-xs whitespace-nowrap ${i === 2 || i === 3 ? "text-right" : "text-left"} ${i === 4 ? "w-[22%]" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topClients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onOpenClient?.(c.id)}
                    className="border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-sage/15"
                  >
                    <td className="px-2 py-2.5 font-semibold text-ink">{c.name}</td>
                    <td className="px-2 py-2.5 text-text-sec whitespace-nowrap">{c.territory}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-text-sec">{c.orders}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink">{fmtMoney(c.net)}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <ShareBar ratio={totalNet > 0 ? c.net / totalNet : 0} />
                        <span className="text-[11px] text-text-ter tabular-nums w-9 text-right">{totalNet > 0 ? `${Math.round((c.net / totalNet) * 100)}%` : "0%"}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {clientRows.length > TOP_N && (
            <div className="text-[11px] text-text-ter mt-3">
              Showing the top {TOP_N} of {clientRows.length} clients — export for the full list.
            </div>
          )}
        </Card>

        <Card title="Sales by territory" hint={`Booked sales · ${periodHint.toLowerCase()}`}>
          {territoryRows.length === 0 ? (
            <EmptyState>No sales in this period.</EmptyState>
          ) : (
            <div className="flex flex-col gap-3.5">
              {territoryRows.map((t) => (
                <div key={t.territory}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-text font-medium">{t.territory}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold text-ink">{fmtMoney(t.net)}</span>
                      <span className="text-text-ter"> · {t.orders}</span>
                    </span>
                  </div>
                  <ShareBar ratio={totalNet > 0 ? t.net / totalNet : 0} color={C.sage} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Discounts & approvals + fulfilment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Discounts & approvals" hint={periodHint}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Discount given" value={fmtMoney(kpi.discount)} sub={`${fmtPct(kpi.discountRate)} of list`} />
            <Stat label="Discounted orders" value={`${discountedOrders} of ${booked.length}`} />
            <Stat
              label="Approval rate"
              value={approvals.approvalRate === null ? "—" : fmtPct(approvals.approvalRate)}
              sub={approvals.resolved ? `${plural(approvals.resolved, "request")} decided` : "No decisions yet"}
            />
            <Stat
              label="Avg. decision time"
              value={approvals.avgHours === null ? "—" : approvals.avgHours >= 24 ? `${(approvals.avgHours / 24).toFixed(1)} d` : `${approvals.avgHours.toFixed(1)} h`}
              sub="Request → decision"
            />
          </div>
          <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-text-sec">
              <SnapshotTag />
              <span>
                <span className={`font-semibold ${approvals.pendingNow > 0 ? "text-coral" : "text-ink"}`}>{approvals.pendingNow}</span> pending {approvals.pendingNow === 1 ? "request" : "requests"}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={onOpenApprovals} rightIcon={<ChevronRight size={13} />}>
              {isManager ? "Review queue" : "My requests"}
            </Button>
          </div>
        </Card>

        <Card title="Fulfilment" hint={`Orders shipped · ${periodHint.toLowerCase()}`}>
          <div className="grid grid-cols-3 gap-4">
            <Stat
              label="On-time shipping"
              value={fulfilment.onTimeRate === null ? "—" : fmtPct(fulfilment.onTimeRate)}
              sub={fulfilment.onTimeRate === null ? "No dated shipments" : fulfilment.late > 0 ? `${fulfilment.late} shipped late` : "None late"}
            />
            <Stat label="Order → ship" value={fulfilment.avgLead === null ? "—" : `${fulfilment.avgLead.toFixed(1)} d`} sub="Average lead time" />
            <Stat label="Orders shipped" value={String(fulfilment.shippedCount)} />
          </div>
          <div className="mt-4 pt-3 border-t border-[#F3F4F6]">
            <div className="flex items-center gap-2 mb-2">
              <SnapshotTag />
              <span className={`text-[12px] font-semibold flex items-center gap-1 ${fulfilment.overdue.length > 0 ? "text-coral" : "text-text-sec"}`}>
                {fulfilment.overdue.length > 0 && <AlertTriangle size={12} />}
                {fulfilment.overdue.length === 0 ? "No overdue orders" : `${plural(fulfilment.overdue.length, "order")} past expected ship date`}
              </span>
            </div>
            {fulfilment.overdue.slice(0, 4).map((m) => (
              <button
                key={m.so.id}
                type="button"
                onClick={() => onOpenSo?.(m.so.id)}
                className="w-full flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-md bg-transparent border-0 cursor-pointer hover:bg-sage/15 text-[12px] text-left"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold text-ink">{m.so.id}</span>
                  <span className="text-text-sec truncate">{getClientName(m.so.clientId)}</span>
                  <SOStatusPill status={m.so.status} />
                </span>
                <span className="text-coral font-semibold whitespace-nowrap">{m.daysLate}d late</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
