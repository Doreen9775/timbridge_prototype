import { Check, X } from "lucide-react";

// Reusable post-action confirmation banner (e.g. "5 tags created · View all stock").
// Sticky at the top of a content area. Action + dismiss both have ≥44px touch targets (Floor/tablet).
interface ConfirmationBannerProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}

export function ConfirmationBanner({ message, actionLabel, onAction, onDismiss }: ConfirmationBannerProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 bg-[#E1F5EE] border-b border-sage px-4">
      <span className="w-6 h-6 rounded-full bg-sage flex items-center justify-center shrink-0">
        <Check size={14} className="text-ink" />
      </span>
      <span className="flex-1 text-[13px] font-semibold text-ink py-3">{message}</span>
      <button
        onClick={onAction}
        className="min-h-[44px] px-2 inline-flex items-center text-[13px] font-semibold text-coral hover:underline cursor-pointer"
      >
        {actionLabel}
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-text-sec hover:text-ink cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  );
}
