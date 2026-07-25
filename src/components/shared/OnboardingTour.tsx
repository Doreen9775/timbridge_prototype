import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { NavKey } from "@/components/layout/Sidebar";
import type { TourStep, TourPlacement } from "@/lib/onboardingSteps";

interface OnboardingTourProps {
  steps: TourStep[];
  isFloor: boolean;
  onNavigate: (nav: NavKey) => void;
  onClose: () => void;
}

const CARD_WIDTH = 300;

// Position the desktop spotlight card relative to the target rect. Approximate (doesn't
// measure the card) but clamped into the viewport — good enough for a prototype tooltip.
function computeCardStyle(rect: DOMRect, placement: TourPlacement): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Large target (≈ a whole page) → center the card instead of hugging an off-screen edge.
  if (rect.height > vh * 0.6 || rect.width > vw * 0.6) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  const clampLeft = (x: number) => Math.max(12, Math.min(x, vw - CARD_WIDTH - 12));
  const clampTop = (y: number) => Math.max(12, Math.min(y, vh - 180));
  const gap = 14;
  switch (placement) {
    case "top":
      return { top: rect.top - gap, left: clampLeft(rect.left), transform: "translateY(-100%)" };
    case "left":
      return { top: clampTop(rect.top), left: rect.left - gap, transform: "translateX(-100%)" };
    case "right": {
      // Fall back to below the target if a right-side card would overflow the viewport.
      if (rect.right + gap + CARD_WIDTH > vw) return { top: rect.bottom + gap, left: clampLeft(rect.left) };
      return { top: clampTop(rect.top), left: rect.right + gap };
    }
    case "bottom":
    default:
      return { top: rect.bottom + gap, left: clampLeft(rect.left) };
  }
}

export function OnboardingTour({ steps, isFloor, onNavigate, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      onClose();
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [stepIndex, steps.length, onClose]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  // Resolve the current step. Fast path: if the target is already in the DOM (we're on
  // the right page) measure it immediately with an INSTANT scroll — the card appears
  // directly at its final position, no center-then-jump. Otherwise navigate and poll,
  // showing just the dim backdrop (no mispositioned card) until the target mounts; if it
  // never appears, skip the step gracefully.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;

    const measure = (el: HTMLElement) => {
      targetElRef.current = el;
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
      setRect(el.getBoundingClientRect());
    };

    const existing = document.querySelector(`[data-onboarding="${step.target}"]`) as HTMLElement | null;
    if (existing) {
      measure(existing);
      return;
    }

    if (step.nav) onNavigate(step.nav);
    setRect(null);
    targetElRef.current = null;
    let tries = 0;
    const maxTries = 30;
    let timer = 0;
    const poll = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-onboarding="${step.target}"]`) as HTMLElement | null;
      if (el) {
        measure(el);
        return;
      }
      tries += 1;
      if (tries >= maxTries) {
        if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
        else onClose();
        return;
      }
      timer = window.setTimeout(poll, 70);
    };
    timer = window.setTimeout(poll, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, steps]);

  // Keep the spotlight aligned if the window resizes mid-tour.
  useEffect(() => {
    const onResize = () => {
      if (targetElRef.current) setRect(targetElRef.current.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!step) return null;

  const counter = (
    <div className="flex items-center gap-1.5">
      {steps.map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all ${i === stepIndex ? "w-4 h-1.5 bg-ink" : "w-1.5 h-1.5 bg-sage"}`}
        />
      ))}
    </div>
  );

  // ── Floor: bottom sheet (reuses FloorTagSheet's slide-up visual language) ──────
  if (isFloor) {
    return (
      <div className="fixed inset-0 z-[200] bg-ink/40 flex items-end justify-center" onClick={onClose}>
        <div
          className="bg-white w-full max-w-md rounded-t-2xl max-h-[85vh] overflow-y-auto p-6 animate-in slide-in-from-bottom duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-text-ter">Step {stepIndex + 1} of {steps.length}</span>
            <button
              onClick={onClose}
              aria-label="Close tour"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-sec hover:text-coral cursor-pointer bg-transparent border-0"
            >
              <X size={22} />
            </button>
          </div>
          <div className="text-xl font-display font-bold text-ink mb-2">{step.title}</div>
          <div className="text-base text-text-sec mb-6 leading-relaxed">{step.body}</div>
          <div className="flex items-center justify-between mb-4">{counter}</div>
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                onClick={goBack}
                className="flex-1 min-h-[48px] rounded-lg border border-sage text-ink text-base font-semibold cursor-pointer bg-white hover:bg-sage/15"
              >
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className="flex-1 min-h-[48px] rounded-lg bg-ink text-white text-base font-semibold cursor-pointer hover:brightness-110"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-3 min-h-[44px] text-text-ter text-sm cursor-pointer bg-transparent border-0 hover:text-text"
          >
            Skip tour
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop: dim backdrop (ink/40 lightbox) + spotlight cutout + tooltip card ──
  return (
    // Full-screen layer captures clicks so the underlying UI can't be interacted with
    // mid-tour; backdrop clicks intentionally do nothing (Skip / X dismiss explicitly).
    <div className="fixed inset-0 z-[200]" aria-live="polite">
      {rect ? (
        // Transparent ring at the target; its huge box-shadow paints the dim everywhere else.
        <div
          className="fixed rounded-[10px] pointer-events-none border-2 border-coral/45"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(31, 31, 31, 0.5)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/40 pointer-events-none" />
      )}

      {/* Card renders only once positioned — avoids the center-then-jump flash. */}
      {rect && (
      <div
        className="fixed w-[300px] bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.22)] p-4"
        style={computeCardStyle(rect, step.placement ?? "bottom")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-text-ter">Step {stepIndex + 1} of {steps.length}</span>
          <button
            onClick={onClose}
            aria-label="Close tour"
            className="flex items-center justify-center w-6 h-6 -mr-1 -mt-1 text-text-sec hover:text-coral cursor-pointer bg-transparent border-0"
          >
            <X size={15} />
          </button>
        </div>
        <div className="text-[15px] font-display font-bold text-ink mb-1">{step.title}</div>
        <div className="text-[13px] text-text-sec mb-3 leading-snug">{step.body}</div>
        <div className="flex items-center justify-between">
          {counter}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[12px] text-text-ter hover:text-text cursor-pointer bg-transparent border-0"
            >
              Skip
            </button>
            {stepIndex > 0 && (
              <button
                onClick={goBack}
                className="text-[12px] text-text px-2.5 py-1.5 rounded-md border border-sage cursor-pointer bg-white hover:bg-sage/15"
              >
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className="text-[12px] font-medium text-white px-3 py-1.5 rounded-md bg-ink cursor-pointer hover:brightness-110"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
