import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, MapPin, Plus, Search, Ship, Truck, X } from "lucide-react";
import type { BoomInfo, Role, SalesOrder, Tag } from "@/lib/types";
import { usePack } from "@/hooks/usePack";
import { useClients } from "@/hooks/useClients";
import { SOStatusPill } from "@/components/shared/SOStatusPill";
import { Button } from "@/components/shared/Button";
import { calcExtendedPrice } from "@/lib/pricing";

// Booms (log-trading pack). A boom is a customer order for scaled lots that also lives
// physically: it is formed at a storage site, can be moved between sites, goes into
// transit and is delivered. Status mapping (stored → shown): Open → In storage,
// Picked → In transit, Shipped → Delivered. All writes go through App handlers so the
// boom and its lots never disagree.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${p2(d)}, ${y}`;
};
// "Nov 17 2026 14:05" → "Nov 17, 2026" (matches fmtDate).
const stampDate = (stamp: string) => `${stamp.slice(0, 6)}, ${stamp.slice(7, 11)}`;
const m3 = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })} m³`;
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
const allocatedOf = (so: SalesOrder) => Math.round(so.lineItems.reduce((s, li) => s + li.qty, 0) * 10) / 10;
const valueOf = (so: SalesOrder) => so.lineItems.reduce((s, li) => s + calcExtendedPrice(li.qty, li.unitPrice, li.discountPct), 0);

type Filter = "all" | "Open" | "Picked" | "Shipped";

interface BoomsProps {
  tags: Tag[];
  salesOrders: SalesOrder[];
  role: Role;
  openSoId?: string | null;
  onSoOpened?: () => void;
  onCreateBoom: (
    clientId: string,
    lines: { tagId: string; qty: number; unitPrice: number }[],
    boom: BoomInfo,
    notes?: string,
    expectedShipDate?: string,
  ) => { ok: true; soId: string } | { ok: false; unavailableIds: string[] };
  onMoveBoom: (soId: string, to: string) => void;
  onMarkInTransit: (soId: string) => void;
  onConfirmDelivery: (soId: string, delivery: { date: string; volume: number }) => void;
  onOpenTag: (tagId: string) => void;
  onOpenClient: (clientId: string) => void;
}

export function Booms({ tags, salesOrders, openSoId, onSoOpened, onCreateBoom, onMoveBoom, onMarkInTransit, onConfirmDelivery, onOpenTag, onOpenClient }: BoomsProps) {
  const { pack } = usePack();
  const { getClientName } = useClients();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [allocating, setAllocating] = useState(false);

  // Deep link (Log Inventory "linked boom", Client Profile, Volume Report) → open the drawer.
  useEffect(() => {
    if (openSoId) {
      setSelected(openSoId);
      onSoOpened?.();
    }
  }, [openSoId, onSoOpened]);

  const booms = useMemo(() => salesOrders.filter((so) => so.boom && so.status !== "Draft" && so.status !== "Cancelled"), [salesOrders]);
  const siteName = (code: string) => pack.sites.find((s) => s.code === code)?.name ?? code;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return booms
      .filter((so) => filter === "all" || so.status === filter)
      .filter((so) => !q || [so.boom!.id, so.id, getClientName(so.clientId), siteName(so.boom!.location)].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        // Active booms first (in transit, then in storage), newest first within a group.
        const rank = (s: SalesOrder) => (s.status === "Picked" ? 0 : s.status === "Open" ? 1 : 2);
        return rank(a) - rank(b) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      });
    // siteName only reads pack.sites
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booms, filter, search, getClientName, pack]);

  const summary = useMemo(() => {
    const by = (st: SalesOrder["status"]) => booms.filter((b) => b.status === st);
    return {
      storage: by("Open"),
      transit: by("Picked"),
      delivered: by("Shipped"),
    };
  }, [booms]);

  const selectedSo = selected ? salesOrders.find((so) => so.id === selected) ?? null : null;

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: booms.length },
    { key: "Open", label: pack.orderStatusLabel.Open, count: summary.storage.length },
    { key: "Picked", label: pack.orderStatusLabel.Picked, count: summary.transit.length },
    { key: "Shipped", label: pack.orderStatusLabel.Shipped, count: summary.delivered.length },
  ];

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[1600px] mx-auto" data-onboarding="booms-page">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>Booms</h1>
            <p className="text-sm text-text-sec mt-1">Lots allocated to customers, where each boom is, and what has been delivered.</p>
          </div>
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setAllocating(true)}>Allocate to new boom</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <SummaryCard icon={<MapPin size={16} />} label={pack.orderStatusLabel.Open} count={summary.storage.length} volume={summary.storage.reduce((s, b) => s + allocatedOf(b), 0)} />
          <SummaryCard icon={<Ship size={16} />} label={pack.orderStatusLabel.Picked} count={summary.transit.length} volume={summary.transit.reduce((s, b) => s + allocatedOf(b), 0)} />
          <SummaryCard icon={<Check size={16} />} label={`${pack.orderStatusLabel.Shipped} (all time)`} count={summary.delivered.length} volume={summary.delivered.reduce((s, b) => s + (b.boom?.deliveredVolume ?? allocatedOf(b)), 0)} />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex bg-white border border-sage rounded-full p-[3px] gap-[2px]">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={`px-3 py-[5px] rounded-full border-0 cursor-pointer text-xs font-medium ${filter === t.key ? "bg-ink text-white" : "bg-transparent text-text-sec hover:text-text"}`}
              >
                {t.label} · {t.count}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sec" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boom, customer, location..."
              className="w-full py-2 pl-[38px] pr-3 text-sm border border-sage rounded-lg outline-none bg-white box-border"
            />
          </div>
        </div>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-sage">
                  {["Boom", "Customer", "Status", "Location", "Allocated", "Delivered", "Allocated on", "Expected delivery"].map((h, i) => (
                    <th key={h} className={`px-3.5 py-2.5 text-text-sec font-medium whitespace-nowrap text-xs ${i === 4 || i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((so, i) => {
                  const overdue = (so.status === "Open" || so.status === "Picked") && !!so.expectedShipDate && so.expectedShipDate < todayIso();
                  return (
                    <tr
                      key={so.id}
                      onClick={() => setSelected(so.id)}
                      className={`border-b border-[#F3F4F6] cursor-pointer ${selected === so.id ? "bg-coral/[0.12]" : `${i % 2 ? "bg-[#FAFAFA]" : ""} hover:bg-sage/20`}`}
                    >
                      <td className="px-3.5 py-[11px] font-mono font-semibold text-ink whitespace-nowrap">{so.boom!.id}</td>
                      <td className="px-3.5 py-[11px]">{getClientName(so.clientId)}</td>
                      <td className="px-3.5 py-[11px]"><SOStatusPill status={so.status} /></td>
                      <td className="px-3.5 py-[11px] text-text-sec whitespace-nowrap">{so.status === "Shipped" ? "—" : siteName(so.boom!.location)}</td>
                      <td className="px-3.5 py-[11px] text-right tabular-nums font-semibold">{m3(allocatedOf(so))}</td>
                      <td className="px-3.5 py-[11px] text-right tabular-nums text-text-sec">{so.boom!.deliveredVolume !== undefined ? m3(so.boom!.deliveredVolume) : "—"}</td>
                      <td className="px-3.5 py-[11px] text-text-sec whitespace-nowrap">{fmtDate(so.date)}</td>
                      <td className={`px-3.5 py-[11px] whitespace-nowrap ${overdue ? "text-coral font-semibold" : "text-text-sec"}`}>
                        {so.status === "Shipped" ? `Delivered ${fmtDate(so.boom!.deliveredDate)}` : fmtDate(so.expectedShipDate)}
                        {overdue && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-text-sec">No booms match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedSo?.boom && (
        <BoomDrawer
          so={selectedSo}
          tags={tags}
          onClose={() => setSelected(null)}
          onMove={(to) => onMoveBoom(selectedSo.id, to)}
          onTransit={() => onMarkInTransit(selectedSo.id)}
          onDeliver={(d) => onConfirmDelivery(selectedSo.id, d)}
          onOpenTag={onOpenTag}
          onOpenClient={onOpenClient}
        />
      )}

      {allocating && (
        <AllocateModal
          tags={tags}
          salesOrders={salesOrders}
          onClose={() => setAllocating(false)}
          onCreate={(clientId, lines, boom, notes, expected) => {
            const res = onCreateBoom(clientId, lines, boom, notes, expected);
            if (res.ok) {
              setAllocating(false);
              setSelected(res.soId);
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, count, volume }: { icon: React.ReactNode; label: string; count: number; volume: number }) {
  return (
    <div className="bg-white rounded-[10px] px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
      <div className="flex items-center gap-1.5 text-[12px] text-text-sec">{icon}{label}</div>
      <div className="text-[24px] font-bold text-ink leading-tight mt-1 tabular-nums" style={{ fontFamily: "Montserrat, sans-serif" }}>{m3(volume)}</div>
      <div className="text-[11px] text-text-ter">{count} boom{count === 1 ? "" : "s"}</div>
    </div>
  );
}

// ── Boom detail ─────────────────────────────────────────────────────────────────

function BoomDrawer({ so, tags, onClose, onMove, onTransit, onDeliver, onOpenTag, onOpenClient }: {
  so: SalesOrder;
  tags: Tag[];
  onClose: () => void;
  onMove: (to: string) => void;
  onTransit: () => void;
  onDeliver: (d: { date: string; volume: number }) => void;
  onOpenTag: (id: string) => void;
  onOpenClient: (id: string) => void;
}) {
  const { pack } = usePack();
  const { getClientName } = useClients();
  const boom = so.boom!;
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const allocated = allocatedOf(so);
  const active = so.status === "Open" || so.status === "Picked";
  const siteName = (code: string) => pack.sites.find((s) => s.code === code)?.name ?? code;
  const [moveTo, setMoveTo] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [delDate, setDelDate] = useState(todayIso());
  const [delVol, setDelVol] = useState(String(allocated));
  const delVolNum = Math.round(Number(delVol) * 10) / 10;
  const variance = boom.deliveredVolume !== undefined ? Math.round((boom.deliveredVolume - allocated) * 10) / 10 : null;

  // Timeline: formed → moves → (in transit) → delivered, oldest first.
  const formedAt = boom.moves[0]?.from ?? boom.location;
  const timeline: { label: string; when: string }[] = [
    { label: `Formed at ${siteName(formedAt)} — ${m3(allocated)} allocated`, when: fmtDate(so.date) },
    ...boom.moves.map((mv) => ({ label: `Moved ${siteName(mv.from)} → ${siteName(mv.to)}`, when: stampDate(mv.at) })),
  ];
  if (so.status === "Picked" || so.status === "Shipped") {
    const ev = so.lineItems.map((li) => tagById.get(li.tagId)?.history.find((h) => h.e.startsWith("In transit"))).find(Boolean);
    if (ev) timeline.push({ label: "In transit", when: stampDate(ev.t) });
  }
  if (so.status === "Shipped") timeline.push({ label: `Delivered — ${m3(boom.deliveredVolume ?? allocated)}`, when: fmtDate(boom.deliveredDate) });

  const inputCls = "border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <div className="w-full max-w-[520px] h-full bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Boom ${boom.id}`}>
        <div className="px-5 pt-5 pb-4 border-b border-sage flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-bold text-ink">{boom.id}</span>
              <SOStatusPill status={so.status} />
            </div>
            <button type="button" onClick={() => onOpenClient(so.clientId)} className="mt-1 text-[13px] text-coral hover:underline bg-transparent border-0 p-0 cursor-pointer">
              {getClientName(so.clientId)}
            </button>
            <div className="text-[11px] text-text-ter mt-0.5">Order {so.id}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Allocated" value={m3(allocated)} />
            <Tile label={so.status === "Shipped" ? "Delivered" : "Location"} value={so.status === "Shipped" ? m3(boom.deliveredVolume ?? allocated) : siteName(boom.location)} />
            <Tile label="Value (list)" value={money(valueOf(so))} />
          </div>
          {variance !== null && variance !== 0 && (
            <div className="text-[12px] text-text-sec bg-[#F9FAFB] rounded-md px-3 py-2">
              Delivered volume differs from allocated by <span className="font-semibold text-ink">{variance > 0 ? "+" : ""}{variance} m³</span>.
            </div>
          )}

          <div>
            <div className="text-xs text-text-sec mb-2">Lots in this boom</div>
            <div className="border border-sage/60 rounded-md overflow-hidden">
              {so.lineItems.map((li) => {
                const t = tagById.get(li.tagId);
                return (
                  <button
                    key={li.tagId}
                    type="button"
                    onClick={() => onOpenTag(li.tagId)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-[13px] text-left bg-white hover:bg-sage/15 border-0 border-b border-[#F3F4F6] last:border-b-0 cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="font-mono font-semibold text-ink">{li.tagId}</span>
                      <span className="text-text-sec"> · {t ? `${t.species} ${t.grade}` : "—"}{t?.scaleRef ? ` · ${t.scaleRef}` : ""}</span>
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="font-semibold">{m3(li.qty)}</span>
                      <span className="text-text-ter"> @ ${li.unitPrice.toFixed(2)}{li.discountPct ? ` −${li.discountPct}%` : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs text-text-sec mb-2">Storage & delivery</div>
            <ol className="relative border-l border-sage ml-1.5 space-y-2.5">
              {timeline.map((ev, i) => (
                <li key={i} className="pl-4 relative">
                  <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${i === timeline.length - 1 ? "bg-ink" : "bg-sage"}`} />
                  <div className="text-[13px] text-text">{ev.label}</div>
                  <div className="text-[11px] text-text-ter">{ev.when}</div>
                </li>
              ))}
            </ol>
            {so.expectedShipDate && active && <div className="text-[12px] text-text-sec mt-3">Expected delivery: {fmtDate(so.expectedShipDate)}</div>}
            {so.notes && <div className="text-[12px] text-text-sec italic mt-2">{so.notes}</div>}
          </div>

          {active && !delivering && (
            <div className="space-y-3 border-t border-sage pt-4">
              {so.status === "Open" && (
                <div>
                  <div className="text-xs text-text-sec mb-1.5">Record a storage move</div>
                  <div className="flex gap-2">
                    <select className={`${inputCls} flex-1`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move boom to">
                      <option value="">Move to…</option>
                      {pack.sites.filter((s) => s.code !== boom.location).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                    <Button
                      disabled={!moveTo}
                      leftIcon={<ArrowRight size={14} />}
                      onClick={() => {
                        onMove(moveTo);
                        setMoveTo("");
                      }}
                    >
                      Move
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {so.status === "Open" && <Button leftIcon={<Truck size={14} />} onClick={onTransit}>Mark in transit</Button>}
                <Button variant="primary" leftIcon={<Check size={14} />} onClick={() => setDelivering(true)}>Confirm delivery</Button>
              </div>
            </div>
          )}

          {active && delivering && (
            <div className="border-t border-sage pt-4">
              <div className="text-[14px] font-semibold text-ink mb-3">Confirm delivery of {boom.id}</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="block">
                  <div className="text-[11px] text-text-sec mb-1">Delivery date</div>
                  <input type="date" className={`${inputCls} w-full`} value={delDate} max={todayIso()} onChange={(e) => setDelDate(e.target.value)} />
                </label>
                <label className="block">
                  <div className="text-[11px] text-text-sec mb-1">Delivered volume (m³)</div>
                  <input type="number" min="0" step="0.1" className={`${inputCls} w-full`} value={delVol} onChange={(e) => setDelVol(e.target.value)} />
                </label>
              </div>
              {delVolNum > 0 && delVolNum !== allocated && (
                <div className="text-[12px] text-text-sec mb-3">
                  {delVolNum > allocated ? "More" : "Less"} than allocated ({m3(allocated)}) — the difference is recorded on the boom.
                </div>
              )}
              <div className="text-[12px] text-text-ter mb-3">All lots in the boom leave on-hand inventory and are recorded as delivered.</div>
              <div className="flex gap-2">
                <Button onClick={() => setDelivering(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  disabled={!(delVolNum > 0) || !delDate}
                  onClick={() => {
                    onDeliver({ date: delDate, volume: delVolNum });
                    setDelivering(false);
                  }}
                >
                  Confirm delivery
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F9FAFB] rounded-md px-3 py-2">
      <div className="text-[10px] text-text-ter mb-0.5">{label}</div>
      <div className="text-[14px] font-semibold text-ink">{value}</div>
    </div>
  );
}

// ── Allocate lots to a new boom ─────────────────────────────────────────────────

function AllocateModal({ tags, salesOrders, onClose, onCreate }: {
  tags: Tag[];
  salesOrders: SalesOrder[];
  onClose: () => void;
  onCreate: (
    clientId: string,
    lines: { tagId: string; qty: number; unitPrice: number }[],
    boom: BoomInfo,
    notes?: string,
    expected?: string,
  ) => { ok: true; soId: string } | { ok: false; unavailableIds: string[] };
}) {
  const { pack } = usePack();
  const { clients } = useClients();
  const available = useMemo(() => tags.filter((t) => t.productType === "log" && t.status === "Available").sort((a, b) => a.id.localeCompare(b.id)), [tags]);
  const suggestedId = useMemo(() => {
    const max = salesOrders.reduce((m, so) => Math.max(m, Number(so.boom?.id.match(/^BM-(\d+)$/)?.[1] ?? 0)), 100);
    return `BM-${String(max + 1).padStart(4, "0")}`;
  }, [salesOrders]);
  const [clientId, setClientId] = useState("");
  const [boomId, setBoomId] = useState(suggestedId);
  // Boom location defaults to where the first selected lot sits, until set by hand.
  const [siteChoice, setSiteChoice] = useState<string | null>(null);
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({}); // lot id → m³ to allocate (as typed)
  const [error, setError] = useState<string | null>(null);

  const lines = available
    .filter((t) => picked[t.id] !== undefined)
    .map((t) => ({ t, qty: Math.round(Number(picked[t.id]) * 10) / 10 }));
  const site = siteChoice ?? lines[0]?.t.yard ?? pack.sites[0]?.code ?? "";
  const invalid = lines.filter(({ t, qty }) => !(qty > 0) || qty > t.qty);
  const total = lines.reduce((s, l) => s + (l.qty > 0 ? l.qty : 0), 0);
  const value = lines.reduce((s, l) => s + (l.qty > 0 ? l.qty * (l.t.marketValue ?? 0) : 0), 0);
  const idTaken = salesOrders.some((so) => so.boom?.id.toLowerCase() === boomId.trim().toLowerCase());
  const canSubmit = clientId && boomId.trim() && !idTaken && lines.length > 0 && invalid.length === 0;

  const toggle = (t: Tag) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[t.id] !== undefined) delete next[t.id];
      else next[t.id] = String(t.qty);
      return next;
    });

  const submit = () => {
    const res = onCreate(
      clientId,
      lines.map(({ t, qty }) => ({ tagId: t.id, qty, unitPrice: t.marketValue ?? 0 })),
      { id: boomId.trim(), location: site, moves: [] },
      notes.trim() || undefined,
      expected || undefined,
    );
    if (!res.ok) setError(`Lots no longer available: ${res.unavailableIds.join(", ")}`);
  };

  const inputCls = "w-full border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[860px] max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Allocate to new boom">
        <div className="px-5 py-4 border-b border-sage flex items-center justify-between">
          <div>
            <div className="text-[16px] font-semibold text-ink">Allocate to a new boom</div>
            <div className="text-[12px] text-text-sec">Pick available lots and how much of each to commit to this customer.</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 cursor-pointer text-text-sec p-1 hover:text-coral"><X size={18} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="block sm:col-span-2">
              <div className="text-[11px] text-text-sec mb-1">Customer</div>
              <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select customer…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-[11px] text-text-sec mb-1">Boom ID</div>
              <input className={inputCls} value={boomId} onChange={(e) => setBoomId(e.target.value)} />
              {idTaken && <div className="text-[11px] text-coral mt-0.5">Already used</div>}
            </label>
            <label className="block">
              <div className="text-[11px] text-text-sec mb-1">Boom location</div>
              <select className={inputCls} value={site} onChange={(e) => setSiteChoice(e.target.value)}>
                {pack.sites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-1">
              <div className="text-[11px] text-text-sec mb-1">Expected delivery</div>
              <input type="date" className={inputCls} value={expected} min={todayIso()} onChange={(e) => setExpected(e.target.value)} />
            </label>
            <label className="block sm:col-span-3">
              <div className="text-[11px] text-text-sec mb-1">Notes</div>
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </label>
          </div>

          <div className="border border-sage/60 rounded-md overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-sage">
                  {["", "Lot", "Species / grade", "Location", "Available", "Allocate (m³)", "List / m³"].map((h, i) => (
                    <th key={i} className={`px-3 py-2 text-text-sec font-medium text-xs whitespace-nowrap ${i >= 4 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {available.map((t) => {
                  const on = picked[t.id] !== undefined;
                  const qty = Number(picked[t.id]);
                  const bad = on && (!(qty > 0) || qty > t.qty);
                  return (
                    <tr key={t.id} className={`border-b border-[#F3F4F6] last:border-0 ${on ? "bg-sage/15" : ""}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={on} onChange={() => toggle(t)} aria-label={`Select ${t.id}`} className="accent-coral w-4 h-4 cursor-pointer" /></td>
                      <td className="px-3 py-2 font-mono font-semibold text-ink">{t.id}</td>
                      <td className="px-3 py-2">{t.species} · {t.grade}</td>
                      <td className="px-3 py-2 text-text-sec">{pack.sites.find((s) => s.code === t.yard)?.name ?? t.yard}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m3(t.qty)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          disabled={!on}
                          value={on ? picked[t.id] : ""}
                          onChange={(e) => setPicked((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          aria-label={`Volume to allocate from ${t.id}`}
                          className={`w-24 border rounded-md px-2 py-1 text-right text-[13px] outline-none ${bad ? "border-coral" : "border-sage"} disabled:bg-[#F9FAFB]`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-sec">${(t.marketValue ?? 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
                {available.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-text-sec">No lots are available to allocate.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {invalid.length > 0 && <div className="text-[12px] text-coral">Each allocation must be above 0 and no more than the lot's available volume.</div>}
          {error && <div className="text-[12px] text-coral">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-sage flex items-center justify-between gap-3">
          <div className="text-[13px] text-text-sec">
            Committing <span className="font-semibold text-ink">{m3(total)}</span> from {lines.length} lot{lines.length === 1 ? "" : "s"} · {money(value)} at list
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!canSubmit} onClick={submit}>Allocate</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
