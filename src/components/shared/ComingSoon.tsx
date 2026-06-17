// Placeholder for modules that aren't built yet (and, during the port,
// for the content area before features are wired in).
export function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] text-text-sec">
      <div className="text-5xl mb-4">🚧</div>
      <div className="text-xl font-medium text-text mb-2">{name}</div>
      <div className="text-sm">This module is coming soon.</div>
    </div>
  );
}
