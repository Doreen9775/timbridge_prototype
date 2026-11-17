import { useMemo } from "react";
import { volumeForQty } from "@/lib/products";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, ChevronRight, CircleCheck, Clock, Hourglass, PackageX, ShieldAlert, type LucideIcon } from "lucide-react";
import type { ApprovalRequest, EntryFilter, Role, SalesOrder, SalesOrderFilter, Tag, TagStatus } from "@/lib/types";
import {
  ACTIVE_STATUSES, AGING_THRESHOLD_DAYS, buildOrderMetrics, buildSalesTrend, hasFullPrevPeriod, buildShortageRows, daysInYard, fmtMoney, fmtMoneyCompact,
  inPrevRange, inRange, inventoryValue, pctDelta,
  type DateRange, type OrderMetrics,
} from "@/lib/analytics";
import { Button } from "@/components/shared/Button";
import { Card, EmptyState, KpiCard, ShareBar, SnapshotTag } from "./parts";
import { C, TOOLTIP_STYLE } from "./pulseUtils";

interface OverviewTabProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  approvalRequests: ApprovalRequest[];
  role: Role;
  range: DateRange;
  todayMs: number;
  onNavigateToLocator?: (filter: EntryFilter) => void;
  onNavigateToSales?: (filter: SalesOrderFilter) => void;
  onOpenApprovals?: () => void;
  onOpenTab: (tab: "inventory" | "sales" | "reports") => void;
}

