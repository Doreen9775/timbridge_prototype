// Non-component helpers shared by the Pulse tabs (kept out of parts.tsx so that file
// only exports components and stays Fast-Refresh friendly).

// Brand palette mirrors Dashboard.tsx — recharts needs hex values, not Tailwind classes.
export const C = {
  ink: "#1F1F1F",
  coral: "#F0542B",
  lime: "#AADB1E",
  sage: "#B7CDC2",
  textSec: "#6B7280",
  textTer: "#9CA3AF",
};

export const TOOLTIP_STYLE = { fontSize: 12, border: `1px solid ${C.sage}`, borderRadius: 6 };

// ── CSV ──────────────────────────────────────────────────────────────────────────
// Mirrors the StockLocator csvCell to keep export behavior consistent across features
// (RFC 4180 quoting, doubled quotes for embedded ").
export const csvCell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;

export function csvFilename(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `timbridge_${prefix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.csv`;
}

export function downloadCsv(csv: string, filename: string) {
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

// Header row + data rows → CRLF-joined CSV, downloaded under a timestamped filename.
export function exportRows(prefix: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  downloadCsv(lines.join("\r\n"), csvFilename(prefix));
}
