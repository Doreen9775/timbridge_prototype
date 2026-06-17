// Tiny inline trend line for the dashboard KPI cards.
export function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 80;
      const y = 20 - ((v - min) / (max - min || 1)) * 18;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={80} height={20} className="block">
      <polyline points={pts} fill="none" stroke="#F0542B" strokeWidth={1.5} />
    </svg>
  );
}
