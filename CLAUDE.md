# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Timbridge — a B2B ERP **prototype** for small Canadian sawmills, for July user testing. **Mock data only; no backend, no real LISA integration.** Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. The product designer drives via vibe coding (doesn't write code directly): make one change at a time, prefer surgical edits over regenerating files, and surface non-trivial design/architecture decisions instead of guessing.

## Commands

```bash
npm install
npm run dev          # Vite dev server (port 5173). Also launchable via the "timbridge" config in .claude/launch.json
npx tsc -b --noEmit  # PRIMARY correctness gate — run after every change. There is no test suite.
npm run build        # tsc -b && vite build
npm run lint         # eslint .
```

There are **no tests** — verify changes with `npx tsc -b --noEmit` plus a visual check in the browser preview. Node lives at `/usr/local/bin` (installed via the official pkg); prepend it to PATH if `node`/`npm` aren't found.

## Architecture (the parts that span files)

**One Tag table is the single source of truth.** Every feature reads/writes the same in-memory array seeded from `src/lib/mock-data.ts`; the `Tag` type and the **6-state lifecycle** (`TagStatus`: Pending → Received → Available → Reserved → Shipped, plus Discrepancy) live in `src/lib/types.ts`. New tags are created `Pending` by Delivery Slips and `Available` by Tag Entry. `Reserved` and `Shipped` are never set by hand — they are side-effects of Sales Orders (see below).

**Sales Orders drive the back half of the lifecycle.** `SalesOrder` (`SalesOrderStatus`: Draft → Open → Picked → Shipped, plus Cancelled) links to tags through `lineItems`. All cross-store mutations live as handlers in `src/App.tsx` and are passed down as props, so the Tag and Sales Order tables can't diverge:
- Draft orders leave tags `Available`. Confirming (create-and-confirm from Available to Sell / Client Profile, or Draft → Open from Sales Orders) re-checks every tag is still `Available`, then reserves through **`reserveLineItems` in `src/lib/reserveSplit.ts`** — the single home for Available → Reserved. A partial-qty line splits off a new `Reserved` child tag and the line item is rewritten to point at the child.
- Advancing an order to `Shipped` cascades its `Reserved` tags to `Shipped` in the same commit.
- What's editable on an order is decided once by `getSalesOrderEditMode` in `src/features/sales-orders/permissions.ts` (Draft = everything, Open/Picked = notes + ship date only, Shipped/Cancelled = read-only).
- Extended-price math (qty × unit price − discount) is `calcExtendedPrice` in `src/lib/pricing.ts`, shared by order line items and discount approvals. A confirmed order with discounted lines auto-creates a Pending discount `ApprovalRequest`.

**No router.** `src/App.tsx` holds `nav: NavKey` and conditionally renders one feature component (the container is keyed by `nav` + an epoch, so re-clicking the active sidebar item remounts the feature to its initial screen). The `NavKey` union is defined in `src/components/layout/Sidebar.tsx`; `TopBar.tsx` maps each `NavKey` to its breadcrumb title/parent; `App.tsx` has the render branch plus the list of implemented keys that falls through to `ComingSoon` — keep all three in sync when adding/removing a nav item. Cross-feature deep links (open a tag / order / client drawer, or land pre-filtered) go through "pending id" and filter state in `App` (`pendingTagId`, `pendingSoId`, `pendingClientId`, `entryFilter`, `salesFilter`).

**Auth is a mock gate.** `src/features/auth/LoginPage.tsx` renders until `authed` flips in `App`; there is no real authentication. Every sign-in lands on Dashboard; the role defaults to Manager on page load.

**Roles.** `useRole` (`src/hooks/useRole.ts`) is a three-way Manager / Sales / Floor toggle, switched from the TopBar; Floor is the tablet surface. The sidebar gates nav items per role via `allowedRoles`, and `App.tsx` repeats the gate as redirects (defense-in-depth) — change both together:

| | Manager | Sales | Floor |
|---|---|---|---|
| Dashboard, Stock Locator | ✓ | ✓ | ✓ |
| Tag Entry | ✓ | — | ✓ |
| Available to Sell, Sales Order, Client Profile, Pulse | ✓ | ✓ | — |
| Approvals | ✓ review queue (`ApprovalQueue`) | ✓ own requests (`MyApprovals`) | — |
| Delivery Slips, Settings | ✓ | — | — |

Finer gates inside features: **creating orders is Sales-only** (the selection checkboxes and order panel in Available to Sell and Client Profile render only for Sales; Manager browses read-only), editing and deleting tags in Stock Locator is Manager-only, and Pulse's report section is Manager-only (`canSeeReports`).

**State stores (React only, no backend):**
- In-memory, seeded from `src/lib/mock-data.ts`, threaded via props from `App`, **reset on reload**: `useTags` (the Tag table), `useSalesOrders`, `useApprovalRequests`.
- Context providers at the App root, **persisted to `localStorage`**:
  - `useRecentRecords` — key `timbridge_recent_records`.
  - `useLookups` — merges system defaults (`src/lib/lookups.ts`) with Manager-added custom values (key `timbridge_custom_lookups`) for the Species/Grade/State/Milling/Yard Location dropdowns.
  - `useClients` — the CRM store, key `timbridge_clients_v2`. It seeds once from `INITIAL_CLIENTS` and never reconciles, so **bump the version suffix whenever the `Client` seed shape changes** (this drops clients created on that device).
