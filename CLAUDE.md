# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Timbridge — a B2B ERP **prototype** for small Canadian sawmills, for July user testing. **Mock data only; no backend, no real LISA integration.** Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui. The product designer drives via vibe coding (doesn't write code directly): make one change at a time, prefer surgical edits over regenerating files, and surface non-trivial design/architecture decisions instead of guessing.

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

**One Tag table is the single source of truth.** Every feature reads/writes the same in-memory array seeded from `src/lib/mock-data.ts`; the `Tag` type and the **6-state lifecycle** (`TagStatus`: Pending → Received → Available → Reserved → Shipped, plus Discrepancy) live in `src/lib/types.ts`. New tags are created `Pending` by Delivery Slips and `Available` by Tag Entry.

**No router.** `src/App.tsx` holds `nav: NavKey` and conditionally renders one feature component. The `NavKey` union is defined in `src/components/layout/Sidebar.tsx`; `TopBar.tsx` maps each `NavKey` to its breadcrumb title/parent — keep all three in sync when adding/removing a nav item.

**State stores (React only, no backend):**
- `useTags` (`src/hooks/useTags.ts`) — the Tag table; threaded down via props from `App`.
- `useRole` (`src/hooks/useRole.ts`) — Manager/Floor (tablet) toggle. The Sales role and the full §4 permission matrix are **not built yet**; the sidebar currently shows all items in both views.
- `useRecentRecords` (`src/hooks/useRecentRecords.tsx`) — Context provider at the App root; the **only** use of `localStorage` (key `timbridge_recent_records`). Everything else is in-memory and resets on reload.

**Features** (`src/features/*`, each self-contained, fed via props): `dashboard`, `stock-locator`, `tag-entry`, `delivery-slips`. `reports` and `available-to-sell` are empty placeholders (Phase 2).

**Delivery Slips AI parsing is the only external call, and the key is server-side:**
- Browser → `POST /api/parse-slip` via `src/lib/anthropic.ts` (`parseDeliverySlip`). No key or Anthropic logic in the client bundle.
- Production: Vercel **Edge Function** `api/parse-slip.ts` + shared `api/_core.ts`, reading `process.env.ANTHROPIC_API_KEY`.
- Dev/preview: `vite.config.ts` has a `configureServer` middleware that emulates `/api/parse-slip` (loads the key via `loadEnv(mode, cwd, '')` and runs `api/_core.ts` through `ssrLoadModule`), so `npm run dev` works the same as prod.
- The key var is `ANTHROPIC_API_KEY` — **no `VITE_` prefix**, so it's never bundled. Local value lives in git-ignored `.env.local`; on Vercel it's a project env var. Model id: `claude-sonnet-4-6`. The "Use sample delivery slip" demo path needs no key.
- Note: `api/*` files use **relative imports** (not the `@` alias) and are outside the tsconfig `include`, so `tsc -b` does not type-check them — Vercel builds them separately.

## Styling & brand

Tailwind v4 with brand tokens in `src/index.css` `@theme` (used as `bg-coral`, `text-ink`, `border-sage`, …):
`ink` #1F1F1F (sidebar / dark surfaces / strong text), `cream` #F0EDEB (app background), `sage` #B7CDC2 (muted/borders), `coral` #F0542B (primary action & alerts), `lime` #AADB1E (accent). These are the brand palette and supersede the teal tokens named in the original kickoff prompt.

**Unified status colors** are mirrored in two places — keep them in sync when changing: the Dashboard pie (`STATUS_FILL` in `src/features/dashboard/Dashboard.tsx`) and the table/drawer badges (`src/components/shared/StatusBadge.tsx`). Current scheme: Available=sage, Reserved=lime, Discrepancy=coral (alert), Pending/Received/Shipped = neutral grays.

The official logo is `src/assets/timbridge-logo.svg`, rendered as an `<img>` by `src/components/shared/TimbridgeLogo.tsx` — swap the file to update it. shadcn/ui primitives are in `src/components/ui` but the app is mostly hand-rolled Tailwind. Path alias `@/` → `src/`.

## Conventions

- After each push, append **one** bilingual (中文 / English) entry to `docs/CHANGELOG.md` summarizing that push (grouping its commits), and summarize it in chat. Do not edit the changelog on individual commits.
- Floor view = tablet-optimized layouts only; Sales view never shows finance/margin data (per the kickoff architecture).
