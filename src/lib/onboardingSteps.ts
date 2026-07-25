// Role-based onboarding tour step configs. Each step points at a real element via its
// `data-onboarding` attribute; `nav` (optional) tells the tour which page to open before
// showing the step, so the walkthrough follows each role's typical-day workflow across
// pages. Targets that momentarily aren't in the DOM are skipped gracefully by the tour.
import type { Role } from "@/lib/types";
import type { NavKey } from "@/components/layout/Sidebar";

export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  target: string; // matches [data-onboarding="..."]
  title: string;
  body: string;
  placement?: TourPlacement; // desktop spotlight card side (ignored by the Floor bottom sheet)
  nav?: NavKey; // navigate here before showing this step
}

// Manager — overview → receive → locate → inspect → enter → clients → analyze.
export const managerTourSteps: TourStep[] = [
  {
    target: "dashboard-kpi",
    nav: "dashboard",
    placement: "bottom",
    title: "Your yard at a glance",
    body: "These cards show live inventory totals. Click any card to jump straight to the matching tags in Stock Locator.",
  },
  {
    target: "delivery-upload",
    nav: "delivery",
    placement: "bottom",
    title: "Receive incoming loads",
    body: "Start here when a truck arrives — upload a delivery slip and the AI parser reads its line items and creates Pending tags for the floor to confirm.",
  },
  {
    target: "locator-filterbar",
    nav: "locator",
    placement: "bottom",
    title: "Find any tag fast",
    body: "Filter the yard by species, grade, status, location and more. Every view in Timbridge reads from this one tag table.",
  },
  {
    target: "locator-row",
    nav: "locator",
    placement: "bottom",
    title: "Open a tag's details",
    body: "Click any tag row to open its detail drawer — expand it full-screen and edit its fields, location, or status.",
  },
  {
    target: "tagentry-step1",
    nav: "tagentry",
    placement: "bottom",
    title: "Log new inventory",
    body: "Enter tags by hand in three quick steps — dimensions auto-calculate board feet as you type.",
  },
  {
    target: "clients-page",
    nav: "clientprofile",
    placement: "bottom",
    title: "Manage your clients",
    body: "Look up customers, their contact details and payment terms, and see every order linked to each one.",
  },
  {
    target: "pulse-page",
    nav: "pulse",
    placement: "bottom",
    title: "Track your pulse",
    body: "Analytics on inventory flow, species velocity and yard aging — plus a Reports tab that flags shortages before you run out.",
  },
];

// Sales — availability → find stock → build order → track → approvals.
export const salesTourSteps: TourStep[] = [
  {
    target: "dashboard-available",
    nav: "dashboard",
    placement: "bottom",
    title: "What's available to sell",
    body: "This card shows how many tags are ready to quote right now. Click it to see exactly which ones.",
  },
  {
    target: "locator-filterbar",
    nav: "locator",
    placement: "bottom",
    title: "Find sellable stock",
    body: "Filter to Available tags by species and grade to see what you can quote right now.",
  },
  {
    target: "avail-row",
    nav: "avail",
    placement: "bottom",
    title: "Build an order",
    body: "Each row is a sellable tag. Check the ones a customer wants, then use the action bar to create a Sales Order or add to an existing one.",
  },
  {
    target: "sales-page",
    nav: "sales",
    placement: "bottom",
    title: "Track your orders",
    body: "Every order you create lives here — filter by status or customer, open one to edit it, and export a PDF for the customer.",
  },
  {
    target: "approvals-page",
    nav: "approvals",
    placement: "bottom",
    title: "Request & track approvals",
    body: "Need a manager to sign off on a discount? Submit it here and follow its status through to a decision.",
  },
];

// Floor — renders as a bottom sheet (see OnboardingTour). Overview → scan → confirm → log.
export const floorTourSteps: TourStep[] = [
  {
    target: "dashboard-kpi",
    nav: "dashboard",
    placement: "bottom",
    title: "Today's yard status",
    body: "A quick read on what's on the yard and what needs attention.",
  },
  {
    target: "locator-scan",
    nav: "locator",
    placement: "bottom",
    title: "Scan to find a tag",
    body: "Scan a barcode or type an ID to pull up a tag's location and details instantly.",
  },
  {
    target: "floor-confirm-receipt",
    nav: "locator",
    placement: "top",
    title: "Confirm received loads",
    body: "Pending tags show a Confirm Receipt button — tap it once you've checked the load in.",
  },
  {
    target: "tagentry-step1",
    nav: "tagentry",
    placement: "bottom",
    title: "Log a new tag",
    body: "Add tags right from the floor — big touch targets, and board feet calculated for you.",
  },
];

export function tourStepsForRole(role: Role): TourStep[] {
  if (role === "sales") return salesTourSteps;
  if (role === "floor") return floorTourSteps;
  return managerTourSteps;
}