- `useOnboarding` — which role's tour is active; "seen" flags in `localStorage` (`timbridge_onboarding_seen_<role>`), cleared on every sign-in so the tour auto-starts each session.

Because clients persist while tags and orders reset, a reload can leave a locally created client with no orders — expected in this prototype.

**Features** (`src/features/*`, each self-contained, fed via props):
- Inventory: `dashboard` (KPIs, charts, `YardMap`), `stock-locator`, `tag-entry`, `delivery-slips`.
- Sales: `available-to-sell` (Sales: multi-tag selection → new order or append to a Draft), `sales-orders`, `clients` (Client Profile: list / detail / create, can also start an order), `approvals` (discount, credit-term, cancellation and other requests).
- `pulse` — analytics with chart drill-through and per-chart CSV export (formerly "Insights").
- `settings` — Custom Values, Manager-only.
- `auth` — the mock login page.
- **Not built:** `reports` is an empty folder with no nav entry. The nav items Purchase Orders (`po`), Production (`prod`), Shipping / Trucking (`shipping`) and Invoicing (`invoicing`) render the `ComingSoon` placeholder.

**Onboarding tour.** `src/components/shared/OnboardingTour.tsx` spotlights elements by their `data-onboarding` attribute; per-role step lists live in `src/lib/onboardingSteps.ts`. Renaming or removing an element that carries `data-onboarding` silently drops that step, so update the step config with it.

**Shared UI primitives** in `src/components/shared` — reuse these rather than hand-rolling: `Button`, `Pagination`, `FilterBar` (filters apply on click, no Apply button), `StatusBadge`, `SOStatusPill`, `ConfirmationBanner`, `ComingSoon`.

**Third-party scripts and keys.** Besides the slip parser below: the Dashboard yard map uses Mapbox GL with a **public** token in `VITE_MAPBOX_TOKEN` (in `.env.local`; the map shows a setup hint without it), and `index.html` loads the Maze user-testing snippet.

**Delivery Slips AI parsing is the only call to our own API, and the key is server-side:**
- Browser → `POST /api/parse-slip` via `src/lib/anthropic.ts` (`parseDeliverySlip`). No key or Anthropic logic in the client bundle.
- Production: Vercel **Edge Function** `api/parse-slip.ts` + shared `api/_core.ts`, reading `process.env.ANTHROPIC_API_KEY`.
- Dev/preview: `vite.config.ts` has a `configureServer` middleware that emulates `/api/parse-slip` (loads the key via `loadEnv(mode, cwd, '')` and runs `api/_core.ts` through `ssrLoadModule`), so `npm run dev` works the same as prod.
- The key var is `ANTHROPIC_API_KEY` — **no `VITE_` prefix**, so it's never bundled. Local value lives in git-ignored `.env.local`; on Vercel it's a project env var. Model id: `claude-sonnet-4-6`. The "Use sample delivery slip" demo path needs no key.
- Note: `api/*` files use **relative imports** (not the `@` alias) and are outside the tsconfig `include`, so `tsc -b` does not type-check them — Vercel builds them separately.

## Styling & brand

Tailwind v4 with brand tokens in `src/index.css` `@theme` (used as `bg-coral`, `text-ink`, `border-sage`, …):
`ink` #1F1F1F (sidebar / dark surfaces / strong text), `cream` #F0EDEB (app background), `sage` #B7CDC2 (muted/borders), `coral` #F0542B (primary action & alerts), `lime` #AADB1E (accent). These are the brand palette and supersede the teal tokens named in the original kickoff prompt.

**Unified status colors** are mirrored in two places — keep them in sync when changing: the Dashboard pie (`STATUS_FILL` in `src/features/dashboard/Dashboard.tsx`) and the table/drawer badges (`src/components/shared/StatusBadge.tsx`). Current scheme: Available=sage, Reserved=lime, Discrepancy=coral (alert), Pending/Received/Shipped = neutral grays. Sales Order statuses use the same tints via `src/components/shared/SOStatusPill.tsx` (Draft = dashed sage outline, Open = gray, Picked = lime, Shipped = dark gray, Cancelled = coral).

The official logo is `src/assets/timbridge-logo.svg`, rendered as an `<img>` by `src/components/shared/TimbridgeLogo.tsx` — swap the file to update it. shadcn/ui primitives are in `src/components/ui` but the app is mostly hand-rolled Tailwind. Path alias `@/` → `src/`.

## Conventions

- After each push, append **one** bilingual (中文 / English) entry to `docs/CHANGELOG.md` summarizing that push (grouping its commits), and summarize it in chat. Do not edit the changelog on individual commits.
- Floor view = tablet-optimized layouts only; Sales view never shows finance/margin data (per the kickoff architecture).
