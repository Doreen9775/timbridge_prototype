import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import { ArrowLeftRight, PackageCheck, BookmarkCheck, BadgeCheck, ScanLine, type LucideIcon } from "lucide-react";
import type { Tag, TagStatus, Species, ActivityType } from "@/lib/types";
import { recentActivity, floorTasks } from "@/lib/mock-data";
import { Sparkline } from "@/components/shared/Sparkline";

const ACTIVITY_META: Record<ActivityType, { label: string; Icon: LucideIcon }> = {
  move: { label: "Moved", Icon: ArrowLeftRight },
  receive: { label: "Received", Icon: PackageCheck },
  reserve: { label: "Reserved", Icon: BookmarkCheck },
  qc: { label: "QC", Icon: BadgeCheck },
  scan: { label: "Scanned", Icon: ScanLine },
};
const ACTIVITY_FILTERS: (ActivityType | "all")[] = ["all", "move", "receive", "reserve", "qc", "scan"];

// Brand colors for chart primitives (recharts needs values, not classes).
const C = {
  ink: "#1F1F1F", coral: "#F0542B", lime: "#AADB1E", sage: "#B7CDC2",
  textSec: "#6B7280", textTer: "#9CA3AF",
};

// Status colors follow the overall scheme: Available = sage and Reserved = lime
// (matching their KPI cards), Discrepancy = coral (alert), transitional states = neutrals.
const STATUS_FILL: Record<TagStatus, string> = {
  Available: C.sage,
  Reserved: C.lime,
  Pending: C.textTer,
  Received: C.textSec,
  Shipped: C.ink,
  Discrepancy: C.coral,
};
const STATUS_ORDER: TagStatus[] = ["Available", "Reserved", "Pending", "Received", "Shipped", "Discrepancy"];
const SPECIES: Species[] = ["SPF", "Doug Fir", "Western Red Cedar", "Hem-Fir"];

interface DashboardProps {
  tags: Tag[];
  floorView: boolean;
}

