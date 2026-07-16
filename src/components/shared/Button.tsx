// Shared button primitive — one place for hover / disabled / focus states so
// every click affordance in the app reads as part of the same design system.
//
// Variants:
//   primary      — filled coral (main confirming action; Sign In, Confirm & create, Save, Reserve)
//   secondary    — outlined sage (neutral/cancel action; Cancel, Back, Reset)
//   destructive  — outlined coral (deletes / removes; Delete tag, Discard)
//   ghost        — text-only (subtle inline actions inside menus / drawers)
//
// Sizes:
//   sm           — px-3 py-1 text-[12px]     (chip-scale, inside tables)
//   md (default) — px-3.5 py-1.5 text-[13px] (toolbars, filter rows, modals)
//   lg           — px-5 py-2 text-[14px]     (feature hero actions)
//
// Anything visually unique (giant floor buttons, sidebar nav items, calendar
// day cells) stays hand-rolled — those aren't the "buttons" this unifies.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-[12px] gap-1",
  md: "px-3.5 py-1.5 text-[13px] gap-1.5",
  lg: "px-5 py-2 text-[14px] gap-1.5",
};

// Two class strings per variant — one for enabled, one for the disabled sibling —
// so :disabled never wins by specificity accident.
const VARIANT_CLS: Record<ButtonVariant, { on: string; off: string }> = {
  primary: {
    on: "bg-coral text-white border border-coral font-semibold hover:brightness-95 focus-visible:ring-2 focus-visible:ring-coral/40",
    off: "bg-[#ccc] text-white border border-[#ccc] font-semibold cursor-not-allowed",
  },
  secondary: {
    on: "bg-transparent text-text-sec border border-sage hover:border-coral hover:text-coral focus-visible:ring-2 focus-visible:ring-coral/30",
    off: "bg-white text-text-ter border border-sage/60 cursor-not-allowed opacity-60",
  },
  destructive: {
    on: "bg-white text-coral border border-coral font-semibold hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-coral/40",
    off: "bg-white text-text-ter border border-sage/60 cursor-not-allowed opacity-60",
  },
  ghost: {
    on: "bg-transparent text-text-sec border border-transparent hover:text-coral focus-visible:ring-2 focus-visible:ring-coral/30",
    off: "bg-transparent text-text-ter border border-transparent cursor-not-allowed opacity-60",
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", leftIcon, rightIcon, className = "", disabled, children, ...rest },
  ref,
) {
  const v = VARIANT_CLS[variant];
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-md whitespace-nowrap transition-colors outline-none",
        SIZE_CLS[size],
        disabled ? v.off : `${v.on} cursor-pointer`,
        className,
      ].join(" ")}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
