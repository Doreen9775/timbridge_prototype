import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import type { EntryFilter, SalesOrder, Tag } from "@/lib/types";
import { usePack } from "@/hooks/usePack";
import { useClients } from "@/hooks/useClients";
import { RANGE_OPTIONS, addDays, inRange, isoToMs, resolveRange, shortDayLabel, startOfTodayMs, weekStartMs, type RangeKey } from "@/lib/analytics";
import { Button } from "@/components/shared/Button";

// Volume Report (log-trading pack) — how much is on hand, allocated to customers and
// delivered. The definitions the screen states and every figure follows:
//
//   On hand               scaled volume still physically held: every lot that isn't
//                         Delivered or awaiting scaling (Pending). Allocated lots that
//                         are still in storage — or in transit — count as on hand.
//   Allocated (on hand)   volume on booms that are in storage or in transit.
//   On hold               on-hand lots not sellable yet (Discrepancy, or Received but not released).
//   Available to allocate on hand − allocated − on hold.
//   Delivered             delivered volume confirmed on booms delivered in the period.
//
// On hand / allocated / available are point-in-time; Delivered follows the period.

const C = { ink: "#1F1F1F", sage: "#B7CDC2", textSec: "#6B7280", textTer: "#9CA3AF" };
const r1 = (v: number) => Math.round(v * 10) / 10;
const m3 = (v: number) => `${r1(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} m³`;

interface VolumeReportProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  onNavigateToLocator?: (filter: EntryFilter) => void;
  onOpenSo?: (soId: string) => void;
  onOpenClient?: (clientId: string) => void;
}