export function Dashboard({ tags, floorView }: DashboardProps) {
  const available = tags.filter((t) => t.status === "Available");
  const reserved = tags.filter((t) => t.status === "Reserved");
  const totalFBM = available.reduce((s, t) => s + t.fbm, 0);

  const [activityFilter, setActivityFilter] = useState<ActivityType | "all">("all");
  const filteredActivity = recentActivity.filter((a) => activityFilter === "all" || a.type === activityFilter);

  const speciesData = SPECIES.map((sp) => ({
    name: sp === "Western Red Cedar" ? "W.R. Cedar" : sp,
    fbm: tags.filter((t) => t.species === sp).reduce((s, t) => s + t.fbm, 0),
  }));

  const statusData = STATUS_ORDER.map((st) => ({
    name: st,
    value: tags.filter((t) => t.status === st).length,
    fill: STATUS_FILL[st],
  })).filter((d) => d.value > 0);

  if (floorView) {
    return (
      <div className="p-6 bg-cream min-h-full">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 border border-sage">
            <div className="text-sm text-text-sec mb-2">My Tasks Today</div>
            <div className="text-5xl font-bold text-ink mb-4">3</div>
            {floorTasks.map((t, i) => (
              <div key={i} className="px-4 py-3.5 bg-cream rounded-lg mb-2 cursor-pointer">
                <div className="text-lg font-semibold text-text mb-1">{t.title}</div>
                <div className="text-sm text-text-sec">{t.loc}</div>
                {t.priority === "High" && (
                  <span className="text-xs bg-coral/10 text-coral px-2 py-0.5 rounded-[10px] mt-1.5 inline-block">High Priority</span>
                )}
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl p-6 border border-sage">
            <div className="text-sm text-text-sec mb-2">Recent Scans</div>
            <div className="text-5xl font-bold text-ink mb-4">5</div>
            {recentActivity.map((a, i) => (
              <div key={i} className={`py-3 ${i < 4 ? "border-b border-sage" : ""}`}>
                <div className="text-base text-text font-medium">{a.msg.split(" ").slice(0, 3).join(" ")}…</div>
                <div className="text-[13px] text-text-sec mt-0.5">{a.worker} · {a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kpis: { label: string; value: string | number; sub: string; spark?: number[]; alert?: boolean }[] = [
    { label: "Total FBM Available", value: totalFBM.toLocaleString(), sub: "board feet", spark: [8200, 9100, 8700, 10200, 11400, 10800, totalFBM] },
    { label: "Tags Available", value: available.length, sub: "+2 vs last week", spark: [9, 10, 11, 10, 12, 11, available.length] },
    { label: "Tags Reserved", value: reserved.length, sub: "active holds", alert: reserved.length > 5 },
    { label: "Low Stock Alerts", value: tags.filter((t) => t.qty < 50).length, sub: "qty < 50 units", alert: true },
  ];

  // Colored KPI cards (reference layout, brand colors): neutral white + sage + coral + lime.
  const kpiThemes = [
    { card: "bg-white", label: "text-text-sec", value: "text-ink", sub: "text-text-ter" }, // Total FBM
    { card: "bg-sage", label: "text-ink/70", value: "text-ink", sub: "text-ink/60" }, // Tags Available
    { card: "bg-lime", label: "text-ink/70", value: "text-ink", sub: "text-ink/60" }, // Tags Reserved
    { card: "bg-coral", label: "text-white/85", value: "text-white", sub: "text-white/75" }, // Low Stock Alerts
  ];

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {["Today", "This Week", "This Month"].map((t) => {
            const active = t === "This Week";
            return (
              <button
                key={t}
                className={[
                  "px-3.5 py-[5px] rounded-2xl text-xs cursor-pointer border",
                  active ? "border-ink bg-ink text-white" : "border-sage bg-transparent text-text-sec",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-text-ter">Last updated 14:32</span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map((c, i) => {
          const th = kpiThemes[i % kpiThemes.length];
          return (
            <div key={i} className={`${th.card} rounded-2xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]`}>
              <div className={`text-xs mb-2 ${th.label}`}>{c.label}</div>
              <div className="flex items-end justify-between">
                <div>
                  <div className={`text-[30px] font-bold leading-none ${th.value}`}>{c.value}</div>
                  <div className={`text-[11px] mt-1.5 ${th.sub}`}>{c.sub}</div>
                </div>
                {c.spark && <Sparkline data={c.spark} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-[10px] pt-5 px-5 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="text-[13px] font-medium text-text mb-4">FBM by Species</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={speciesData} barCategoryGap="30%">
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 10, fill: C.textSec }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} FBM`]} contentStyle={{ fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 }} />
              <Bar dataKey="fbm" radius={[4, 4, 0, 0]}>
                {speciesData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? C.ink : C.coral} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-[10px] pt-5 px-5 pb-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
          <div className="text-[13px] font-medium text-text mb-4">Tag Status Distribution</div>
          <div className="flex items-center gap-2">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" labelLine={false}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} tags`]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: d.fill }} />
                  <span className="text-text flex-1">{d.name}</span>
                  <span className="text-text-sec font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[10px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="text-[13px] font-medium text-text">Recent Activity</div>
          <div className="flex gap-1.5 flex-wrap">
            {ACTIVITY_FILTERS.map((f) => {
              const active = activityFilter === f;
              const label = f === "all" ? "All" : ACTIVITY_META[f].label;
              return (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f)}
                  className={[
                    "px-2.5 py-1 rounded-full text-[11px] cursor-pointer border",
                    active ? "border-ink bg-ink text-white" : "border-sage bg-transparent text-text-sec",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {filteredActivity.map((a, i) => {
          const { Icon } = ACTIVITY_META[a.type];
          return (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${i < filteredActivity.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}>
              <span className="w-7 h-7 rounded-md bg-sage/30 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-ink" />
              </span>
              <span className="flex-1 text-[13px] text-text">{a.msg}</span>
              <span className="text-xs text-text-sec font-medium">{a.worker}</span>
              <span className="text-xs text-text-ter min-w-[60px] text-right">{a.time}</span>
            </div>
          );
        })}
        {filteredActivity.length === 0 && (
          <div className="py-6 text-center text-xs text-text-ter">No activity in this category.</div>
        )}
      </div>
    </div>
  );
}
