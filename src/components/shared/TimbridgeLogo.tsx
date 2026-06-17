// Timbridge logo — twin-pine mark + wordmark.
// NOTE: this is a faithful recreation, not the official vector. To use the real
// asset, drop the official SVG into src/assets and swap the <svg> below for it.
// Color comes from `currentColor`, so set a text color on the parent (e.g. text-coral).
interface TimbridgeLogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function TimbridgeLogo({ className, showWordmark = true }: TimbridgeLogoProps) {
  return (
    <div className={["flex items-center gap-2", className].filter(Boolean).join(" ")}>
      <svg viewBox="0 0 200 120" className="h-7 w-auto" fill="currentColor" aria-hidden="true">
        {/* left pine */}
        <polygon points="58,8 80,50 36,50" />
        <polygon points="58,28 88,76 28,76" />
        <polygon points="58,52 96,104 20,104" />
        <rect x="52" y="100" width="12" height="18" />
        {/* right pine */}
        <polygon points="142,8 164,50 120,50" />
        <polygon points="142,28 172,76 112,76" />
        <polygon points="142,52 180,104 104,104" />
        <rect x="136" y="100" width="12" height="18" />
      </svg>
      {showWordmark && (
        <span className="font-bold text-[17px] tracking-[1px]">TIMBRIDGE</span>
      )}
    </div>
  );
}