const sum = (rows: OrderMetrics[], pick: (m: OrderMetrics) => number) => rows.reduce((s, m) => s + pick(m), 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// On-hand statuses, in lifecycle order, with the unified status colors (see StatusBadge).
const ON_HAND: { status: TagStatus; color: string }[] = [
  { status: "Pending", color: C.textTer },
  { status: "Received", color: C.textSec },
  { status: "Available", color: C.sage },
  { status: "Reserved", color: C.lime },
  { status: "Discrepancy", color: C.coral },
];

export function OverviewTab({ tags, salesOrders, approvalRequests, role, range, todayMs, onNavigateToLocator, onNavigateToSales, onOpenApprovals, onOpenTab }: OverviewTabProps) {
  const isManager = role === "manager";
  const d = (cur: number, prev: number) => (hasPrev ? pctDelta(cur, prev) : null);

  const metrics = useMemo(() => buildOrderMetrics(salesOrders, tags), [salesOrders, tags]);
  // Only compare against the previous period when the order history fully covers it.
  const hasPrev = hasFullPrevPeriod(range, metrics.length ? Math.min(...metrics.map((m) => m.orderMs)) : null);
  const booked = useMemo(() => metrics.filter((m) => m.booked && inRange(m.orderMs, range)), [metrics, range]);
  const prevBooked = useMemo(() => metrics.filter((m) => m.booked && inPrevRange(m.orderMs, range)), [metrics, range]);

  // ── Period KPIs (same definitions as the Sales tab) ─────────────────────────
  const net = sum(booked, (m) => m.net);
  const prevNet = sum(prevBooked, (m) => m.net);
  const shippedFbm = (pred: (ms: number) => boolean) =>
    sum(metrics.filter((m) => m.so.status === "Shipped" && pred(m.shippedMs ?? m.orderMs)), (m) => m.volume);
  const fbmShipped = shippedFbm((ms) => inRange(ms, range));
  const prevFbmShipped = shippedFbm((ms) => inPrevRange(ms, range));

  // ── Snapshot figures ────────────────────────────────────────────────────────
  const snapshot = useMemo(() => {
    const available = tags.filter((t) => t.status === "Available");
    const active = metrics.filter((m) => ACTIVE_STATUSES.includes(m.so.status));
    return {
      availableFbm: available.reduce((s, t) => s + t.volume, 0),
      availableCount: available.length,
      activeNet: sum(active, (m) => m.net),
      activeIds: active.map((m) => m.so.id),
      value: inventoryValue(tags),
    };
  }, [tags, metrics]);

  // ── Needs attention (all live, none period-based) ───────────────────────────
  const attention = useMemo(() => {
    const shortages = buildShortageRows(tags, salesOrders).filter((r) => r.shortage);
    const overdue = metrics.filter((m) => ACTIVE_STATUSES.includes(m.so.status) && m.dueMs !== null && m.dueMs < todayMs);
    const aging = tags.filter((t) => t.status === "Available" && daysInYard(t, todayMs) >= AGING_THRESHOLD_DAYS);
    const discrepancies = tags.filter((t) => t.status === "Discrepancy");
    const pending = approvalRequests.filter((r) => r.status === "Pending");
    return { shortages, overdue, aging, discrepancies, pending };
  }, [tags, salesOrders, metrics, approvalRequests, todayMs]);

  const attentionRows: { key: string; Icon: LucideIcon; count: number; label: string; detail: string; action: string; onClick: () => void }[] = [
    {
      key: "shortage",
      Icon: PackageX,
      count: attention.shortages.length,
      label: attention.shortages.length === 1 ? "Shortage" : "Shortages",
      detail: attention.shortages.length
        ? attention.shortages.slice(0, 3).map((r) => `${r.species} ${r.grade}`).join(", ") + (attention.shortages.length > 3 ? "…" : "")
        : "Every ordered species/grade still has stock to sell",
      action: "Open report",
      onClick: () => onOpenTab("reports"),
    },
    {
      key: "overdue",
      Icon: Clock,
      count: attention.overdue.length,
      label: attention.overdue.length === 1 ? "Order past ship date" : "Orders past ship date",
      detail: attention.overdue.length ? attention.overdue.map((m) => m.so.id).slice(0, 4).join(", ") : "All confirmed orders are on schedule",
      action: "View orders",
      onClick: () => onNavigateToSales?.({ soIds: attention.overdue.map((m) => m.so.id), filterLabel: `${plural(attention.overdue.length, "order")} past expected ship date` }),
    },
    {
      key: "aging",
      Icon: Hourglass,
      count: attention.aging.length,
      label: `Tag${attention.aging.length === 1 ? "" : "s"} ${AGING_THRESHOLD_DAYS}+ days in yard`,
      detail: attention.aging.length ? `${attention.aging.reduce((s, t) => s + t.volume, 0).toLocaleString()} FBM still Available` : "No slow-moving stock",
      action: "View tags",
      onClick: () =>
        onNavigateToLocator?.({
          status: ["Available"],
          tagIds: attention.aging.map((t) => t.id),
          filterLabel: `${plural(attention.aging.length, "Available tag")} · ${AGING_THRESHOLD_DAYS}+ days in yard`,
        }),
    },
    {
      key: "discrepancy",
      Icon: ShieldAlert,
      count: attention.discrepancies.length,
      label: attention.discrepancies.length === 1 ? "Discrepancy to resolve" : "Discrepancies to resolve",
      detail: attention.discrepancies.length ? "Flagged on arrival — not sellable until cleared" : "Nothing flagged on arrival",
      action: "View tags",
      onClick: () => onNavigateToLocator?.({ status: ["Discrepancy"] }),
    },
    {
      key: "approvals",
      Icon: AlertTriangle,
      count: attention.pending.length,
      label: attention.pending.length === 1 ? "Approval waiting" : "Approvals waiting",
      detail: attention.pending.length ? (isManager ? "Sales is waiting on your decision" : "Awaiting a Manager decision") : "No requests in the queue",
      action: isManager ? "Review" : "My requests",
      onClick: () => onOpenApprovals?.(),
    },
  ];
  const openIssues = attentionRows.filter((r) => r.count > 0).length;

  // ── Sales trend (compact) ───────────────────────────────────────────────────
  const trend = useMemo(() => {
    const first = range.start ?? (metrics.length ? Math.min(...metrics.map((m) => m.orderMs)) : todayMs);
    return buildSalesTrend(booked, first, todayMs);
  }, [booked, metrics, range.start, todayMs]);

  // ── Stock on hand by status ─────────────────────────────────────────────────
  const onHand = useMemo(() => {
    const rows = ON_HAND.map((s) => {
      const group = tags.filter((t) => t.status === s.status);
      return { ...s, count: group.length, fbm: group.reduce((a, t) => a + t.volume, 0) };
    });
    return { rows, max: Math.max(...rows.map((r) => r.fbm), 1), total: rows.reduce((a, r) => a + r.fbm, 0) };
  }, [tags]);

  // ── What sold: FBM by species on booked orders in the period ────────────────
  const bySpecies = useMemo(() => {
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const groups = new Map<string, { fbm: number; net: number }>();
    for (const m of booked) {
      for (const li of m.so.lineItems) {
        const t = tagById.get(li.tagId);
        if (!t) continue;
        const g = groups.get(t.species) ?? { fbm: 0, net: 0 };
        g.fbm += volumeForQty(t, li.qty);
        g.net += li.qty * li.unitPrice * (1 - (li.discountPct ?? 0) / 100);
        groups.set(t.species, g);
      }
    }
    const rows = [...groups.entries()].map(([species, v]) => ({ species, fbm: Math.round(v.fbm), net: v.net })).sort((a, b) => b.net - a.net);
    return { rows, max: Math.max(...rows.map((r) => r.net), 1) };
  }, [booked, tags]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI row — three period figures, then live snapshot figures. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4" data-onboarding="pulse-overview-kpis">
        <KpiCard label="Booked sales" value={fmtMoney(net)} sub={range.label} delta={d(net, prevNet)} onClick={() => onOpenTab("sales")} ariaLabel="Open the Sales tab" />
        <KpiCard label="Orders" value={String(booked.length)} sub={range.label} delta={d(booked.length, prevBooked.length)} onClick={() => onOpenTab("sales")} ariaLabel="Open the Sales tab" />
        <KpiCard label="FBM shipped" value={fbmShipped.toLocaleString()} sub={range.label} delta={d(fbmShipped, prevFbmShipped)} onClick={() => onOpenTab("sales")} ariaLabel="Open the Sales tab" />
        <KpiCard
          label="Open order value"
          value={fmtMoney(snapshot.activeNet)}
          sub={`${plural(snapshot.activeIds.length, "order")} to ship · today`}
          onClick={snapshot.activeIds.length ? () => onNavigateToSales?.({ soIds: snapshot.activeIds, filterLabel: `${plural(snapshot.activeIds.length, "confirmed order")} still to ship` }) : undefined}
          ariaLabel="View confirmed orders still to ship"
        />
        <KpiCard
          label="Available to sell"
          value={`${snapshot.availableFbm.toLocaleString()} FBM`}
          sub={`${plural(snapshot.availableCount, "tag")} · today`}
          onClick={() => onNavigateToLocator?.({ status: ["Available"] })}
          ariaLabel="Filter Stock Locator to Available tags"
        />
        {/* Inventory at cost is finance data — Manager only. Sales sees the queue instead. */}
        {isManager ? (
          <KpiCard
            label="Inventory at cost"
            value={fmtMoney(snapshot.value.cost)}
            sub={snapshot.value.uncosted > 0 ? `${plural(snapshot.value.uncosted, "tag")} without a cost · today` : "On hand · today"}
            onClick={() => onOpenTab("inventory")}
            ariaLabel="Open the Inventory tab"
          />
        ) : (
          <KpiCard
            label="My pending approvals"
            value={String(attention.pending.length)}
            sub="Awaiting a decision · today"
            onClick={onOpenApprovals}
            ariaLabel="Open my approval requests"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Needs attention */}
        <Card
          title="Needs attention"
          hint={openIssues === 0 ? "Nothing needs action right now" : `${plural(openIssues, "item")} to look at`}
          actions={<SnapshotTag />}
        >
          <div className="flex flex-col" data-onboarding="pulse-attention">
            {attentionRows.map((r) => {
              const clear = r.count === 0;
              return (
                <div key={r.key} className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${clear ? "bg-[#F3F4F6] text-text-ter" : "bg-coral/10 text-coral"}`}>
                    {clear ? <CircleCheck size={15} /> : <r.Icon size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] font-semibold ${clear ? "text-text-sec" : "text-ink"}`}>
                      {clear ? `No ${r.label.toLowerCase()}` : `${r.count} ${r.label.toLowerCase()}`}
                    </div>
                    <div className="text-[11px] text-text-ter truncate">{r.detail}</div>
                  </div>
                  {!clear && (
                    <Button variant="secondary" size="sm" onClick={r.onClick} rightIcon={<ChevronRight size={13} />}>
                      {r.action}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Sales trend */}
        <Card
          className="lg:col-span-2"
          title={`Booked sales by ${trend.monthly ? "month" : "week"}`}
          hint={`${range.label} · by order date`}
          actions={
            <Button variant="ghost" size="sm" onClick={() => onOpenTab("sales")} rightIcon={<ChevronRight size={13} />}>
              Sales detail
            </Button>
          }
        >
          {booked.length === 0 ? (
            <EmptyState>No booked orders in this period.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
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
                  onClick={(data) => {
                    const p = (data as unknown as { payload?: { ids?: string[]; full?: string } }).payload;
                    if (p?.ids?.length) onNavigateToSales?.({ soIds: p.ids, filterLabel: `${plural(p.ids.length, "order")} placed · ${p.full}` });
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stock on hand */}
        <Card title="Stock on hand by status" hint={`${onHand.total.toLocaleString()} FBM in the yard · click a status to see its tags`} actions={<SnapshotTag />}>
          <div className="flex flex-col gap-3">
            {onHand.rows.map((r) => (
              <button
                key={r.status}
                type="button"
                onClick={() => onNavigateToLocator?.({ status: [r.status] })}
                disabled={r.count === 0}
                className={`text-left bg-transparent border-0 p-0 w-full group ${r.count === 0 ? "cursor-default opacity-60" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-text font-medium group-hover:text-coral">{r.status}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold text-ink">{r.fbm.toLocaleString()} FBM</span>
                    <span className="text-text-ter"> · {plural(r.count, "tag")}</span>
                  </span>
                </div>
                <ShareBar ratio={r.fbm / onHand.max} color={r.color} />
              </button>
            ))}
          </div>
        </Card>

        {/* What sold */}
        <Card title="What sold, by species" hint={`Booked orders · ${range.label.toLowerCase()} · click a species to see its orders`}>
          {bySpecies.rows.length === 0 ? (
            <EmptyState>No booked orders in this period.</EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {bySpecies.rows.map((r) => (
                <button
                  key={r.species}
                  type="button"
                  onClick={() => onNavigateToSales?.({ soIds: booked.filter((m) => m.species.includes(r.species)).map((m) => m.so.id), filterLabel: `${r.species} orders · ${range.label.toLowerCase()}` })}
                  className="text-left bg-transparent border-0 p-0 w-full cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-text font-medium group-hover:text-coral">{r.species}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold text-ink">{fmtMoney(r.net)}</span>
                      <span className="text-text-ter"> · {r.fbm.toLocaleString()} FBM</span>
                    </span>
                  </div>
                  <ShareBar ratio={r.net / bySpecies.max} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