export function VolumeReport({ tags, salesOrders, onNavigateToLocator, onOpenClient }: VolumeReportProps) {
  const { pack } = usePack();
  const { clients, getClientName } = useClients();
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const todayMs = useMemo(() => startOfTodayMs(), []);
  const range = useMemo(() => resolveRange(rangeKey, todayMs), [rangeKey, todayMs]);

  const lots = useMemo(() => tags.filter((t) => t.productType === "log"), [tags]);
  const booms = useMemo(() => salesOrders.filter((so) => so.boom), [salesOrders]);

  const snapshot = useMemo(() => {
    const onHandLots = lots.filter((t) => t.status !== "Shipped" && t.status !== "Pending");
    const sum = (rows: Tag[]) => r1(rows.reduce((s, t) => s + t.volume, 0));
    const allocated = onHandLots.filter((t) => t.status === "Reserved");
    const transitIds = new Set(booms.filter((b) => b.status === "Picked").flatMap((b) => b.lineItems.map((li) => li.tagId)));
    return {
      onHand: sum(onHandLots),
      allocated: sum(allocated),
      inTransit: sum(allocated.filter((t) => transitIds.has(t.id))),
      onHold: sum(onHandLots.filter((t) => t.status === "Discrepancy" || t.status === "Received")),
      available: sum(onHandLots.filter((t) => t.status === "Available")),
      lotsOnHand: onHandLots.length,
    };
  }, [lots, booms]);

  const deliveredBooms = useMemo(
    () => booms.filter((b) => b.status === "Shipped" && b.boom?.deliveredDate && inRange(isoToMs(b.boom.deliveredDate), range)),
    [booms, range],
  );
  const deliveredTotal = r1(deliveredBooms.reduce((s, b) => s + (b.boom?.deliveredVolume ?? 0), 0));

  // Deliveries per week across the period (or since the first delivery for "All time").
  const trend = useMemo(() => {
    const dates = booms.filter((b) => b.boom?.deliveredDate).map((b) => isoToMs(b.boom!.deliveredDate!));
    const first = range.start ?? (dates.length ? Math.min(...dates) : todayMs);
    const buckets = new Map<number, number>();
    for (let ms = weekStartMs(first); ms <= todayMs; ms = addDays(ms, 7)) buckets.set(ms, 0);
    for (const b of deliveredBooms) {
      const k = weekStartMs(isoToMs(b.boom!.deliveredDate!));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + (b.boom!.deliveredVolume ?? 0));
    }
    return [...buckets.entries()].sort(([a], [b]) => a - b).map(([ms, v]) => ({ label: shortDayLabel(ms), volume: r1(v) }));
  }, [booms, deliveredBooms, range.start, todayMs]);

  // Customer view: committed (allocated, still on hand) vs delivered in the period.
  const customerRows = useMemo(() => {
    const tagById = new Map(lots.map((t) => [t.id, t]));
    const rows = clients.map((c) => {
      const mine = booms.filter((b) => b.clientId === c.id);
      const active = mine.filter((b) => b.status === "Open" || b.status === "Picked");
      const committed = active.reduce((s, b) => s + b.lineItems.reduce((a, li) => a + (tagById.get(li.tagId)?.volume ?? li.qty), 0), 0);
      const transit = active.filter((b) => b.status === "Picked").reduce((s, b) => s + b.lineItems.reduce((a, li) => a + li.qty, 0), 0);
      const delivered = deliveredBooms.filter((b) => b.clientId === c.id);
      const lastDelivery = mine.map((b) => b.boom?.deliveredDate).filter(Boolean).sort().pop();
      return {
        id: c.id,
        name: c.name,
        committed: r1(committed),
        transit: r1(transit),
        activeBooms: active.length,
        delivered: r1(delivered.reduce((s, b) => s + (b.boom?.deliveredVolume ?? 0), 0)),
        deliveredBooms: delivered.length,
        lastDelivery: lastDelivery ?? null,
      };
    });
    return rows.filter((r) => r.committed > 0 || r.delivered > 0 || r.lastDelivery).sort((a, b) => b.committed + b.delivered - (a.committed + a.delivered));
  }, [clients, booms, lots, deliveredBooms]);

  // On hand by storage site.
  const siteRows = useMemo(
    () =>
      pack.sites.map((s) => {
        const here = lots.filter((t) => t.yard === s.code && t.status !== "Shipped" && t.status !== "Pending");
        const v = (st: Tag["status"]) => r1(here.filter((t) => t.status === st).reduce((a, t) => a + t.volume, 0));
        return { ...s, available: v("Available"), allocated: v("Reserved"), onHold: v("Discrepancy"), total: r1(here.reduce((a, t) => a + t.volume, 0)) };
      }),
    [pack.sites, lots],
  );

  const exportCustomers = () => {
    const header = ["Customer", "Committed (allocated, on hand) m3", "In transit m3", "Open booms", `Delivered (${range.label}) m3`, "Booms delivered", "Last delivery"];
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [header.map(cell).join(","), ...customerRows.map((r) => [r.name, r.committed, r.transit, r.activeBooms, r.delivered, r.deliveredBooms, r.lastDelivery ?? ""].map(cell).join(","))];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timbridge_volume_by_customer_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto" data-onboarding="volume-report">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>Volume Report</h1>
            <p className="text-sm text-text-sec mt-1">What is on hand, what is allocated to customers, and what has been delivered.</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex bg-white border border-sage rounded-full p-[3px] gap-[2px]" role="group" aria-label="Delivery period">
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setRangeKey(o.key)}
                  title={o.label}
                  aria-pressed={rangeKey === o.key}
                  className={`px-3 py-[5px] rounded-full border-0 cursor-pointer text-xs font-medium ${rangeKey === o.key ? "bg-ink text-white" : "bg-transparent text-text-sec hover:text-text"}`}
                >
                  {o.short}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-ter">Deliveries: {range.label.toLowerCase()}</span>
          </div>
        </div>

        {/* The equation, left to right: on hand = allocated + on hold + available. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
          <Kpi label="On hand" value={m3(snapshot.onHand)} sub={`${snapshot.lotsOnHand} lots · today`} onClick={() => onNavigateToLocator?.({ status: ["Available", "Reserved", "Received", "Discrepancy"] })} />
          <Kpi label="Allocated to customers" value={m3(snapshot.allocated)} sub={snapshot.inTransit > 0 ? `incl. ${m3(snapshot.inTransit)} in transit` : "still on hand · today"} onClick={() => onNavigateToLocator?.({ status: ["Reserved"] })} />
          <Kpi label="On hold" value={m3(snapshot.onHold)} sub="not yet sellable · today" onClick={() => onNavigateToLocator?.({ status: ["Discrepancy"] })} />
          <Kpi label="Available to allocate" value={m3(snapshot.available)} sub="on hand − allocated − on hold" strong onClick={() => onNavigateToLocator?.({ status: ["Available"] })} />
          <Kpi label="Delivered" value={m3(deliveredTotal)} sub={`${deliveredBooms.length} boom${deliveredBooms.length === 1 ? "" : "s"} · ${range.label.toLowerCase()}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2 bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
            <div className="text-[13px] font-display font-semibold text-text">Delivered by week</div>
            <div className="text-[11px] text-text-ter mb-3">Confirmed delivered volume · {range.label.toLowerCase()}</div>
            {deliveredBooms.length === 0 ? (
              <div className="text-[13px] text-text-ter py-10 text-center">No deliveries in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} barCategoryGap="28%" accessibilityLayer={false}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.textTer }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => [m3(Number(v)), "Delivered"]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} cursor={{ fill: C.sage, fillOpacity: 0.25 }} />
                  <Bar dataKey="volume" fill={C.ink} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-[10px] pt-5 px-5 pb-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
            <div className="text-[13px] font-display font-semibold text-text">On hand by storage site</div>
            <div className="text-[11px] text-text-ter mb-3">Today · click a site to see its lots</div>
            <div className="flex flex-col gap-3">
              {siteRows.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => onNavigateToLocator?.({ yard: [s.code], status: ["Available", "Reserved", "Discrepancy"] })}
                  className="text-left bg-transparent border-0 p-0 cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-medium text-text group-hover:text-coral">{s.name}</span>
                    <span className="font-semibold text-ink tabular-nums">{m3(s.total)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#F3F4F6] overflow-hidden flex">
                    {s.total > 0 && (
                      <>
                        <span style={{ width: `${(s.allocated / s.total) * 100}%`, backgroundColor: "#AADB1E" }} />
                        <span style={{ width: `${(s.available / s.total) * 100}%`, backgroundColor: C.sage }} />
                        <span style={{ width: `${(s.onHold / s.total) * 100}%`, backgroundColor: "#F0542B" }} />
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-text-ter mt-1">{m3(s.allocated)} allocated · {m3(s.available)} available{s.onHold > 0 ? ` · ${m3(s.onHold)} on hold` : ""}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-display font-semibold text-text">By customer</div>
              <div className="text-[11px] text-text-ter">Committed = allocated and still on hand (today). Delivered follows the period.</div>
            </div>
            <Button size="sm" leftIcon={<Download size={13} />} onClick={exportCustomers} disabled={customerRows.length === 0}>Export CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-y border-sage">
                  {["Customer", "Committed", "of which in transit", "Open booms", "Delivered", "Booms delivered", "Last delivery"].map((h, i) => (
                    <th key={h} className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${i >= 1 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customerRows.map((r, i) => (
                  <tr key={r.id} onClick={() => onOpenClient?.(r.id)} className={`border-b border-[#F3F4F6] cursor-pointer ${i % 2 ? "bg-[#FAFAFA]" : ""} hover:bg-sage/20`}>
                    <td className="px-3.5 py-[11px] font-semibold text-ink">{getClientName(r.id)}</td>
                    <td className="px-3.5 py-[11px] text-right tabular-nums font-semibold">{m3(r.committed)}</td>
                    <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{r.transit > 0 ? m3(r.transit) : "—"}</td>
                    <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{r.activeBooms}</td>
                    <td className="px-3.5 py-[11px] text-right tabular-nums font-semibold">{m3(r.delivered)}</td>
                    <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{r.deliveredBooms}</td>
                    <td className="px-3.5 py-[11px] text-text-sec whitespace-nowrap">{r.lastDelivery ?? "—"}</td>
                  </tr>
                ))}
                {customerRows.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-text-sec">No allocations or deliveries yet.</td></tr>
                )}
              </tbody>
              {customerRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#F9FAFB] border-t border-sage font-semibold text-ink">
                    <td className="px-3.5 py-2.5">Total</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{m3(customerRows.reduce((s, r) => s + r.committed, 0))}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{m3(customerRows.reduce((s, r) => s + r.transit, 0))}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{customerRows.reduce((s, r) => s + r.activeBooms, 0)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{m3(customerRows.reduce((s, r) => s + r.delivered, 0))}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{customerRows.reduce((s, r) => s + r.deliveredBooms, 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="text-[11px] text-text-ter mt-3">
          Allocated lots still in storage — and booms in transit — count as on hand until delivery is confirmed. Available to allocate is on-hand volume minus allocated volume and lots on hold.
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, strong, onClick }: { label: string; value: string; sub: string; strong?: boolean; onClick?: () => void }) {
  const cls = `rounded-[10px] px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] text-left w-full border-0 ${strong ? "bg-sage" : "bg-white"} ${onClick ? "cursor-pointer hover:shadow-[0_2px_10px_rgba(0,0,0,0.12)]" : ""}`;
  const body = (
    <>
      <div className={`text-[12px] ${strong ? "text-ink/70" : "text-text-sec"}`}>{label}</div>
      <div className="text-[24px] font-bold text-ink leading-tight mt-1.5 tabular-nums" style={{ fontFamily: "Montserrat, sans-serif" }}>{value}</div>
      <div className={`text-[11px] mt-0.5 ${strong ? "text-ink/60" : "text-text-ter"}`}>{sub}</div>
    </>
  );
  return onClick ? <button type="button" className={cls} onClick={onClick}>{body}</button> : <div className={cls}>{body}</div>;
}
