import logoUrl from "@/assets/timbridge-logo.svg";

// Official Timbridge logo (twin-pine mark + wordmark). To update it, just replace
// the file at src/assets/timbridge-logo.svg — no code change needed.
export function TimbridgeLogo({ className = "w-[160px] h-auto" }: { className?: string }) {
  return <img src={logoUrl} alt="Timbridge" className={className} />;
}
