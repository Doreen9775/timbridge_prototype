// Inventory-tab cards added alongside the original three charts: stock cover (turnover),
// valuation (Manager only), slow movers and receiving quality by supplier.
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { EntryFilter, Role, SalesOrder, Tag } from "@/lib/types";
import {
  AGING_THRESHOLD_DAYS, DAY_MS, buildOrderMetrics, daysInYard, fmtMoney, fmtPct, inRange, isoToMs,
  type DateRange,
} from "@/lib/analytics";
import { Card, ChartExportButton, EmptyState, SnapshotTag } from "./parts";
import { exportRows } from "./pulseUtils";

interface ExtrasProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  role: Role;
  range: DateRange;
  todayMs: number;
  onNavigateToLocator?: (filter: EntryFilter) => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const th = "px-2 pb-2 text-text-sec font-medium text-xs whitespace-nowrap";
const td = "px-2 py-2.5 whitespace-nowrap";
const rowCls = "border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-sage/15";

export function InventoryExtras({ tags, salesOrders, role, range, todayMs, onNavigateToLocator }: ExtrasProps) {
  const isManager = role === "manager";

  // ── Stock cover: how long the sellable stock lasts at the period's shipping pace ──
  const cover = useMemo(() => {
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const metrics = buildOrderMetrics(salesOrders, tags);
    const shipped = metrics.filter((m) => m.so.status === "Shipped" && inRange(m.shippedMs ?? m.orderMs, range));
    // Weeks in the window; "All time" runs from the first shipment to today.
    const firstMs = range.start ?? (shipped.length ? Math.min(...shipped.map((m) => m.shippedMs ?? m.orderMs)) : todayMs);
    const weeks = Math.max((todayMs + DAY_MS - firstMs) / (7 * DAY_MS), 1);

    const groups = new Map<string, { availableFbm: number; shippedFbm: number }>();
    const group = (species: string) => {
      let g = groups.get(species);
      if (!g) {
        g = { availableFbm: 0, shippedFbm: 0 };
        groups.set(species, g);
      }
      return g;
    };
    for (const t of tags) if (t.status === "Available") group(t.species).availableFbm += t.fbm;
    for (const m of shipped) {
      for (const li of m.so.lineItems) {
        const t = tagById.get(li.tagId);
        if (t) group(t.species).shippedFbm += ((t.thick * t.width * t.length) / 12) * li.qty;
      }
    }
    return [...groups.entries()]
      .map(([species, g]) => {
        const weekly = g.shippedFbm / weeks;
        const weeksOfCover = weekly > 0 ? g.availableFbm / weekly : null;
        return {
          species,
          availableFbm: g.availableFbm,
          shippedFbm: Math.round(g.shippedFbm),
          weekly: Math.round(weekly),
          weeksOfCover,
          // Under 2 weeks = likely to run out; over 26 weeks (or no sales at all) = overstocked.
          flag: weeksOfCover === null ? (g.availableFbm > 0 ? "No sales" : "") : weeksOfCover < 2 ? "Low" : weeksOfCover > 26 ? "Overstocked" : "",
        };
      })
      .sort((a, b) => (a.weeksOfCover ?? Infinity) - (b.weeksOfCover ?? Infinity));
  }, [tags, salesOrders, range, todayMs]);

  // ── Valuation by species (Manager only) ─────────────────────────────────────
  const valuation = useMemo(() => {
    const groups = new Map<string, { fbm: number; cost: number; market: number; tags: number; uncosted: number }>();
    for (const t of tags) {
      if (t.status === "Shipped") continue;
      const g = groups.get(t.species) ?? { fbm: 0, cost: 0, market: 0, tags: 0, uncosted: 0 };
      g.tags += 1;
      g.fbm += t.fbm;
      if (t.cost === undefined) g.uncosted += 1;
      else {
        g.cost += t.cost * t.qty;
        g.market += (t.marketValue ?? t.cost) * t.qty;
      }
      groups.set(t.species, g);
    }
    const rows = [...groups.entries()].map(([species, g]) => ({ species, ...g })).sort((a, b) => b.cost - a.cost);
    const total = rows.reduce((s, r) => ({ cost: s.cost + r.cost, market: s.market + r.market, uncosted: s.uncosted + r.uncosted }), { cost: 0, market: 0, uncosted: 0 });
    return { rows, total };
  }, [tags]);

  // ── Slow movers: the oldest Available tags ──────────────────────────────────
  const slow = useMemo(
    () =>
      tags
        .filter((t) => t.status === "Available")
        .map((t) => ({ t, days: daysInYard(t, todayMs) }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 6),
    [tags, todayMs],
  );

  // ── Receiving quality: stock entered in the period, by supplier ─────────────
  const suppliers = useMemo(() => {
    const groups = new Map<string, { ids: string[]; fbm: number; flaggedIds: string[] }>();
    for (const t of tags) {
      if (!inRange(isoToMs(t.date), range)) continue;
      const name = t.supplier ?? "Unspecified";
      const g = groups.get(name) ?? { ids: [], fbm: 0, flaggedIds: [] };
      g.ids.push(t.id);
      g.fbm += t.fbm;
      // A tag counts as flagged if it is in Discrepancy now or was ever flagged on arrival.
      if (t.status === "Discrepancy" || t.history.some((h) => h.e.startsWith("Flagged"))) g.flaggedIds.push(t.id);
      groups.set(name, g);
    }
    return [...groups.entries()]
      .map(([name, g]) => ({ name, ...g, rate: g.ids.length ? g.flaggedIds.length / g.ids.length : 0 }))
      .sort((a, b) => b.rate - a.rate || b.fbm - a.fbm);
  }, [tags, range]);

  const openTags = (ids: string[], label: string) => {
    if (ids.length) onNavigateToLocator?.({ tagIds: ids, filterLabel: label });
  };

  return (
    <>
      <div className={`grid grid-cols-1 gap-5 ${isManager ? "lg:grid-cols-2" : ""}`}>
        <Card
          title="Stock cover by species"
          hint={`Available FBM ÷ weekly shipping pace · ${range.label.toLowerCase()}`}
          actions={
            <ChartExportButton
              onClick={() => exportRows("stock_cover", ["Species", "Available FBM", "Shipped FBM", "FBM per week", "Weeks of cover", "Flag"], cover.map((c) => [c.species, c.availableFbm, c.shippedFbm, c.weekly, c.weeksOfCover === null ? "" : c.weeksOfCover.toFixed(1), c.flag]))}
              disabled={cover.length === 0}
              ariaLabel="Export stock cover as CSV"
            />
          }
        >
          {cover.length === 0 ? (
            <EmptyState>No stock or shipments to compare.</EmptyState>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-sage">
                  <th className={`${th} text-left`}>Species</th>
                  <th className={`${th} text-right`}>Available</th>
                  <th className={`${th} text-right`}>Shipped</th>
                  <th className={`${th} text-right`}>Per week</th>
                  <th className={`${th} text-right`}>Cover</th>
                </tr>
              </thead>
              <tbody>
                {cover.map((c) => (
                  <tr key={c.species} className={rowCls} onClick={() => onNavigateToLocator?.({ status: ["Available"], species: [c.species] })} title={`View Available ${c.species}`}>
                    <td className={`${td} font-semibold text-ink`}>{c.species}</td>
                    <td className={`${td} text-right tabular-nums`}>{c.availableFbm.toLocaleString()}</td>
                    <td className={`${td} text-right tabular-nums text-text-sec`}>{c.shippedFbm.toLocaleString()}</td>
                    <td className={`${td} text-right tabular-nums text-text-sec`}>{c.weekly.toLocaleString()}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      <span className={`font-semibold ${c.flag === "Low" ? "text-coral" : "text-ink"}`}>{c.weeksOfCover === null ? "—" : `${c.weeksOfCover.toFixed(1)} wk`}</span>
                      {c.flag && (
                        <span className={`ml-2 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${c.flag === "Low" ? "bg-coral/10 text-coral" : "bg-[#F3F4F6] text-text-sec"}`}>{c.flag}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="text-[11px] text-text-ter mt-3">Low = under 2 weeks of stock at the current pace. Overstocked = more than 26 weeks.</div>
        </Card>

        {/* Cost and market value are finance data — Manager only, never rendered for Sales. */}
        {isManager && (
          <Card
            title="Inventory value by species"
            hint={`${fmtMoney(valuation.total.cost)} at cost · ${fmtMoney(valuation.total.market)} at market`}
            actions={
              <>
                <SnapshotTag />
                <ChartExportButton
                  onClick={() => exportRows("inventory_value_by_species", ["Species", "Tags", "FBM", "Value at cost (USD)", "Market value (USD)", "Unrealized margin (USD)"], valuation.rows.map((r) => [r.species, r.tags, r.fbm, Math.round(r.cost), Math.round(r.market), Math.round(r.market - r.cost)]))}
                  disabled={valuation.rows.length === 0}
                  ariaLabel="Export inventory value as CSV"
                />
              </>
            }
          >
            {valuation.rows.length === 0 ? (
              <EmptyState>No inventory on hand.</EmptyState>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-sage">
                    <th className={`${th} text-left`}>Species</th>
                    <th className={`${th} text-right`}>FBM</th>
                    <th className={`${th} text-right`}>At cost</th>
                    <th className={`${th} text-right`}>At market</th>
                    <th className={`${th} text-right`}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {valuation.rows.map((r) => (
                    <tr key={r.species} className={rowCls} onClick={() => onNavigateToLocator?.({ species: [r.species], status: ["Pending", "Received", "Available", "Reserved", "Discrepancy"] })} title={`View on-hand ${r.species}`}>
                      <td className={`${td} font-semibold text-ink`}>{r.species}</td>
                      <td className={`${td} text-right tabular-nums text-text-sec`}>{r.fbm.toLocaleString()}</td>
                      <td className={`${td} text-right tabular-nums font-semibold text-ink`}>{fmtMoney(r.cost)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtMoney(r.market)}</td>
                      <td className={`${td} text-right tabular-nums text-text-sec`}>{r.market > 0 ? fmtPct((r.market - r.cost) / r.market) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {valuation.total.uncosted > 0 && (
              <div className="text-[11px] text-text-ter mt-3">{plural(valuation.total.uncosted, "tag")} with no cost on file {valuation.total.uncosted === 1 ? "is" : "are"} left out of the dollar figures.</div>
            )}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Slow movers" hint="Oldest Available tags — the first candidates to discount or bundle" actions={<SnapshotTag />}>
          {slow.length === 0 ? (
            <EmptyState>Nothing is Available right now.</EmptyState>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-sage">
                  <th className={`${th} text-left`}>Tag</th>
                  <th className={`${th} text-left`}>Product</th>
                  <th className={`${th} text-right`}>FBM</th>
                  {isManager && <th className={`${th} text-right`}>At cost</th>}
                  <th className={`${th} text-right`}>In yard</th>
                </tr>
              </thead>
              <tbody>
                {slow.map(({ t, days }) => (
                  <tr key={t.id} className={rowCls} onClick={() => openTags([t.id], `${t.id} · ${days} days in yard`)} title={`Open ${t.id} in Stock Locator`}>
                    <td className={`${td} font-mono font-semibold text-ink`}>{t.id}</td>
                    <td className={`${td} text-text-sec`}>{t.species} · {t.grade} · {t.thick}×{t.width}×{t.length}'</td>
                    <td className={`${td} text-right tabular-nums`}>{t.fbm.toLocaleString()}</td>
                    {isManager && <td className={`${td} text-right tabular-nums text-text-sec`}>{t.cost === undefined ? "—" : fmtMoney(t.cost * t.qty)}</td>}
                    <td className={`${td} text-right tabular-nums font-semibold ${days >= AGING_THRESHOLD_DAYS ? "text-coral" : "text-ink"}`}>{days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Receiving quality by supplier"
          hint={`Stock entered · ${range.label.toLowerCase()} · share of tags flagged on arrival`}
          actions={
            <ChartExportButton
              onClick={() => exportRows("receiving_quality", ["Supplier", "Tags", "FBM", "Flagged tags", "Flag rate"], suppliers.map((s) => [s.name, s.ids.length, s.fbm, s.flaggedIds.length, fmtPct(s.rate)]))}
              disabled={suppliers.length === 0}
              ariaLabel="Export receiving quality as CSV"
            />
          }
        >
          {suppliers.length === 0 ? (
            <EmptyState>No stock entered in this period.</EmptyState>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-sage">
                  <th className={`${th} text-left`}>Supplier</th>
                  <th className={`${th} text-right`}>Tags</th>
                  <th className={`${th} text-right`}>FBM</th>
                  <th className={`${th} text-right`}>Flagged</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr
                    key={s.name}
                    className={rowCls}
                    onClick={() => (s.flaggedIds.length ? openTags(s.flaggedIds, `${plural(s.flaggedIds.length, "flagged tag")} · ${s.name}`) : openTags(s.ids, `${plural(s.ids.length, "tag")} from ${s.name} · ${range.label.toLowerCase()}`))}
                    title={s.flaggedIds.length ? `View flagged tags from ${s.name}` : `View tags from ${s.name}`}
                  >
                    <td className={`${td} font-semibold text-ink`}>{s.name}</td>
                    <td className={`${td} text-right tabular-nums text-text-sec`}>{s.ids.length}</td>
                    <td className={`${td} text-right tabular-nums text-text-sec`}>{s.fbm.toLocaleString()}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {s.flaggedIds.length === 0 ? (
                        <span className="text-text-ter">None</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-coral">
                          <AlertTriangle size={12} />
                          {s.flaggedIds.length} · {fmtPct(s.rate)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
