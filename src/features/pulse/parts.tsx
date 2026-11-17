// Shared building blocks for the Pulse tabs — one card shell, one KPI tile, one delta
// badge and one CSV path, so every tab reads as the same page.
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Minus } from "lucide-react";
import type { Delta } from "@/lib/analytics";

import { C } from "./pulseUtils";

// Compact per-chart CSV export affordance — lives in each card's own header. Disabled +
// tooltip when there is nothing to export.
export function ChartExportButton({ onClick, disabled, ariaLabel }: { onClick: () => void; disabled: boolean; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "No data to export" : "Export CSV"}
      aria-label={ariaLabel}
      className={[
        "flex items-center justify-center w-7 h-7 rounded-md border bg-white transition-colors shrink-0",
        disabled
          ? "border-sage/50 text-text-ter opacity-50 cursor-not-allowed"
          : "border-sage text-text-sec hover:border-coral hover:text-coral cursor-pointer",
      ].join(" ")}
    >
      <Download size={14} />
    </button>
  );
}

// ── Card shell ───────────────────────────────────────────────────────────────────

export function Card({ title, hint, actions, children, className }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[10px] pt-5 px-5 pb-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-[13px] font-display font-semibold text-text">{title}</div>
          {hint && <div className="text-[11px] text-text-ter mt-0.5">{hint}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-[13px] text-text-ter py-10 text-center">{children}</div>;
}

// Small label marking a card that ignores the period picker (point-in-time figures).
export function SnapshotTag() {
  return (
    <span title="Point-in-time figure — not affected by the period picker" className="text-[10px] font-medium uppercase tracking-wide text-text-ter bg-[#F3F4F6] rounded-full px-2 py-0.5 whitespace-nowrap">
      As of today
    </span>
  );
}

// ── Delta badge + KPI tile ───────────────────────────────────────────────────────

// Period-over-period change. `delta` null = nothing to compare against; flat also
// renders the muted dash — never a misleading "0%". `neutral` drops the good/bad
// coloring for metrics where "up" isn't inherently good (e.g. discount given).
export function DeltaBadge({ delta, suffix = "vs prev. period", neutral }: { delta: Delta | null; suffix?: string; neutral?: boolean }) {
  if (!delta || delta.dir === "flat") {
    return (
      <span
        title={delta ? `No change ${suffix}` : "No earlier period to compare"}
        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-text-ter bg-[#F3F4F6] rounded-full px-2 py-0.5"
      >
        <Minus size={11} />
      </span>
    );
  }
  const up = delta.dir === "up";
  const tone = neutral ? "text-text-sec bg-[#F3F4F6]" : up ? "text-[#4E6B0E] bg-[#EAF5D0]" : "text-[#B23A1A] bg-[#FCE0D7]";
  return (
    <span title={`${up ? "+" : ""}${delta.pct}% ${suffix}`} className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {up ? "+" : ""}{delta.pct}%
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: Delta | null; // omit entirely for snapshot metrics with no comparison
  neutralDelta?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function KpiCard({ label, value, sub, delta, neutralDelta, onClick, ariaLabel }: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-text-sec truncate">{label}</div>
        {delta !== undefined && <DeltaBadge delta={delta} neutral={neutralDelta} />}
      </div>
      <div className="text-[24px] font-bold text-ink leading-tight mt-1.5 tabular-nums" style={{ fontFamily: "Montserrat, sans-serif" }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-text-ter mt-0.5 truncate">{sub}</div>}
    </>
  );
  const cls = "bg-white rounded-[10px] px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] text-left w-full";
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel ?? label} className={`${cls} border-0 cursor-pointer transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.12)] focus-visible:outline-2 focus-visible:outline-coral`}>
      {body}
    </button>
  );
}

// Inline stat used inside summary cards (label above, value below).
export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "alert" }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-text-sec">{label}</div>
      <div className={`text-[18px] font-bold leading-tight mt-0.5 tabular-nums ${tone === "alert" ? "text-coral" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-[11px] text-text-ter mt-0.5">{sub}</div>}
    </div>
  );
}

// Horizontal proportion bar for ranked lists (clients, territories, pipeline stages).
export function ShareBar({ ratio, color = C.ink }: { ratio: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, backgroundColor: color }} />
    </div>
  );
}
