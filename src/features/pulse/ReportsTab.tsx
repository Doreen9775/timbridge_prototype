import { useMemo, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import type { ApprovalRequest, ApprovalRequestType, Role, SalesOrder, Tag } from "@/lib/types";
import {
  ACTIVE_STATUSES, AGING_THRESHOLD_DAYS, DAY_MS, buildOrderMetrics, buildShortageRows, daysInYard, fmtMoney, inRange, msToIso, parseStampMs,
  type DateRange,
} from "@/lib/analytics";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/shared/Button";
import { SnapshotTag } from "./parts";
import { exportRows } from "./pulseUtils";

// ── Report library ────────────────────────────────────────────────────────────────
// Every report is the same shape — typed columns + raw rows — so they all share one
// table, one totals row and one CSV export. "period" reports follow the Pulse period
// picker; "snapshot" reports are point-in-time and say so.
//
// The library is role-aware. Sales gets the reports a rep works from — orders, clients,
// what is still to ship, what can be sold, and their approval requests — with list
// prices only. Anything built on cost (valuation, margin, value at cost) is Manager-only:
// those reports and columns are never built for Sales, not just hidden.

type Cell = string | number;
type ColKind = "text" | "int" | "money" | "pct";
interface Column { label: string; kind?: ColKind; total?: boolean }
interface Report {
  key: string;
  title: string;
  blurb: string;
  scope: "period" | "snapshot";
  columns: Column[];
  rows: Cell[][];
  flagged?: boolean[]; // per-row alert tint (parallel to rows)
  flagCount?: number;
  flagNoun?: string;
  footnote?: string;
  empty: string;
  managerOnly?: boolean;
}

const APPROVAL_TYPE_LABEL: Record<ApprovalRequestType, string> = { discount: "Discount", creditTerm: "Credit term", orderCancellation: "Cancellation", other: "Other" };
// Library order per role: Sales leads with their own book of business, Manager with stock risk.
const SALES_ORDER = ["register", "clients", "open", "available", "approvals", "shortage"];
const MANAGER_ORDER = ["shortage", "valuation", "register", "clients", "open", "available", "approvals", "aging"];

function fmtCell(v: Cell, kind: ColKind | undefined): string {
  if (typeof v === "string") return v;
  if (kind === "money") return fmtMoney(v);
  if (kind === "pct") return `${v}%`;
  return v.toLocaleString();
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

interface ReportsTabProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  approvalRequests: ApprovalRequest[];
  role: Role;
  range: DateRange;
  todayMs: number;
}

export function ReportsTab({ tags, salesOrders, approvalRequests, role, range, todayMs }: ReportsTabProps) {
  const { clientById, getClientName } = useClients();
  const isManager = role === "manager";
  const [active, setActive] = useState(isManager ? MANAGER_ORDER[0] : SALES_ORDER[0]);

  const reports: Report[] = useMemo(() => {
    const metrics = buildOrderMetrics(salesOrders, tags);
    const inPeriod = metrics.filter((m) => inRange(m.orderMs, range));
    const booked = inPeriod.filter((m) => m.booked);

    // 1 · Shortage & asset
    const shortage = buildShortageRows(tags, salesOrders);

    // 2 · Inventory valuation — on-hand stock by species + grade.
    const valGroups = new Map<string, { species: string; grade: string; tags: number; fbm: number; cost: number; market: number; uncosted: number }>();
    for (const t of tags) {
      if (t.status === "Shipped") continue;
      const key = `${t.species}|${t.grade}`;
      const g = valGroups.get(key) ?? { species: t.species, grade: t.grade, tags: 0, fbm: 0, cost: 0, market: 0, uncosted: 0 };
      g.tags += 1;
      g.fbm += t.volume;
      if (t.cost === undefined) g.uncosted += 1;
      else {
        g.cost += t.cost * t.qty;
        g.market += (t.marketValue ?? t.cost) * t.qty;
      }
      valGroups.set(key, g);
    }
    const valuation = [...valGroups.values()].sort((a, b) => b.cost - a.cost);
    const uncostedTotal = valuation.reduce((s, g) => s + g.uncosted, 0);

    // 3 · Sales register — one row per order placed in the period.
    const register = [...inPeriod].sort((a, b) => b.orderMs - a.orderMs);

    // 4 · Sales by client.
    const byClient = new Map<string, { orders: number; fbm: number; net: number; lastMs: number }>();
    for (const m of booked) {
      const g = byClient.get(m.so.clientId) ?? { orders: 0, fbm: 0, net: 0, lastMs: 0 };
      g.orders += 1;
      g.fbm += m.volume;
      g.net += m.net;
      g.lastMs = Math.max(g.lastMs, m.orderMs);
      byClient.set(m.so.clientId, g);
    }
    // Open order value is live (not period-bound): what each client still has on order.
    const openByClient = new Map<string, number>();
    for (const m of metrics) {
      if (ACTIVE_STATUSES.includes(m.so.status)) openByClient.set(m.so.clientId, (openByClient.get(m.so.clientId) ?? 0) + m.net);
    }
    const clientTotal = [...byClient.values()].reduce((s, g) => s + g.net, 0);
    const clients = [...byClient.entries()].sort(([, a], [, b]) => b.net - a.net);

    // 5 · Aging detail — every Available tag, oldest first.
    const aging = tags
      .filter((t) => t.status === "Available")
      .map((t) => ({ t, days: daysInYard(t, todayMs) }))
      .sort((a, b) => b.days - a.days);
    const agingFlags = aging.map((a) => a.days >= AGING_THRESHOLD_DAYS);

    // 6 · Open orders — confirmed and not yet shipped, most urgent first.
    const open = metrics
      .filter((m) => ACTIVE_STATUSES.includes(m.so.status))
      .map((m) => ({ m, daysToShip: m.dueMs === null ? null : Math.round((m.dueMs - todayMs) / DAY_MS) }))
      .sort((a, b) => (a.daysToShip ?? Infinity) - (b.daysToShip ?? Infinity));
    const openFlags = open.map((o) => o.daysToShip !== null && o.daysToShip < 0);

    // 7 · Available to sell — sellable stock by species + grade, at list price.
    const sellGroups = new Map<string, { species: string; grade: string; tags: number; pieces: number; fbm: number; low: number; high: number; value: number; oldest: number }>();
    for (const t of tags) {
      if (t.status !== "Available") continue;
      const key = `${t.species}|${t.grade}`;
      const g = sellGroups.get(key) ?? { species: t.species, grade: t.grade, tags: 0, pieces: 0, fbm: 0, low: Infinity, high: 0, value: 0, oldest: 0 };
      g.tags += 1;
      g.pieces += t.qty;
      g.fbm += t.volume;
      if (t.marketValue !== undefined) {
        g.low = Math.min(g.low, t.marketValue);
        g.high = Math.max(g.high, t.marketValue);
        g.value += t.marketValue * t.qty;
      }
      g.oldest = Math.max(g.oldest, daysInYard(t, todayMs));
      sellGroups.set(key, g);
    }
    const sellable = [...sellGroups.values()].sort((a, b) => b.oldest - a.oldest);
    const sellFlags = sellable.map((g) => g.oldest >= AGING_THRESHOLD_DAYS);
    const priceRange = (g: { low: number; high: number }) =>
      g.high === 0 ? "—" : g.low === g.high ? `$${g.low.toFixed(2)}` : `$${g.low.toFixed(2)} – $${g.high.toFixed(2)}`;

    // 8 · Approval requests raised in the period, newest first.
    const soById = new Map(salesOrders.map((so) => [so.id, so]));
    const requests = approvalRequests
      .map((r) => ({ r, createdMs: parseStampMs(r.createdAt), resolvedMs: r.resolvedAt ? parseStampMs(r.resolvedAt) : null }))
      .filter((x) => inRange(x.createdMs, range))
      .sort((a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0));
    const pendingRequests = requests.filter((x) => x.r.status === "Pending").length;

    const all: Report[] = [
      {
        key: "shortage",
        title: "Shortage & asset",
        blurb: "On-hand, reserved and sellable FBM by species and grade — flags anything ordered that can no longer be restocked from the yard.",
        scope: "snapshot",
        columns: [
          { label: "Species" }, { label: "Grade" },
          { label: "Physical FBM", kind: "int", total: true }, { label: "Reserved FBM", kind: "int", total: true },
          { label: "Available FBM", kind: "int", total: true }, { label: "Available tags", kind: "int", total: true },
          { label: "Confirmed demand" }, { label: "Status" },
        ],
        rows: shortage.map((r) => [r.species, r.grade, r.physicalFbm, r.reservedFbm, r.availableFbm, r.availableCount, r.hasOpenDemand ? "Yes" : "—", r.shortage ? "Shortage" : ""]),
        flagged: shortage.map((r) => r.shortage),
        flagCount: shortage.filter((r) => r.shortage).length,
        flagNoun: "shortage",
        footnote: "Shortage rule: at least one confirmed (Open or Picked) Sales Order draws on this species + grade, but zero FBM is left Available to satisfy new demand.",
        empty: "No inventory to report.",
      },
      {
        key: "valuation",
        managerOnly: true,
        title: "Inventory valuation",
        blurb: "What the stock in the yard is worth — at cost and at market value — by species and grade.",
        scope: "snapshot",
        columns: [
          { label: "Species" }, { label: "Grade" },
          { label: "Tags", kind: "int", total: true }, { label: "FBM", kind: "int", total: true },
          { label: "Value at cost", kind: "money", total: true }, { label: "Market value", kind: "money", total: true },
          { label: "Unrealized margin", kind: "money", total: true }, { label: "Margin %", kind: "pct" },
        ],
        rows: valuation.map((g) => [g.species, g.grade, g.tags, g.fbm, Math.round(g.cost), Math.round(g.market), Math.round(g.market - g.cost), pct(g.market - g.cost, g.market)]),
        footnote:
          "Covers everything not yet Shipped." +
          (uncostedTotal > 0 ? ` ${uncostedTotal} tag${uncostedTotal === 1 ? " has" : "s have"} no cost on file (entered via Tag Entry or a delivery slip) and are counted in Tags and FBM but not in the dollar columns.` : ""),
        empty: "No inventory on hand.",
      },
      {
        key: "register",
        title: "Sales register",
        blurb: isManager ? "Every order placed in the period, with list value, discount, net value and margin." : "Every order placed in the period, with list value, discount given and net value.",
        scope: "period",
        columns: [
          { label: "Order" }, { label: "Date" }, { label: "Client" }, { label: "Territory" }, { label: "Status" },
          { label: "Lines", kind: "int", total: true }, { label: "FBM", kind: "int", total: true },
          { label: "List value", kind: "money", total: true }, { label: "Discount", kind: "money", total: true },
          { label: "Net value", kind: "money", total: true },
          // Margin is finance data — the column only exists for Manager.
          ...(isManager ? [{ label: "Margin %", kind: "pct" } as Column] : []),
        ],
        rows: register.map((m) => [
          m.so.id, m.so.date, getClientName(m.so.clientId), clientById.get(m.so.clientId)?.territory ?? "—", m.so.status,
          m.so.lineItems.length, m.volume, Math.round(m.gross), Math.round(m.discount), Math.round(m.net),
          ...(isManager ? [m.costKnown && m.net > 0 ? pct(m.net - m.cost, m.net) : "—"] : []),
        ]),
        flagged: register.map((m) => m.so.status === "Cancelled"),
        footnote: "Draft and Cancelled orders are listed for completeness but are not counted as booked sales elsewhere in Pulse. Cancelled orders are tinted.",
        empty: "No orders were placed in this period.",
      },
      {
        key: "clients",
        title: "Sales by client",
        blurb: "Booked sales per client in the period, with what each still has on order today.",
        scope: "period",
        columns: [
          { label: "Client" }, { label: "Territory" }, { label: "Payment terms" },
          { label: "Orders", kind: "int", total: true }, { label: "FBM", kind: "int", total: true },
          { label: "Net sales", kind: "money", total: true }, { label: "Share", kind: "pct" },
          { label: "Last order" }, { label: "Open order value", kind: "money", total: true },
        ],
        rows: clients.map(([id, g]) => {
          const c = clientById.get(id);
          return [getClientName(id), c?.territory ?? "—", c?.paymentTerms ?? "—", g.orders, g.fbm, Math.round(g.net), pct(g.net, clientTotal), msToIso(g.lastMs), Math.round(openByClient.get(id) ?? 0)];
        }),
        footnote: "Booked = Open, Picked or Shipped. Open order value is live: confirmed orders not yet shipped, regardless of the period.",
        empty: "No booked sales in this period.",
      },
      {
        key: "aging",
        managerOnly: true,
        title: "Aging detail",
        blurb: `Every Available tag by days in the yard — ${AGING_THRESHOLD_DAYS}+ days is flagged as slow-moving.`,
        scope: "snapshot",
        columns: [
          { label: "Tag" }, { label: "Species" }, { label: "Grade" }, { label: "Dimensions" }, { label: "Location" },
          { label: "Qty", kind: "int", total: true }, { label: "FBM", kind: "int", total: true },
          { label: "Days in yard", kind: "int" }, { label: "Value at cost", kind: "money", total: true },
        ],
        rows: aging.map(({ t, days }) => [
          t.id, t.species, t.grade, `${t.thick}×${t.width}×${t.length}'`, `${t.section}/${t.rack}/${t.bin}`,
          t.qty, t.volume, days, t.cost === undefined ? "—" : Math.round(t.cost * t.qty),
        ]),
        flagged: agingFlags,
        flagCount: agingFlags.filter(Boolean).length,
        flagNoun: "slow mover",
        empty: "Nothing is Available right now.",
      },
      {
        key: "open",
        title: "Open orders",
        blurb: "Confirmed orders still to ship, most urgent first — anything past its expected ship date is flagged.",
        scope: "snapshot",
        columns: [
          { label: "Order" }, { label: "Client" }, { label: "Status" }, { label: "Ordered" }, { label: "Expected ship" }, { label: "Due" },
          { label: "Lines", kind: "int", total: true }, { label: "FBM", kind: "int", total: true }, { label: "Net value", kind: "money", total: true },
        ],
        rows: open.map(({ m, daysToShip }) => [
          m.so.id, getClientName(m.so.clientId), m.so.status, m.so.date, m.so.expectedShipDate ?? "—",
          daysToShip === null ? "—" : daysToShip < 0 ? `${-daysToShip}d overdue` : daysToShip === 0 ? "Today" : `In ${daysToShip}d`,
          m.so.lineItems.length, m.volume, Math.round(m.net),
        ]),
        flagged: openFlags,
        flagCount: openFlags.filter(Boolean).length,
        flagNoun: "overdue order",
        footnote: "Open = confirmed with tags reserved. Picked = pulled and waiting for the truck. Drafts are not listed — nothing is reserved for them yet.",
        empty: "No confirmed orders are waiting to ship.",
      },
      {
        key: "available",
        title: "Available to sell",
        blurb: `What can be quoted today, by species and grade, at list price — groups holding stock ${AGING_THRESHOLD_DAYS}+ days old are flagged as the ones to move first.`,
        scope: "snapshot",
        columns: [
          { label: "Species" }, { label: "Grade" },
          { label: "Tags", kind: "int", total: true }, { label: "Pieces", kind: "int", total: true }, { label: "FBM", kind: "int", total: true },
          { label: "List price / pc" }, { label: "List value", kind: "money", total: true }, { label: "Oldest (days)", kind: "int" },
        ],
        rows: sellable.map((g) => [g.species, g.grade, g.tags, g.pieces, g.fbm, priceRange(g), Math.round(g.value), g.oldest]),
        flagged: sellFlags,
        flagCount: sellFlags.filter(Boolean).length,
        flagNoun: "aging group",
        footnote: "Available tags only — Reserved, Pending, Received and Discrepancy stock cannot be quoted. List price is each tag's market value per piece.",
        empty: "Nothing is Available right now.",
      },
      {
        key: "approvals",
        title: "Approval requests",
        blurb: "Requests raised in the period — discounts, credit terms and cancellations — with the decision and how long it took.",
        scope: "period",
        columns: [
          { label: "Request" }, { label: "Type" }, { label: "Order" }, { label: "Client" }, { label: "Requested" },
          { label: "Rate %", kind: "pct" }, { label: "Status" }, { label: "Decided" }, { label: "Decision time" }, { label: "Reviewer note" },
        ],
        rows: requests.map(({ r, createdMs, resolvedMs }) => {
          const order = r.relatedSoId ? soById.get(r.relatedSoId) : undefined;
          const hours = createdMs !== null && resolvedMs !== null ? (resolvedMs - createdMs) / 3_600_000 : null;
          return [
            r.id, APPROVAL_TYPE_LABEL[r.type], r.relatedSoId ?? "—", order ? getClientName(order.clientId) : "—",
            createdMs === null ? r.createdAt : msToIso(createdMs),
            r.discountRate ?? "—", r.status, resolvedMs === null ? "—" : msToIso(resolvedMs),
            hours === null ? "—" : hours >= 24 ? `${(hours / 24).toFixed(1)} d` : `${hours.toFixed(1)} h`,
            r.reviewNote ?? "—",
          ];
        }),
        flagged: requests.map((x) => x.r.status === "Rejected"),
        flagCount: pendingRequests,
        flagNoun: "pending request",
        footnote: "Rejected requests are tinted. A discount on a confirmed order raises a request automatically.",
        empty: "No approval requests were raised in this period.",
      },
    ];

    const byKey = new Map(all.filter((r) => isManager || !r.managerOnly).map((r) => [r.key, r]));
    return (isManager ? MANAGER_ORDER : SALES_ORDER).map((k) => byKey.get(k)).filter((r): r is Report => r !== undefined);
  }, [tags, salesOrders, approvalRequests, isManager, range, todayMs, clientById, getClientName]);

  const report = reports.find((r) => r.key === active) ?? reports[0];
  const totals = report.columns.map((c, i) => (c.total ? report.rows.reduce((s, r) => s + (typeof r[i] === "number" ? (r[i] as number) : 0), 0) : null));
  const isNumeric = (c: Column) => c.kind !== undefined && c.kind !== "text";

  const handleExport = () =>
    exportRows(`${report.key}_report`, report.columns.map((c) => (c.kind === "money" ? `${c.label} (USD)` : c.label)), report.rows);

  return (
    <div className="flex flex-col gap-4">
      {/* Library */}
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${isManager ? "xl:grid-cols-4" : "xl:grid-cols-6"}`} role="tablist" aria-label="Report library">
        {reports.map((r) => {
          const on = r.key === report.key;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(r.key)}
              className={[
                "text-left rounded-[10px] px-3.5 py-3 border cursor-pointer transition-colors",
                on ? "bg-ink border-ink text-white" : "bg-white border-sage/60 text-ink hover:border-ink",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{r.title}</span>
                {!!r.flagCount && (
                  <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${on ? "bg-coral text-white" : "bg-coral/10 text-coral"}`}>{r.flagCount}</span>
                )}
              </div>
              <div className={`text-[11px] mt-0.5 ${on ? "text-white/60" : "text-text-ter"}`}>{r.scope === "period" ? "Follows the period" : "As of today"}</div>
            </button>
          );
        })}
      </div>

      {/* Selected report */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-display font-semibold text-text">{report.title}</div>
            {report.scope === "snapshot" ? (
              <SnapshotTag />
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-sec bg-white border border-sage rounded-full px-2 py-0.5 whitespace-nowrap">{range.label}</span>
            )}
            {!!report.flagCount && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-coral bg-coral/10 rounded-full px-2 py-0.5">
                <AlertTriangle size={11} />
                {report.flagCount} {report.flagNoun}{report.flagCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="text-[12px] text-text-sec mt-1">{report.blurb}</div>
        </div>
        <Button variant="primary" onClick={handleExport} leftIcon={<Download size={14} />} disabled={report.rows.length === 0}>
          Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-sage">
                {report.columns.map((c) => (
                  <th key={c.label} className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${isNumeric(c) ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => {
                const flagged = report.flagged?.[i] ?? false;
                return (
                  <tr
                    key={i}
                    className={[
                      "border-b border-[#F3F4F6]",
                      flagged ? "bg-coral/[0.06] hover:bg-coral/[0.12]" : `${i % 2 === 0 ? "bg-transparent" : "bg-[#FAFAFA]"} hover:bg-sage/15`,
                    ].join(" ")}
                  >
                    {row.map((v, j) => {
                      const c = report.columns[j];
                      return (
                        <td
                          key={j}
                          className={[
                            "px-3.5 py-[11px] whitespace-nowrap",
                            isNumeric(c) ? "text-right tabular-nums" : "text-left",
                            j === 0 ? `font-semibold ${flagged ? "text-coral" : "text-ink"}` : flagged && v === "Shortage" ? "text-coral font-semibold" : "text-text",
                          ].join(" ")}
                        >
                          {fmtCell(v, c.kind)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={report.columns.length} className="p-10 text-center text-text-sec">{report.empty}</td>
                </tr>
              )}
            </tbody>
            {report.rows.length > 0 && totals.some((t) => t !== null) && (
              <tfoot>
                <tr className="bg-[#F9FAFB] border-t border-sage font-semibold text-ink">
                  {report.columns.map((c, j) => (
                    <td key={c.label} className={`px-3.5 py-2.5 whitespace-nowrap ${isNumeric(c) ? "text-right tabular-nums" : "text-left"}`}>
                      {j === 0 ? `Total · ${report.rows.length} row${report.rows.length === 1 ? "" : "s"}` : totals[j] !== null ? fmtCell(totals[j] as number, c.kind) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {report.footnote && <div className="text-[11px] text-text-ter">{report.footnote}</div>}
    </div>
  );
}
