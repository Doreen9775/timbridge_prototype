# Timbridge — Changelog / 变更日志

A history of every commit (push) on `main`, in chronological order, with what was
**added** and **changed** each time. Bilingual (中文 / English).

按时间顺序记录 `main` 分支每一次提交（push）**新增**与**修改**的内容。中英双语。

> Repo: https://github.com/Doreen9775/timbridge_prototype · Stack: Vite + React + TS + Tailwind v4 + shadcn/ui · 后端 Anthropic 解析走 Vercel Edge Function。

---

## 2026-06-16

### `d69116f` · 17:53 · Initial commit — 项目脚手架 + 四大功能移植

**🇨🇳 中文**
- 从单文件 Artifact 迁移成正式的多文件工程：Vite + React + TS + Tailwind v4 + shadcn/ui。
- 落地品牌色板与设计 token、6 状态库存生命周期（Pending / Received / Available / Reserved / Shipped / Discrepancy）。
- 移植四大功能：**Dashboard**（KPI、迷你折线、按树种 FBM、状态饼图、动态流）、**Stock Locator**（筛选、表格、详情抽屉）、**Tag Entry**（三步向导 + 实时 FBM 计算 + 扫码预填）、**Delivery Slips**（AI 解析 + 示例单演示，批量创建 Pending 标签）。
- 仅用 Mock 数据；通过 `useTags` / `useRole` 管理 React 状态。

**🇬🇧 English**
- Migrated the single-file artifact into a real multi-file project (Vite + React + TS + Tailwind v4 + shadcn/ui).
- Established the brand palette/design tokens and the 6-state tag lifecycle.
- Ported all four features: Dashboard, Stock Locator, Tag Entry, Delivery Slips. Mock data only; React state via `useTags` / `useRole`.

**Files / 改动:** 54 files (whole scaffold) — `src/features/*`, `src/components/*`, `src/lib/*`, `src/hooks/*`, config.

---

### `bcdd897` · 22:56 · Fix Delivery Slips parser + UI refinements — 修复解析器 + 三处 UI 优化

**🇨🇳 中文**
- **AI 解析修复**：原 prompt 指定的模型已下线，改用 `claude-sonnet-4-6`；`max_tokens` 提到 8192；稳健提取 JSON（剥掉代码块/前言），多行送货单不再因截断报错。
- **侧边栏**：去掉 Delivery Slips 旁的「AI」小标，与其它项保持一致。
- **Stock Locator**：新增「Reset filters」按钮（有筛选时才出现）。
- **Dashboard**：Recent Activity 把 emoji 换成标准 lucide 图标，并加入按类别（Move / Receive / Reserve / QC / Scan）筛选。

**🇬🇧 English**
- Parser fix: switched to `claude-sonnet-4-6` (old model id retired), raised `max_tokens` to 8192, and robustly extract the JSON array — multi-item slips no longer truncate.
- Sidebar: removed the "AI" badge on Delivery Slips.
- Stock Locator: added a "Reset filters" button (shown when filters are active).
- Dashboard: replaced activity emoji with lucide icons + a category filter.

**Files / 改动:** `anthropic.ts`, `Sidebar.tsx`, `StockLocator.tsx`, `Dashboard.tsx`, `mock-data.ts`, `types.ts`

---

### `f10f932` · 23:17 · Serverless proxy — 把 API 钥匙搬到后端

**🇨🇳 中文**
- 浏览器不再直连 Anthropic（那样会把 API 钥匙暴露在前端包里）。改为请求自家 `/api/parse-slip`：
  - `api/parse-slip.ts`：Vercel Edge Function，从服务端环境变量 `ANTHROPIC_API_KEY` 读钥匙。
  - `api/_core.ts`：共享的解析逻辑（系统提示词 + 解析）。
  - `vite.config.ts`：本地开发中间件，模拟该函数，让 `npm run dev`/预览也能用且钥匙留在服务端。
  - 客户端 `anthropic.ts`：只 POST 到 `/api/parse-slip`，不含钥匙与解析逻辑。
- 本地变量更名 `VITE_ANTHROPIC_API_KEY` → `ANTHROPIC_API_KEY`（去掉 `VITE_` 前缀 ⇒ 永不进前端包）。线上需在 Vercel 项目里配置 `ANTHROPIC_API_KEY`。

**🇬🇧 English**
- The browser no longer calls Anthropic directly (which exposed the key in the bundle). It POSTs to our own `/api/parse-slip`: a Vercel Edge Function (`api/parse-slip.ts`) + shared core (`api/_core.ts`), with a Vite dev middleware so local/preview also work server-side.
- Renamed the key var to `ANTHROPIC_API_KEY` (no `VITE_` prefix ⇒ never bundled). On Vercel, set `ANTHROPIC_API_KEY` in project env vars.

**Files / 改动:** `api/parse-slip.ts` (new), `api/_core.ts` (new), `vite.config.ts`, `src/lib/anthropic.ts`

---

## 2026-06-22

### `ff3acd8` · 15:17 · Batch 1 · Multiple UOM display — 多单位显示

**🇨🇳 中文**
- 在 Stock Locator 的 **Tag 详情抽屉**里，「Product Specs」下方新增 **Units** 一栏：**BF 板英尺**（突出，保留 1 位小数）· **pcs 件数** · **lf 直英尺**。
- 新增 `calcBoardFeet`（1 位小数），直英尺复用已有的 `calcLineal`。
- 只读视图层改动：不动表格、筛选、数据结构。

**🇬🇧 English**
- New read-only **Units** row (BF · pcs · lf) in the Stock Locator detail drawer, under Product Specs. BF to 1 decimal.
- Added `calcBoardFeet`; reused `calcLineal` for linear feet. No schema/filter/table changes.

**Files / 改动:** `fbm.ts`, `StockLocator.tsx`

---

### `ecb2d34` · 15:33 · Batch 1 · Filter-aware CSV export — 随筛选导出 CSV

**🇨🇳 中文**
- Stock Locator 加 **「Export CSV」按钮**（只在桌面 Manager/Sales 显示，Floor 不显示）。
- 导出的就是**当前筛选后的数组**，与屏幕表格完全一致；12 列固定顺序；文件名 `timbridge_stock_YYYY-MM-DD_HH-mm.csv`。
- 无匹配结果时按钮**置灰** + 提示「No tags match current filter」。不引第三方库（Blob + 下载）。
- 配套数据：给 Tag 增加 **supplier 供应商**字段并为所有 Mock 标签填充；「接收日期」取每条标签的首条历史时间；Delivery Slips 创建的标签也带上送货单供应商。

**🇬🇧 English**
- "Export CSV" button on Stock Locator (desktop/Manager+Sales only). Exports the current `filtered` array — same rows/order as the table; 12 fixed columns; timestamped filename. Disabled + tooltip on empty results; no CSV library.
- Data: added `supplier` to Tag + seeded all tags; Received Date = first history event; slip-created tags carry the slip's supplier.

**Files / 改动:** `StockLocator.tsx`, `types.ts`, `mock-data.ts`, `DeliverySlips.tsx`

---

### `d8f8345` · 19:25 · Cleanup · Remove "All Tags" — 删除冗余的「All Tags」

**🇨🇳 中文**
- 「All Tags」与 Stock Locator 重复（LISA 遗留结构），从 **Manager 与 Floor 两个视图**都移除。
- 删掉导航项 + `NavKey` 成员（Sidebar）、TopBar 的 titles/parents 映射项、以及不再使用的 `Package` 图标引用。
- 没有独立页面文件、无路由/链接/共享组件受影响；Stock Locator 完全没动。

**🇬🇧 English**
- Removed the redundant "All Tags" item from both Manager and Floor sidebars (it duplicated Stock Locator).
- Dropped the nav item + `NavKey` member + TopBar map entries + the unused `Package` import. No standalone page existed; Stock Locator untouched.

**Files / 改动:** `Sidebar.tsx`, `TopBar.tsx`

---

### `a5344c0` · 19:42 · Batch 1 · Recent records — 最近记录下拉

**🇨🇳 中文**
- 顶栏右侧（头像旁）新增 **「Recent」下拉**：列出最近打开/创建的记录（图标 + 编号 + 相对时间），含空状态、≥44px 触控目标，所有角色可见。
- **localStorage 持久化**（key `timbridge_recent_records`，刷新不丢），最多 20 条，按 id 去重并置顶。
- 点击条目 → 跳到 Stock Locator 并自动打开该 Tag 的详情抽屉（App 通过 `openTagId` 入口实现）。
- 推送时机（集中式、显式调用）：**打开 Tag 详情** + **Tag Entry 保存成功**。
- 说明：目前没有「送货单详情页」，故暂时只追踪 Tag（`slip` 类型预留）。

**🇬🇧 English**
- "Recent" dropdown in the top nav (icon, label, relative time, empty state, ≥44px targets; all roles).
- Persisted to localStorage (max 20, dedupe by id, move-to-top). Clicking a tag routes to Stock Locator and opens its drawer via an `openTagId` entry point.
- Push hooks (centralized/imperative): Stock Locator row open + Tag Entry save. Only Tags tracked for now (no slip detail view yet).

**Files / 改动:** `useRecentRecords.tsx` (new), `RecentMenu.tsx` (new), `App.tsx`, `TopBar.tsx`, `StockLocator.tsx`, `TagEntry.tsx`, `types.ts`

---

### `0d37217` · 20:16 · Official logo + remove "Lumber ERP" — 换正式 Logo

**🇨🇳 中文**
- 用官方 **SVG logo**（`src/assets/timbridge-logo.svg`，含图形 + 字标）替换之前手画的版本，保留 logo 自带的品牌红。
- `TimbridgeLogo` 改用 `<img>` 渲染该文件；以后换 logo 只需替换该 SVG 文件，无需改代码。
- 删除 logo 下方的「Lumber ERP」小字。

**🇬🇧 English**
- Swapped in the official SVG logo (mark + wordmark) for the hand-built recreation; `TimbridgeLogo` now renders it via `<img>` (swap the file to update). Removed the "Lumber ERP" subtitle.

**Files / 改动:** `timbridge-logo.svg` (new), `TimbridgeLogo.tsx`, `Sidebar.tsx`

---

### `docs` · Add bilingual CHANGELOG — 新增中英双语变更日志

**🇨🇳 中文** — 新增本变更日志（`docs/CHANGELOG.md`），回填记录此前全部 8 次提交。约定：**此后每次 push 都在此追加一条中英双语条目**，并在对话里同步总结。

**🇬🇧 English** — Added this changelog (back-filled all 8 prior commits). Convention going forward: **every push appends a bilingual entry here** and is summarized in chat.

**Files / 改动:** `docs/CHANGELOG.md` (new)

---

### `2026-06-22` · Reference-style color revamp + selection-based CSV export — 配色改版 + 勾选式导出

> 本条为一次 push 的汇总（含多次提交）。/ One push, several commits.

**🇨🇳 中文**
- **实色指标卡**：参考给定的 dashboard layout，把 Dashboard 4 张 KPI 卡与 Stock Locator 4 张汇总卡改为实色背景（品牌色 / 主辅色划分不变）。最终配色 → FBM=白、Available=sage、Reserved=lime、Low Stock Alerts=coral（警示）；Stock Locator：Total Tags / Total FBM=白、Available=sage、Reserved=lime。顶栏头像=coral，圆角加大、数字加粗。
- **状态色全局统一**：Tag Status Distribution 饼图 **+** 表格/详情的状态徽章统一为 → Available=sage、Reserved=lime、Discrepancy=coral（警示）、Pending/Received/Shipped=中性灰。
- **勾选式导出 CSV**：Stock Locator 每行加复选框（含表头全选/半选）；导出改为**只导出勾选的标签**，未勾选时按钮置灰不可用，勾选后变实心 coral + 显示数量；点复选框不打开抽屉。（取代了原「导出全部筛选结果」的行为。）

**🇬🇧 English**
- **Solid-color metric cards** (Dashboard KPIs + Stock Locator summary cards) per the reference layout; palette/roles unchanged. Final colors → FBM=white, Available=sage, Reserved=lime, Low Stock Alerts=coral; TopBar avatar=coral; larger radius/numbers.
- **Unified status colors** across the pie **and** the table/drawer badges → Available=sage, Reserved=lime, Discrepancy=coral (alert), transitional=neutral grays.
- **Selection-based CSV export**: per-row checkboxes (+ header select-all/indeterminate); exports only checked tags; button disabled until ≥1 selected, then solid coral with a count; checkbox clicks don't open the drawer. (Supersedes the earlier "export all filtered" behavior.)

**Files / 改动:** `Dashboard.tsx`, `StockLocator.tsx`, `TopBar.tsx`, `StatusBadge.tsx`

---

### `2026-06-22` · Add CLAUDE.md — 新增项目说明文件

**🇨🇳 中文** — 新增 `CLAUDE.md`（项目架构、命令、约定说明），供 Claude Code 新会话快速上手。

**🇬🇧 English** — Added `CLAUDE.md` (architecture, commands, conventions) so future Claude Code sessions ramp up fast.

**Files / 改动:** `CLAUDE.md`

---

## 2026-06-23

### `2026-06-23` · Login + auth gate · Stock Locator overhaul · brand typography — 登录鉴权 + 库存定位大改 + 品牌字体

> 本条为一次 push 的汇总（含多项改动）。/ One push, several changes.

**🇨🇳 中文**
- **登录页 + 鉴权门（新）**：左表单 / 右图的分栏登录页；预填测试账号 `usertest@tbg.com` / `123456`，点 Sign In 进入主应用。右侧 3 张木材实拍图每 5 秒**交叉淡化**轮播（存于 `public/login/`，已压缩为 Web 尺寸 ~2000px）。登录→应用为淡出/淡入的柔和过渡。Sign In 按钮加 hover。
- **侧边栏**：SETUP 下新增 **Logout**（点击回到登录页）；所有导航项加 hover，**仅选中项**为红色。
- **Stock Locator · 详情面板**：支持**全屏**切换；非全屏下再点同一行可关闭详情；新增**编辑 / 保存**——Status、Location、Species、Grade、尺寸、Qty、State、Milling 全部可改，FBM 自动重算，保存时追加一条「Edited via Stock Locator」历史并把 Updated 置为 just now。
- **Stock Locator · 筛选栏重做**：参照 wireframe 的 Filter By 栏——**Date（多选日历）/ Species / Status / Location** 四个多选下拉，Apply Now 未改动时置灰、改动后高亮；保留 Low Qty 快捷筛选与 Reset Filter。Tag 新增 `date`（录入日期）字段并回填，表格新增 **Entry Date** 列。
- **全站字体**：display 标题用 **Montserrat**、正文用 **Nunito Sans**（替换 Geist）。

**🇬🇧 English**
- **Login page + auth gate (new)**: split login (form left, hero right); test creds prefilled (`usertest@tbg.com` / `123456`); Sign In enters the app. Three lumber photos **crossfade** every 5s (served from `public/login/`, optimized to ~2000px). Login→app is a soft fade-out/fade-in. Sign In button has a hover.
- **Sidebar**: new **Logout** under SETUP (returns to login); all nav items now have hover, with red reserved for the **selected** item only.
- **Stock Locator · detail panel**: **fullscreen** toggle; clicking the open row again closes it; new **edit / save** — Status, Location, Species, Grade, dimensions, Qty, State, Milling are editable, FBM auto-recomputes, and Save appends an "Edited via Stock Locator" history event + sets Updated to "just now".
- **Stock Locator · filter bar redo**: wireframe-style Filter By bar — **Date (multi-date calendar) / Species / Status / Location** multi-select popovers with an Apply Now that's gray until changed; Low Qty quick filter and Reset Filter kept. Added a `date` (entry date) field to Tag (seeded) + an **Entry Date** column.
- **App-wide fonts**: **Montserrat** for display titles, **Nunito Sans** for body (replacing Geist).

**Files / 改动:** `features/auth/LoginPage.tsx` (new), `public/login/*` (new), `App.tsx`, `components/layout/Sidebar.tsx`, `features/stock-locator/StockLocator.tsx`, `lib/types.ts`, `lib/mock-data.ts`, `features/tag-entry/TagEntry.tsx`, `features/delivery-slips/DeliverySlips.tsx`, `features/dashboard/Dashboard.tsx`, `index.css`, `package.json`

---

## 2026-06-24

### `2026-06-24` · Auth transitions polish — 登录/登出过渡打磨

**🇨🇳 中文**
- **登出也有淡出过渡**：点 Logout 后主应用先淡出（500ms），再切回登录页并淡入，与 Sign In 进入时的过渡对称，不再生硬瞬切。（`.animate-fade-in` 去掉 `both`，让同一元素既能淡入又能随后淡出。）
- **重新登录永远回到 Dashboard**：不管登出时停在哪个功能，每次 Sign In 统一落到 Dashboard。

**🇬🇧 English**
- **Logout fade-out**: the app now fades out (500ms) before returning to the login page, which fades back in — symmetric with the sign-in transition. (Dropped `both` from `.animate-fade-in` so the same element can fade in and later fade out.)
- **Always land on Dashboard**: every sign-in resets the view to Dashboard, regardless of where the previous session left off.

**Files / 改动:** `App.tsx`, `features/auth/LoginPage.tsx`, `index.css`

---

## 2026-06-24 (2)

### `2026-06-24` · Inventory deep-link + confirmation banner · global hover pass — 库存深链 + 确认横幅 + 全局 hover

> 本条为一次 push 的汇总（含多项改动）。/ One push, several changes.

**🇨🇳 中文**
- **Stock Locator 深链筛选（新）**：新增 `entryFilter` 机制（与 `openTagId` 同构的一次性传参），可从外部带着 `tagIds` / `status` / `species` / `lowQty` 跳进 Stock Locator 并自动套用到现有筛选栏（一次性应用，不会在重新进入时复现）。
- **新增 ConfirmationBanner 组件**：可复用的成功提示横幅（sage 绿、勾选图标、消息 + 「View all stock」+ X 关闭，触控目标 ≥44px）。吸顶于 Stock Locator 内容区顶部、筛选栏上方。
- **Tag Entry / Delivery Slips → Stock Locator 打通**：两处成功页的「View in Inventory」现在真正跳转到 Stock Locator 并只显示新建的标签（Tag Entry 1 条 / Delivery Slips N 条），同时显示「N tag(s) created · View all stock」横幅。点「View all stock」、点 X、或用筛选栏的 Reset Filter 都会清空筛选并隐藏横幅；离开页面再回来横幅不会重新出现（一次性）。Tag Entry 的 Floor 成功页也补上了这个入口。
- **统一「View in Inventory」**：Delivery Slips 原来文案缺「in」、颜色是深色 ink，现在文案与配色都和 Tag Entry 一致（红色 coral）。
- **全局 hover**：检查了全站所有可交互按钮/卡片，统一补上 hover 反馈（实色按钮变亮、描边按钮变红边红字、中性卡片浅绿底）。
- **正文字体 → Inter**（替换 Nunito Sans，字重层级不变）；Dashboard 的「Recent Activity」改名为「Yard Activity」。

**🇬🇧 English**
- **Stock Locator deep-link filter (new)**: an `entryFilter` mechanism (mirrors the `openTagId` one-shot pattern) lets an outside flow jump into Stock Locator with `tagIds` / `status` / `species` / `lowQty` pre-applied to the existing filter bar — applied once, not replayed on re-entry.
- **New `ConfirmationBanner` component**: reusable success banner (sage green, check icon, message + "View all stock" + X dismiss, ≥44px touch targets), sticky above the filter bar in Stock Locator.
- **Tag Entry / Delivery Slips → Stock Locator wired up**: both success screens' "View in Inventory" now navigate into Stock Locator filtered to just the newly created tag(s) (1 for Tag Entry, N for Delivery Slips), showing a "N tag(s) created · View all stock" banner. Clicking the action, the X, or the existing Reset Filter all clear it; navigating away and back does not bring it back (one-shot). Added the same CTA to Tag Entry's Floor success screen.
- **Standardized "View in Inventory"**: Delivery Slips' button (previously "View Inventory", dark ink) now matches Tag Entry's exact label and coral color.
- **Global hover pass**: audited every interactive button/card app-wide and added a hover state where missing (solid buttons brighten, outline buttons flip to coral, neutral cards get a light sage tint).
- **Body font → Inter** (replacing Nunito Sans, weight hierarchy unchanged); Dashboard's "Recent Activity" renamed to "Yard Activity".

**Files / 改动:** `components/shared/ConfirmationBanner.tsx` (new), `App.tsx`, `lib/types.ts`, `features/stock-locator/StockLocator.tsx`, `features/tag-entry/TagEntry.tsx`, `features/delivery-slips/DeliverySlips.tsx`, `features/dashboard/Dashboard.tsx`, `components/layout/TopBar.tsx`, `index.css`

---

## 2026-06-24 (3)

### `d70ecd7` · Dashboard drill-through · Tag pricing · Linked Transactions — Dashboard 深链点击 + 标签定价 + 关联交易

> 本条为一次 push 的汇总（含多项改动）。/ One push, several changes.

**🇨🇳 中文**
- **Dashboard 可点击深链（新）**：4 张 KPI 卡、FBM by Species 每根柱子、Tag Status Distribution 饼图的每个扇区与图例行，全部可点击并跳转到 Stock Locator、套用对应的 `entryFilter`（Available / Reserved / Low Qty / 按树种 / 按状态）；Yard Activity 每一行点击则通过 `openTagId` 直接打开该标签的详情抽屉（不是筛选）。所有可点元素补上 `role="button"` / `aria-label` / hover 反馈 / `cursor: pointer`。顺手修掉 Recharts v3 在点击柱子/饼图时默认弹出的焦点高亮方框（全局给 `.recharts-wrapper` 关掉 outline）。
- **Tag 定价字段（新）**：`Tag` 新增可选的 `cost`（成本/件）与 `marketValue`（市场价/件），仅 Manager 维护/种子数据携带，Tag Entry 与 Delivery Slips 创建的标签留空。18 条 Mock 标签按真实木材市场板英尺单价（按树种/等级分级）×每件实际板英尺数回填，毛利率统一落在约 36–48%。
- **Stock Locator 详情面板 · Pricing 区块（新，仅 Manager 可见）**：在 Units 区块下方新增成本/市场价/毛利三项统计，毛利为视觉主项（更大更粗）；编辑模式下成本与市场价变为输入框，毛利随输入实时重算，保存复用现有「Edited via Stock Locator」历史事件，不新增保存逻辑。
- **Stock Locator 详情面板 · Linked Transactions 区块（新，Manager 与未来 Sales 角色可见，Floor 不渲染）**：展示关联到该标签的销售单（单号 / 客户 / 状态徽章 / 数量 / 单价）；单号 hover 显示「Sales Order detail coming soon」提示，暂不可点击跳转。`SalesOrder` Mock 结构改为按行（`lineItems`）记录数量与单价，重新播种 4 笔订单（3 个客户，Open/Picked/Shipped 状态齐全，均关联现有 Reserved 标签）。

**🇬🇧 English**
- **Dashboard clickable drill-throughs (new)**: all 4 KPI cards, every FBM-by-Species bar, and every Tag Status Distribution donut segment + legend row now click through to Stock Locator with the matching `entryFilter` (Available / Reserved / Low Qty / by species / by status); each Yard Activity row instead opens that exact tag's detail drawer via `openTagId` (a single-tag jump, not a filter). Added `role="button"` / `aria-label` / hover states / `cursor: pointer` throughout. Also fixed Recharts v3's default focus-ring box that flashed on bar/pie clicks (scoped `outline: none` on `.recharts-wrapper`).
- **Tag pricing fields (new)**: optional `cost` / `marketValue` (per unit) added to `Tag`, populated only on Manager-curated/seeded tags — Tag Entry and Delivery Slips tags leave them undefined. Backfilled all 18 mock tags using real $/board-foot market rates by species/grade × each tag's actual board footage, keeping margins in a realistic ~36–48% band.
- **Stock Locator detail panel · Pricing block (new, Manager-only)**: cost/market-value/margin stat row under Units, margin as the primary (larger/bolder) value; editable in the existing edit/save flow with live margin recalculation as you type, reusing the existing "Edited via Stock Locator" history event.
- **Stock Locator detail panel · Linked Transactions block (new, visible to Manager and future Sales, never rendered for Floor)**: lists Sales Orders linked to the tag (SO number / customer / status pill / qty / unit price); the SO number shows a "Sales Order detail coming soon" tooltip on hover but isn't wired to navigate yet. Restructured the `SalesOrder` mock model to per-line `qty`/`unitPrice` and reseeded 4 orders across 3 customers (Open/Picked/Shipped all represented, all linked to existing Reserved tags).

**Files / 改动:** `App.tsx`, `features/dashboard/Dashboard.tsx`, `features/stock-locator/StockLocator.tsx`, `lib/types.ts`, `lib/mock-data.ts`, `index.css`

---

## 2026-06-24 (4)

### `afd78d9` · Desktop resolution adaptation — 桌面分辨率适配

**🇨🇳 中文**
- **超宽屏不再拉满**：Dashboard 与 Stock Locator 的内容区加上 `max-w-[1600px] mx-auto` 居中限宽，2560px+ 大屏下内容居中显示、两侧留白，不再被拉伸到边缘显得稀疏。
- **KPI / 汇总卡随宽度变列数**：两处的 4 张卡片网格从写死的 `grid-cols-4` 改为 `grid-cols-2 2xl:grid-cols-4` —— 1280–1366px 笔记本上变成 2×2 排布更宽松，≥1536px 宽屏自动恢复 4 列一排。
- **Stock Locator 表格防挤压**：表格外层加 `overflow-x-auto`，窄屏 + 详情抽屉同时打开导致列数吃紧时改为横向滚动，而不是把内容挤变形。详情抽屉本身按设计保持固定 380px 不随宽度变化。

**🇬🇧 English**
- **No more edge-to-edge stretching on ultra-wide monitors**: capped Dashboard's and Stock Locator's content at `max-w-[1600px] mx-auto`, so content stays centered with breathing room on 2560px+ screens instead of stretching thin.
- **KPI/summary cards now respond to width**: both 4-card grids changed from a hardcoded `grid-cols-4` to `grid-cols-2 2xl:grid-cols-4` — 2×2 on 1280–1366px laptops (less cramped), back to a single row of 4 at ≥1536px.
- **Stock Locator table no longer gets crushed**: added `overflow-x-auto` around the table so it scrolls horizontally instead of squeezing columns when the viewport is narrow and the detail drawer is open simultaneously. The drawer itself stays a fixed 380px by design, unaffected by viewport width.

**Files / 改动:** `features/dashboard/Dashboard.tsx`, `features/stock-locator/StockLocator.tsx`

---

## 2026-06-24 (5)

### `4c3cef4` · Resolution adaptation follow-up — 分辨率适配反馈调整

**🇨🇳 中文**
- **KPI / 汇总卡恢复 4 列一排**：根据反馈撤回上一条改动里的 2×2 折行，Dashboard 与 Stock Locator 的 4 张卡片网格在所有桌面宽度下都保持一排 4 列。
- **Tag Entry 向导卡片随宽度放大（新）**：之前 Tag Entry 是唯一一处完全没有适配的容器，固定 640px 不随屏幕变化；现在改为 `640px → 760px（lg) → 860px（xl) → 1000px（2xl)`，宽屏下会明显放大而不是停留在原尺寸。

**🇬🇧 English**
- **KPI/summary cards back to a single row of 4**: reverted the 2×2 collapse from the previous push per feedback — both Dashboard's and Stock Locator's 4-card grids now stay one row of 4 at every desktop width.
- **Tag Entry wizard card now scales with width (new)**: previously the one container that didn't adapt at all (fixed 640px regardless of screen size); now grows `640px → 760px (lg) → 860px (xl) → 1000px (2xl)` so it visibly enlarges on wide screens instead of staying pinned to its original size.

**Files / 改动:** `features/dashboard/Dashboard.tsx`, `features/stock-locator/StockLocator.tsx`, `features/tag-entry/TagEntry.tsx`

---

## 2026-06-25

### `88dfb17` · Role-based sidebar nav · Tag status state machine · Custom lookup values — 按角色侧边栏 + 标签状态机 + 自定义查找值

> 本条为一次 push 的汇总（含多项改动）。/ One push, several changes.

**🇨🇳 中文**
- **侧边栏按角色显隐（新）**：Manager / Sales / Floor 三种角色现在按权限矩阵显示不同导航项（例如 Floor 只看到 Stock Locator、Tag Entry、Settings + Logout，看不到 Dashboard、Delivery Slips、Operations、Insights）；被隐藏的项**真正从 DOM 移除**，不是简单的 CSS 隐藏。新增 Available to Sell / Client Profile / Approvals 三个占位导航项（暂无页面，落到现有 ComingSoon）。`TopBar` 的 breadcrumb 映射同步更新。
- **Stock Locator 详情面板修复**：编辑模式下全屏切换按钮之前会被整个移除——现在编辑时也能切全屏。「Export CSV」与「Last synced」从筛选栏挤在一起的那一行移到了单独一行、右对齐。
- **标签状态机正式接入 UI（新）**：6 状态生命周期不再是纯展示字段。Floor 在卡片列表对 Pending 标签新增绿色「Confirm Receipt」按钮，弹出确认面板可选「Confirm as Received」（可编辑库位，Pending→Received→Available 一次完成，不经过 QC 步骤）或「Flag Discrepancy」（可选备注，→ Discrepancy）。Manager 在详情面板获得受限的 Status 下拉（只展示该状态的合法正向流转，含二次确认弹窗，Shipped 为终态不可再流转）；Available→Reserved 必须关联一个真实的 Open 销售单（新增 `useSalesOrders` 状态，确认后才会落盘，取消编辑不会留下孤立关联）。
- **Settings → Custom Values（新页面，Manager 专属）**：`Species / Grade / State / Milling / Yard Location` 五张查找表，可在系统默认值之外新增/删除自定义值（系统默认显示灰色「System」徽章且不可删除；编码非空、表内大小写不敏感唯一、单表最多 50 条自定义值，超限/重复均有内联报错）。新增值通过 Context（`useLookups`，落 `localStorage`）实时同步进 Tag Entry 的 5 个下拉框和 Stock Locator 新增的 5 个筛选 pill，无需刷新页面。`Species/Grade/State/Milling` 的类型从字面量联合类型放宽为 `string` 以承载自定义编码。
- 非角色切换时若 Manager 离开 Settings 页（例如切到 Floor View），会自动跳回 Dashboard。

**🇬🇧 English**
- **Role-gated sidebar nav (new)**: Manager/Sales/Floor now each see a different nav subset per the permission matrix (e.g. Floor sees only Stock Locator, Tag Entry, Settings + Logout — no Dashboard, Delivery Slips, Operations, or Insights). Excluded items are removed from the DOM entirely, not just hidden. Added Available to Sell / Client Profile / Approvals as new placeholder nav items (no page yet, fall through to the existing ComingSoon); `TopBar`'s breadcrumb maps stay in sync.
- **Stock Locator detail panel fix**: the fullscreen toggle no longer disappears while editing a tag. "Export CSV" and "Last synced" moved off the crowded filter-pill row onto their own right-aligned row.
- **Tag status state machine wired to real UI (new)**: the 6-state lifecycle is no longer just a display field. Floor gets a green "Confirm Receipt" button on Pending cards → a sheet with "Confirm as Received" (editable yard location, Pending→Received→Available in one step, no QC) or "Flag Discrepancy" (optional note → Discrepancy). Manager gets a constrained Status dropdown on the detail panel (valid forward transitions only, with a confirmation dialog; Shipped is final). Available→Reserved now requires linking to a real Open Sales Order (new `useSalesOrders` state) — the link is only written on Save, so Cancel can't leave an orphaned link.
- **Settings → Custom Values (new page, Manager-only)**: five lookup tables (Species/Grade/State/Milling/Yard Location) where Managers can add/delete custom values alongside hardcoded system defaults (grey "System" badge, non-deletable; new entries validated for non-empty + case-insensitive uniqueness + a 50-per-table cap, with inline errors). Custom values sync live (via a `useLookups` context + localStorage) into Tag Entry's 5 dropdowns and 5 new/rewired Stock Locator filter pills, no reload needed. `Species/Grade/State/Milling` widened from literal-union types to `string` to carry custom codes.
- Settings auto-redirects to Dashboard if a Manager switches away from the Manager role (e.g. to Floor View) while on the page.

**Files / 改动:** `components/layout/Sidebar.tsx`, `components/layout/TopBar.tsx`, `App.tsx`, `features/stock-locator/StockLocator.tsx`, `features/tag-entry/TagEntry.tsx`, `features/settings/CustomValuesSettings.tsx` (new), `hooks/useLookups.tsx` (new), `hooks/useSalesOrders.ts` (new), `lib/lookups.ts` (new), `lib/types.ts`, `lib/mock-data.ts`, `CLAUDE.md`

---

## 2026-06-25 (2)

### `71c2453` · Revert Export CSV/Last synced row — 撤回导出按钮的单独一行

**🇨🇳 中文** — 根据反馈撤回上一条改动：「Export CSV」与「Last synced」从单独一行撤回，重新回到 Filter By 筛选 pill 同一行（依旧靠 `ml-auto` 折行到右侧），恢复成改动前的样子。

**🇬🇧 English** — Reverted the previous push's change per feedback: "Export CSV" and "Last synced" are back to sharing the wrapped Filter By pill row via `ml-auto`, instead of their own separate row.

**Files / 改动:** `features/stock-locator/StockLocator.tsx`

---

## 2026-06-25 (3)

### `c7362fb` · Interactive Mapbox Yard Map on the Dashboard — Dashboard 引入 Mapbox 货场地图

> 本条为一次 push 的汇总（含多次迭代）。/ One push, several iterations.

**🇨🇳 中文**
- **Dashboard 新增「Yard Map」卡片（新）**：与「Yard Activity」并排一行（仅桌面/Manager+Sales，Floor 不渲染），使用**真实 Mapbox 数据**（`mapbox-gl`）——可缩放、可拖动平移，默认是聚焦在 Langley（兰里）一处货场的街道级细节视图。
- **三个 A/B/C 标记**对应 YD-A/B/C（品牌珊瑚红圆形 + 白色字母）：**悬停**显示该货场的标签数与 FBM 总量（品牌绿 lime 信息框）；**点击**跳进 Stock Locator 并只显示该货场的标签（新增 `EntryFilter.yard` 字段，复用已有的 Location 筛选，未改动现有筛选逻辑）。
- **地图刷新按钮**：作为自定义控件叠在 +/− 缩放按钮下方，点击后以动画飞回初始中心点与缩放级别（并清掉旋转/倾斜）。
- **视觉对齐**：把「Yard Activity」的筛选按钮挪到标题下方独立一行，使其与地图的上边框顶部对齐，两张卡片结构统一（标题→内容），任意宽度下都对齐。
- **Token 处理**：地图密钥从 `VITE_MAPBOX_TOKEN`（**公开** pk. 令牌，可安全进前端，区别于服务端的 `ANTHROPIC_API_KEY`）读取；缺失时显示友好占位提示；新增 `src/vite-env.d.ts` 做类型声明。`.env.local` 仍被 git 忽略，令牌不会上传。线上需在 Vercel 配置同名变量。
- 过程中先把上一版做在 Stock Locator 里的 SVG 货场地图整体撤回，改到 Dashboard。

**🇬🇧 English**
- **New Dashboard "Yard Map" card**: in a row beside "Yard Activity" (desktop / Manager+Sales only, never on Floor), backed by **real Mapbox tiles** (`mapbox-gl`) — zoom, drag-pan, default street-level detail view over a clustered Langley, BC mill site.
- **Three A/B/C markers** for YD-A/B/C (brand-coral circles, white letters): **hover** shows that yard's tag count + total FBM (lime popup); **click** deep-links into Stock Locator filtered to that yard via a new `EntryFilter.yard` field feeding the existing Location filter (no existing filter logic changed).
- **Reset-view control** stacked below the +/− zoom buttons flies the map back to its initial center/zoom (and clears rotate/tilt).
- **Alignment**: moved Yard Activity's filter buttons to their own row under the title so the filter row and the map's top edge line up; both cards now share a `[title] → [content]` structure that aligns at any width.
- **Token handling**: map key read from `VITE_MAPBOX_TOKEN` (a **public** pk. token, safe to ship client-side — unlike the server-side `ANTHROPIC_API_KEY`), with a graceful placeholder when absent; typed via new `src/vite-env.d.ts`. `.env.local` stays git-ignored so the token isn't committed; set the same var in Vercel for prod.
- Along the way, the prior SVG yard map (built into Stock Locator) was fully reverted and rebuilt on the Dashboard.

**Files / 改动:** `features/dashboard/YardMap.tsx` (new), `features/dashboard/Dashboard.tsx`, `features/stock-locator/StockLocator.tsx`, `lib/types.ts`, `index.css`, `vite-env.d.ts` (new), `package.json` (+`mapbox-gl`)

---

## 2026-06-25 (4)

### `ef95884` · Thin custom sidebar scrollbar — 侧边栏滚动条改细

**🇨🇳 中文** — 屏幕较短、侧边栏导航被压缩需要滚动时，浏览器默认滚动条偏宽，且在某些平台两端会带方形的上下箭头按钮。改为细窄的圆角滚动条（半透明白色滑块，轨道透明），并隐藏了两端的箭头按钮方块。只在导航列表真正溢出时才会出现。

**🇬🇧 English** — When the viewport is short and the sidebar nav overflows, the browser's default scrollbar rendered wide with arrow-button boxes at each end on some platforms. Replaced with a slim, rounded, semi-transparent thumb on a transparent track, with the arrow-button boxes explicitly hidden. Only appears when the nav list actually overflows.

**Files / 改动:** `components/layout/Sidebar.tsx`, `index.css`

---
## 2026-06-26

### Stock Locator UX fixes — Stock Locator 体验细节修复

> 本条为一次 push 的汇总（含多项改动）。/ One push, several fixes.

**🇨🇳 中文**
- **Linked Transactions 显示总价**：详情面板「Linked Transactions」区块原来显示的是单价（$/件），现在改成数量 × 单价的总价，与销售单实际金额一致。
- **Date 筛选直接显示具体日期**：选中 1 个日期后，筛选按钮不再显示通用的「Date + 数字徽章」，而是直接显示该日期（如「1 Jun 2026」）；选中多个则显示「N dates」。
- **Export CSV / Last synced 挪到搜索框同一行**：原来和 Filter By 的筛选 pill 挤在一起，现在和顶部搜索框同一行右对齐；Filter By 的筛选 pill 单独占一行。
- **选中的 Tag 行高亮**：点开详情面板后，对应的表格行会高亮（珊瑚色），关闭面板后恢复正常；鼠标悬停在已高亮的行上时保持高亮（不会被悬停色覆盖掉）。
- **勾选框选中的行也高亮**：勾选导出用的复选框后，该行同样会高亮（绿色调，与选中态的珊瑚色区分），悬停时同理保持高亮。

**🇬🇧 English**
- **Linked Transactions now shows the line item's total price** (qty × unit price) instead of the per-unit price, matching the actual order amount.
- **Date filter shows the specific date directly**: once one date is picked, the filter button shows that date (e.g. "1 Jun 2026") instead of a generic "Date" + count badge; multiple dates show "N dates".
- **Export CSV / Last synced moved to share the search-bar row**, instead of crowding the Filter By pill row; Filter By pills now have their own row.
- **Selected tag row is highlighted**: opening a tag's detail panel highlights its table row (coral tint), clearing when the panel closes; hovering the highlighted row keeps it highlighted instead of being overridden by the generic hover color.
- **Checkbox-checked rows are highlighted too** (sage tint, distinct from the coral selection highlight), with the same hover-preserves-highlight fix.

**Files / 改动:** `features/stock-locator/StockLocator.tsx`

---

## 2026-06-28

### Available to Sell 上线 + Delivery Slips 解析与详情大重做 — Available to Sell launch + Delivery Slips parser & detail overhaul

> 本条为一次 push 的汇总（多次迭代到当前形态）。/ One push, iterated to the current form.

**🇨🇳 中文**

- **Available to Sell 销售视图（新页面）**
  - 抽离筛选原件：把 Stock Locator 的 `FilterDropdown` / `PillFilter` / `DateFilter` 及日历助手迁到 `features/stock-locator/filters.tsx`，两个页面共享，Stock Locator 行为不变。
  - 新页面 `features/available-to-sell/AvailableToSell.tsx`：只显示 `status === "Available"` 的 tag。9 列：Tag ID / Species / Grade / Dimensions (T×W×L) / Pieces / Total FBM / Location / Market Value / Days in Yard。Days in Yard 由 `history[0].t` 解析得到。
  - 四个 PillFilter（Species / Grade / Length / Location），选项从当前 Available 池动态推导；空筛选状态有「Clear filters」链接。
  - 每行 Reserve 按钮 → 弹窗只列 **Open** 的 Sales Order；Confirm 走既有 `onUpdateTag` + `onLinkSalesOrder` 通路把 tag 置为 Reserved、给对应 SO 追加 lineItem，落地后跳出 3 秒的 sage 成功 toast，tag 立刻从列表消失。
  - 仅 Manager + Sales 可见；Floor 切到该路由自动 redirect 到 Stock Locator（沿用 Settings 的 redirect 模式）。

- **Delivery Slips 解析与详情大重做（一次 push 多次迭代）**

  **AI Prompt 与数据形状（服务端）**
  - 原 prompt 按行返回 11 字段 (`species/grade/thick/...`) → 新 prompt 返回 `{ lineItems, sections }` 双部分结构：
    - `lineItems`: 一份带 `species/grade/thick/width/length/qty/pkgs?/state/milling/notes/confidence` 的产品行数组；当 PDF 含 Package Details 时再挂一个 `tags: [{tagNo, pcs, fbm}, ...]` 子数组（per-tag tally）。
    - `sections`: 按 6 大 ERP 分类的 key-value 元数据 — `shipment_identity / logistics / parties / dates_location / financial / unrecognized`，每条带 `field` (camelCase) / `value` / `confidence`。
  - **Financial 单独成类**：Payment Terms / Taxable Amount / Sales Tax / Total Invoice / Discount Note 等不再掉进 Unrecognized。
  - **明确支持多种文档形态**：发货单 Summary 表、Invoice 的 Description 列、Pick / Packing list 都算 line item — 修掉了之前 prompt 暗示「只看 Summary 行」导致 Invoice PDF（如 `16li2.pdf`）解析返回空数组的问题。
  - 服务端 `ensureFieldArray` / `ensureLineItemArray` 防御性清洗（drop 缺关键字段的条目，confidence 兜底为 `low`），UI 永远拿到完整的 6-section 形状。Wire 字段从 `items` → `parsed`。

  **详情页三栏式布局（前端）**
  - 三栏 `h-full flex flex-col` 容器内 `flex overflow-hidden` 中间区域：
    - **左侧 260px 侧栏**（独立滚动）：上方 Summary 卡 + 下方 6 个 metadata accordion；
    - **中间主区**（独立滚动）：line item 卡片列表；
    - **底部 sticky 操作栏**：左 ⚠️ 警告 + 右 Cancel + Confirm CTA。
  - 没有用 `position: fixed`，没有动 App.tsx 全局布局。

  **Summary 卡**：4 格主数据 Total FBM / Total pcs / Total pkgs / Supplier；次级一行 `N tags · M products`。Supplier 与 PO Number 用「按候选优先级 + 多 section 兜底」查找（supplier → shipper → vendor → from → carrier；poNumber → po → purchaseOrder → orderNo → bookingNumber），实际 PDF 解析常见命名都能命中；不重复显示 Slip No / Order No（那些在下方 Shipment Identity accordion 里）。

  **6 个 Metadata Accordion**：每个分类一张卡，标题 + 数量徽章 + 折叠箭头；Shipment Identity 永远渲染、Unrecognized 默认折叠、其它分类有内容才显示。每条字段：左 Title Case 标签（`orderNo` → `Order No`）/ 右值 + Confidence dot（高=实心绿 6px / 中=实心琥珀 6px / 低=红边空心环 6px，hover 显示「Review recommended」/「Verify manually」）。底部 `+ Add field` 内联输入框可手动补字段，手动条目带灰色「Manual」徽章 + ✕ 删除按钮。

  **Line Item 卡片（Mode A / Mode B 自动）**
  - 判定逻辑：`lineItems.some(it => it.tags?.length > 0) ? 'A' : 'B'`。
  - 每条 line item 一张卡，**选中 = coral 实色边框 + 完全不透明**；未选中 = sage 边 + 60% 透明度。
  - 卡内默认行：☑ + 下拉箭头（仅 Mode A 有 tags 时显示）+ 物种 + 等级胶囊 + `T×W × L'` 单色字号 + `N pcs` + `State · Milling` + `· N pkgs` + Confidence dot + **FBM 数字右对齐**。下方一行小灰字显示 `notes`（如 `2×6×12 #1 S4S HT White; 2.000 PKG; ...`）。
  - **Mode A 展开**：卡内嵌入 Package Details 列表，每条 child 行：🏷 + `tagNo` + `270 pcs · 964 FBM · 1 pkg`。
  - **Per-row Edit**（恢复）：点 Edit → 卡体切换为 4×2 下拉网格（Species / Grade / State / Milling / Thick / Width / Length / Qty）+ 实时 FBM 公式回显（`FBM = 1×4×14×1080÷12 = 3,840`）。非标准等级（Stud / Utility 等）由 `optionsFor` 自动 prepend 当前值，保持 select 有效。Done 切回展示态。

  **Confirm & Create**
  - **Mode A**: 每个勾选 group 的 child tag 数 → 等量 Pending Tag（每条 tag 的 species/grade/dims/state/milling 继承父 group，`qty/fbm` 取 child tally，slip 的 `tagNo` 写入 history event `"... · Slip Tag: 999048597"`）。Demo A 数据 7 个 group → 16 个 tag。
  - **Mode B**: 每个勾选 line item → 一个 Pending Tag。
  - 落地后跳到 Stock Locator 并只显示新建 tag，触发现有的 sage「N tags created · View all stock」横幅。

  **底部 sticky 操作栏**：⚠️ 警告条仅在有中/低信心条目时出现（`N items with medium or low confidence — review before confirming`）；右侧 Cancel（→ 返回上传）+ Confirm & create N tags（coral CTA，N 实时反映 Mode A 子项 / Mode B 行数）。

  **两份 demo 数据**：上传卡的「— or try a demo —」下方一对按钮：
  - **Mode A — Package Details**：AC Transport 出口发货单形态，7 个 SPF/Hem-Fir line items × 16 个 tag children；
  - **Mode B — Flat Invoice**：参考用户给的 SPF 发票 `16li2.pdf`，3 行 SPF #1 2×6 × 12'/14'/16'。

- **`EntryFilter` 扩展**：新增 `grade?: Grade[]` 和 `orderNo?: string`。Stock Locator 收到 `orderNo` 时解析对应 SO 的 `lineItems` → 拼出 `idSet`；如果只有 1 个匹配 tag，自动打开 drawer 并定位到 Linked Transactions（沿用 deep-link 模式）。

**🇬🇧 English**

- **Available to Sell (new page)**
  - Extracted Stock Locator's filter primitives (`FilterDropdown` / `PillFilter` / `DateFilter` + helpers) into a shared module `features/stock-locator/filters.tsx`. Stock Locator behavior unchanged.
  - New page `features/available-to-sell/AvailableToSell.tsx`: shows only tags where `status === "Available"`. Nine columns: Tag ID / Species / Grade / Dimensions / Pieces / Total FBM / Location / Market Value / Days in Yard (computed from `history[0].t`).
  - Four PillFilters (Species / Grade / Length / Location) with options derived from the live Available pool. Empty filter state shows a "Clear filters" link.
  - Per-row Reserve button → modal lists only **Open** sales orders. Confirm flows through the existing `onUpdateTag` + `onLinkSalesOrder` callbacks to flip the tag to Reserved and append a SO line item; sage success toast for 3s; tag drops off the list immediately.
  - Manager + Sales only; Floor auto-redirects to Stock Locator (mirrors the Settings redirect pattern).

- **Delivery Slips parser & detail page total rewrite (iterated multiple times in one push)**

  **AI prompt + data shape (server)**
  - Old prompt returned a per-row array of 11 fields → new prompt returns `{ lineItems, sections }`:
    - `lineItems`: products (`species/grade/thick/width/length/qty/pkgs?/state/milling/notes/confidence`). When the PDF has Package Details, each line item also carries a `tags: [{tagNo, pcs, fbm}, ...]` per-tag tally.
    - `sections`: ERP-categorized key-value metadata across 6 buckets — `shipment_identity / logistics / parties / dates_location / financial / unrecognized` — each item is `{ field (camelCase), value, confidence }`.
  - **Financial is its own bucket** so taxes / totals / discount notes no longer land in Unrecognized.
  - **Explicitly handles multiple document types**: delivery-slip Summary rows, invoice Description-column line items, pick / packing lists. Fixed the previous prompt's bias toward "Summary rows" that was causing real invoice PDFs (e.g. `16li2.pdf`) to return an empty `lineItems` array.
  - Defensive coercion in `ensureFieldArray` / `ensureLineItemArray` (drops malformed entries, defaults bad confidence to `low`), so the UI always sees the full 6-section shape. Wire field renamed `items` → `parsed`.

  **Three-zone detail layout (client)**
  - Feature root `h-full flex flex-col`, middle `flex overflow-hidden`:
    - **Left aside 260px** (independently scrollable): summary card + 6 metadata accordions
    - **Main** (independently scrollable): line item card list
    - **Sticky bottom bar**: warning + Cancel + Confirm CTA
  - No `position: fixed`, no edits to App.tsx layout.

  **Summary card**: 4 cells — Total FBM / Total pcs / Total pkgs / Supplier; secondary `N tags · M products` line. Supplier / PO Number use ranked-candidate cross-section lookup (supplier → shipper → vendor → from → carrier; poNumber → po → purchaseOrder → orderNo → bookingNumber), so real-world AI variations resolve. Slip No / Order No deliberately not duplicated here — they live in the Shipment Identity accordion.

  **6 metadata accordions**: header with title + count badge + chevron. Shipment Identity always renders; Unrecognized defaults closed; others render only if non-empty. Each field row: Title-Case label (`orderNo` → `Order No`) + value + confidence dot (high = solid green 6px / medium = solid amber 6px / low = red hollow ring 6px, with hover tooltips "Review recommended" / "Verify manually — low confidence"). Inline `+ Add field` at the bottom of every section; manual entries get a grey "Manual" badge and an ✕ delete button.

  **Line item cards (Mode A / Mode B auto)**
  - Detection: `lineItems.some(it => it.tags?.length > 0) ? 'A' : 'B'`.
  - Each line item is a card with coral solid border + full opacity when selected, sage border + 60% opacity when not.
  - Card row: ☑ + expand chevron (Mode A only) + species + grade chip + `T×W × L'` + `N pcs` + `State · Milling` + `· N pkgs` + confidence dot + **right-aligned FBM**. Notes render as a small grey line beneath.
  - **Mode A expand**: list of individual tag children inside the card — 🏷 + `tagNo` + `270 pcs · 964 FBM · 1 pkg`.
  - **Per-row Edit (restored)**: Edit toggles the card body to a 4×2 select grid (Species / Grade / State / Milling / Thick / Width / Length / Qty) with live FBM formula echo (`FBM = 1×4×14×1080÷12 = 3,840`). Non-standard incoming values (Stud / Utility / …) auto-prepended via `optionsFor` so the select stays valid. Done flips back to display.

  **Confirm & Create**
  - **Mode A**: one Pending Tag per child tag row across checked groups (species/grade/dims/state/milling inherited from parent; `qty/fbm` from the child tally; slip's `tagNo` recorded in the history event as `"... · Slip Tag: 999048597"`). Demo A: 7 groups → 16 Tags.
  - **Mode B**: one Pending Tag per checked row.
  - Lands on Stock Locator filtered to the new tag IDs, triggering the existing sage "N tags created · View all stock" banner.

  **Sticky bottom bar**: amber ⚠️ warning shows only when at least one line item is medium/low confidence (`N items with medium or low confidence — review before confirming`); Cancel returns to upload; Confirm & create N tags is the coral primary CTA (N updates live per Mode A child count / Mode B row count).

  **Two demo seeds** behind a pair of buttons on the upload card:
  - **Mode A — Package Details**: AC Transport-style export delivery slip — 7 SPF / Hem-Fir line items × 16 tag children
  - **Mode B — Flat Invoice**: mirrors the user-supplied SPF invoice (`16li2.pdf`) with 3 SPF #1 2×6 × 12'/14'/16' product lines

- **`EntryFilter` extended**: added `grade?: Grade[]` and `orderNo?: string`. When Stock Locator receives `orderNo`, it resolves the matching SO's `lineItems` into a tagIds set; if exactly one tag matches, auto-opens its drawer and surfaces Linked Transactions (reuses the deep-link pattern).

**Files / 改动:**
- `features/stock-locator/filters.tsx` (new — shared filter primitives)
- `features/stock-locator/StockLocator.tsx` (extracted filters, added `grade` + `orderNo` entryFilter handling, drawer auto-open on single-tag match)
- `features/available-to-sell/AvailableToSell.tsx` (new page + Reserve modal)
- `features/delivery-slips/DeliverySlips.tsx` (multi-iteration rewrite — three-zone layout, Mode A/B cards, inline Edit, Add field, two demo seeds)
- `api/_core.ts` (new prompt — line_items + 6 sections + tags[]; defensive coercion)
- `api/parse-slip.ts` (returns `{ parsed: ParsedSlip }`)
- `vite.config.ts` (dev middleware mirrors the new wire shape)
- `src/lib/anthropic.ts` (new types — `SlipField` / `SlipLineItem` / `SlipLineItemTag` / `ParsedSlip`; `emptyParsedSlip()` helper)
- `src/lib/types.ts` (`EntryFilter.grade` + `EntryFilter.orderNo`)
- `src/App.tsx` (`avail` route + Floor redirect; DeliverySlips wired with `onNavigateToLocator`)

---

## 2026-06-28 (2)

### Delivery Slips：Supplier 可编辑换行 + 左侧面板可拖拽变宽 — editable/wrapping Supplier + draggable panel resize

**🇨🇳 中文**
- **Supplier 不再截断**：Summary 卡里的 Supplier 原来超长就被省略号截断成一行，现在改成单独一行展示并允许自然换行（如 "AC Transport Ltd. (Surrey, BC)" 会显示两行）。
- **Supplier 可编辑**：旁边新增铅笔图标，点击进入编辑态（文本框 + 保存 ✓ / 取消 ✕），用于 AI 的候选字段查找（supplier/shipper/vendor/carrier 等）没能命中真实文档里不常见表头时的人工修正。编辑值会同步用到 Confirm & Create 时写入新 Tag 的 `supplier` 字段；清空后自动恢复到 AI 识别值。
- **左侧 Metadata 面板可拖拽变宽**：左侧栏与右侧 Cargo Line Items 之间新增一条可拖拽分隔条（hover 高亮 coral），左右拖动可在 220px–480px 范围内调整面板宽度，方便看清 Logistics / Parties 里较长的字段值（如 Vessel 名称、地址）不被挤压。

**🇬🇧 English**
- **Supplier no longer truncates**: previously ellipsis-clipped to one line in the Summary Card; now its own row, wrapping naturally onto multiple lines (e.g. "AC Transport Ltd. (Surrey, BC)" renders on two lines).
- **Supplier is now editable**: a pencil icon toggles an inline text field (Save ✓ / Cancel ✕) for correcting cases where the AI's candidate lookup (supplier/shipper/vendor/carrier/…) misses an unusual document header. The edited value feeds both the Summary Card display and the `Tag.supplier` written on Confirm & Create; clearing the field reverts to the AI-derived value.
- **Left metadata panel is now drag-resizable**: a draggable divider between the left aside and the Cargo Line Items area lets the panel width be adjusted (clamped 220–480px), giving room for long Logistics/Parties values (vessel names, addresses) that were getting cramped at the fixed 260px width.

**Files / 改动:** `features/delivery-slips/DeliverySlips.tsx`

---

## 2026-06-28 (3)

### Delivery Slips：每个 Metadata 字段可编辑 + 拖拽下限调大 — per-field edit in every metadata section + larger resize floor

**🇨🇳 中文**
- **6 个 Metadata 分类的每一行都可编辑**：Shipment Identity / Logistics / Parties / Dates & Location / Financial / Unrecognized —— 不论是 AI 提取的字段还是手动 `+ Add field` 加的字段，行尾都新增铅笔图标，点击进入编辑态（同 Supplier 的交互模式：文本框 + 保存 ✓ / 取消 ✕）。
- **Supplier 查找联动**：Parties（或 Logistics）里的 supplier/shipper/vendor/carrier 字段一旦被手动改值，Summary 卡的 Supplier 与 Confirm & Create 写入新 Tag 的 `supplier` 也会同步更新（除非 Summary 卡上单独覆盖过）。内部把只读的 `parsed.sections` 换成了一份可编辑副本 `editedSections`，与既有的 line items 可编辑模式保持一致。
- **拖拽面板宽度下限调大**：原来最窄可拖到 220px，会导致 Total FBM / Total Pcs / Total Pkgs 三格统计数字挤在一起重叠；下限提到 300px，三格数字与标签在最窄状态下也不会重叠。

**🇬🇧 English**
- **Every row in all 6 metadata sections is now editable**: Shipment Identity / Logistics / Parties / Dates & Location / Financial / Unrecognized — both AI-extracted fields and manually-added ones get a pencil icon at the end of the row, toggling the same inline edit pattern used by the Supplier field (text input + Save ✓ / Cancel ✕).
- **Supplier lookup now reads the edited copy**: correcting a supplier/shipper/vendor/carrier field directly inside Parties (or Logistics) updates the Summary Card's Supplier cell and the `Tag.supplier` written on Confirm & Create (unless overridden separately via the Summary Card). Internally swapped the read-only `parsed.sections` for an editable `editedSections` copy, mirroring the existing line-items editing pattern.
- **Raised the panel resize floor**: the divide could previously be dragged down to 220px, which caused the Total FBM / Total Pcs / Total Pkgs stat grid to overlap. Floor raised to 300px so the stat numbers and labels never collide at the narrowest width.

**Files / 改动:** `features/delivery-slips/DeliverySlips.tsx`

---

## 2026-06-28 (4)

### Delivery Slips：Metadata 编辑改为整块切换 — metadata Edit moved to block-level

**🇨🇳 中文**
- **编辑入口从「每一行」改为「每个分类标题旁」**：上一条改动里给每行字段单独加的铅笔图标撤掉了，改成每个 Metadata 分类（Shipment Identity / Logistics / Parties / Dates & Location / Financial / Unrecognized）标题旁放一个 Edit 按钮——点一下，整块里的所有字段同时变成可输入框（若分类是折叠的会自动展开），编辑内容实时生效；再点 Done 一次性退出编辑态、回到只读展示。和 Cargo Line Items 卡片现有的 Edit / Done 交互保持一致，不再有第二套编辑模式。

**🇬🇧 English**
- **Edit entry point moved from per-row to per-block**: the previous batch's per-field pencil icon is gone — each metadata section (Shipment Identity / Logistics / Parties / Dates & Location / Financial / Unrecognized) now has a single Edit button next to its title. Clicking it opens the section if collapsed and switches every field in that block into an inline input at once, applying edits live as you type; Done exits back to the read-only view in one click. Matches the existing Edit/Done interaction already used on the Cargo Line Item cards instead of introducing a second pattern.

**Files / 改动:** `features/delivery-slips/DeliverySlips.tsx`

---

## 2026-06-30

### Stock Locator：删除 Tag + Maze 用户测试录制 — Delete tag + Maze user-testing snippet

**🇨🇳 中文**
- **Stock Locator 支持删除 Tag（Manager 专属）**：两个入口共用同一个确认弹窗——工具栏 Export CSV 旁新增 **Delete (N)** 按钮，勾选一个或多个行后生效；详情面板 header 里 Edit 旁边加了 **Delete** 按钮。弹窗列出所有待删 Tag ID，被 Sales Order 引用的 tag 会自动标注"linked to a sales order — will be skipped"并从删除清单里剔除（避免孤儿 `lineItem` 引用），全部被引用时 Delete 按钮直接 disabled。删除成功后自动清理表格勾选态，当前打开的详情面板若被删也会自动关闭。
- **接入 Maze 用户测试录制**：`index.html` 的 `<head>` 里嵌入 Maze universal loader（api key `bf5dbe15-…-f053724f33d3`）——为 7 月用户测试提供录屏、热成像与 in-product prompts。按 Maze 的官方要求直接嵌入，未走 GTM。

**🇬🇧 English**
- **Stock Locator supports deleting tags (Manager-only)**: two entry points share one confirmation modal — a new **Delete (N)** button in the toolbar next to Export CSV (activates once rows are checked), and a **Delete** button in the DetailDrawer header next to Edit. The modal lists every selected Tag ID; any that are referenced by a Sales Order lineItem are flagged "linked to a sales order — will be skipped" and filtered out of the actual delete (prevents dangling SO references). If all selected tags are linked, the Delete button is disabled. On success the toolbar selection is cleared, and if the currently-open DetailDrawer belongs to a deleted tag it auto-closes.
- **Maze user-testing snippet installed**: added Maze's universal loader (`bf5dbe15-…-f053724f33d3`) to `index.html`'s `<head>` for the July round of user testing — enables session recordings, click heatmaps, and in-product prompts. Embedded directly per Maze's install guidance rather than via GTM.

**Files / 改动:** `App.tsx`, `features/stock-locator/StockLocator.tsx`, `index.html`

---

## 2026-07-06

### Delivery Slips：多文件上传、逐个解析确认 — multi-file upload, parse & confirm one at a time

**🇨🇳 中文**
- **一次上传多个送货单**：文件选择框支持多选（PDF / JPG / PNG，不支持的格式自动剔除并提示），文件排成队列**严格按顺序逐个处理**——解析 → 审核 → 确认建 tag → 自动进入下一个文件。
- **进度可见**：Analyzing 页显示整个队列清单（已完成 ✓ / 当前解析中 ⟳ / 等待 ○）和 "file 1 of 2"；审核页 header 显示 **File 2 of 3** 与累计已建 tag 数。
- **底栏新增 Skip this file**：跳过当前文件继续队列（最后一个文件时变为 "finish"）；还有后续文件时 Confirm 按钮显示 "· next file →" 提示。
- **跳转时机变化**：中间文件 confirm 后不再立刻跳走，而是直接解析下一个；**整个队列处理完**才跳转 Stock Locator，且带上本批**所有文件**创建的全部 tag；全部跳过则回到上传页。
- **解析失败恢复**：新增错误页，可 Retry / Skip this file / Cancel，单个文件解析失败不再中断整批。单文件与 demo 路径行为不变（即长度为 1 的队列）。

**🇬🇧 English**
- **Upload multiple slips at once**: the file picker now accepts multi-select (PDF / JPG / PNG; unsupported formats are filtered out with a notice). Files form a queue processed **strictly one at a time** — parse → review → confirm → auto-advance to the next file.
- **Visible progress**: the Analyzing panel lists the whole queue (done ✓ / parsing ⟳ / waiting ○) with "file 1 of 2"; the review header shows **File 2 of 3** plus a running count of tags created so far.
- **New Skip this file action** in the bottom bar (reads "finish" on the last file); the Confirm button appends "· next file →" when more files remain.
- **Navigation timing changed**: confirming a mid-queue file no longer leaves the page — it starts parsing the next file immediately. Stock Locator opens only **after the whole queue finishes**, filtered to every tag created across **all files in the batch**; skipping everything returns to upload.
- **Parse-failure recovery**: a new error panel offers Retry / Skip this file / Cancel, so one bad file no longer aborts the batch. Single-file uploads and the demo buttons behave exactly as before (a queue of one).

**Files / 改动:** `features/delivery-slips/DeliverySlips.tsx`

---

## 2026-07-07

### Sidebar 重复点击回到功能初始页 + Delivery Slips 拖拽上传 — sidebar re-click resets feature + drag & drop upload

**🇨🇳 中文**
- **Sidebar 重复点击 = 回到初始界面**：不管当前功能进行到哪一步（送货单审核页、Tag Entry 向导第 3 步、Stock Locator 筛选 + 详情抽屉……），再点一次 sidebar 里**当前所在**的那一项，该功能就整体回到初始状态。实现上是 App 里加了一个 `navEpoch` 计数器：同页重复点击时递增，与 `nav` 一起作为功能容器的 React key，key 变化触发整个功能组件重挂载——所有内部状态自动归零、滚动回顶部，不需要每个功能单独写 reset 逻辑，未来新增功能自动获得同样行为。Tag 数据本身存在 App 层（`useTags`），不受影响。
- **Delivery Slips 支持拖拽上传**：把文件（可多个）直接拖进虚线框即可上传，悬停时边框/图标变 coral、文案切换为 "Drop to upload"。松手后走与点击上传完全相同的逻辑——格式过滤、多文件队列、逐个解析确认。

**🇬🇧 English**
- **Re-clicking the active sidebar item resets that feature to its initial screen**: wherever you are inside a feature (slip review page, Tag Entry wizard step 3, Stock Locator filters + open drawer…), clicking its sidebar entry again returns it to the starting view. Implemented with a `navEpoch` counter in App: a same-page click bumps it, and `nav + epoch` form the feature container's React key, so the change remounts the whole feature component — every piece of internal state resets and scroll returns to top, with no per-feature reset code, and future features inherit the behavior automatically. Tag data lives in App-level state (`useTags`) and is untouched.
- **Drag & drop upload in Delivery Slips**: drop one or more files straight onto the dashed dropzone — while hovering, the border/icon turn coral and the copy switches to "Drop to upload". Dropped files run through exactly the same pipeline as click-to-upload: format filtering, the multi-file queue, and one-at-a-time parse & confirm.

**Files / 改动:** `App.tsx`, `features/delivery-slips/DeliverySlips.tsx`

---

## 2026-07-13

### Delivery Slips 6 项升级：单价、Confirmation 页、Qty 自由输入、Lookup 自动扩容、Financial 只留钱 — Delivery Slips: unit price, confirmation page, free qty input, auto-lookups, money-only Financial

**🇨🇳 中文**
- **新 Tag 属性自动加入系统 lookup**：无论是通过 Tag Entry 保存还是 Delivery Slips 确认建 tag，如果 species / grade / state / milling / yard 里出现了原本不在系统默认或自定义 lookup 里的值（比如 AI 从 slip 里解析出的 "Stud" / "Utility"），自动写入 Manager 的自定义 lookup（`localStorage: timbridge_custom_lookups`），下次这些值就在下拉里出现，无需去 Settings 手动加。重复值静默 no-op。
- **Delivery Slips 的 Qty 编辑改为自由数字输入框**：原来的下拉列表覆盖不到真实的 pcs 数（1080、270、320…），现在 EditForm 的 Qty 是 `<input type="number" min="1" step="1">`，可以直接键入任意数字。
- **Financial 区只放钱**：AI prompt 明确 "MONEY ONLY"，并教它把非金额字段（FBM / footage / 总 pcs / 总 pkgs）扔进 Unrecognized；服务端再兜底一次——匹配到 `fbm|footage|board feet|totalpcs|totalpieces|totalpkg|totalpackages` 的字段自动挪出 Financial。
- **每行 Slip 显示单价与单行总价，并累加成订单总价**：`SlipLineItem` 加了可选的 `unitPrice`（USD / piece）。AI prompt 教它从 invoice 单价列或 `$/MBF` 单位里换算；EditForm 里 Qty 旁边加了 Unit price 输入框与自动计算的 Line total；每张 slip 行下方显示 `Unit price: $4.20 / pc · $1,344.00 line total`；底栏 stats 增加 **Total** 列 = Σ (unitPrice × qty) 覆盖当前选中的所有行。
- **Confirm & Create 后新增 Confirmation 页**：不再直接跳走。整个队列跑完后落到该页，标题按结果切换：
  - 全部成功 → `N of N slips imported`
  - 部分失败 → `X of Y slips imported — K failed`（列出每个文件是 imported N tags / Parse failed / Skipped 哪一种，附对应图标）
  - 全部失败 → `Import failed`（红色警告）
  - 下方三个按钮：**View created tags →**（Stock Locator 过滤到本批 tag）· **View all stock**（Stock Locator 全量）· **Upload more**（回上传页）。解析失败页里的 Skip 也支持在最后一个文件用（此前只在有下一份文件时可点），保证已成功导入的部分不会被 Cancel 丢弃。

**🇬🇧 English**
- **New tag property values auto-populate the lookup tables**: whenever Tag Entry saves or Delivery Slips confirms tags, any species / grade / state / milling / yard value that isn't already in the merged system+custom lookups (e.g. AI-parsed "Stud" or "Utility") is written to the Manager's custom lookups (`localStorage: timbridge_custom_lookups`) — so those values show up in dropdowns next time without a manual Settings visit. Duplicates silently no-op.
- **Free-form qty number input in Delivery Slips edit**: the qty select had a fixed option list that couldn't cover real piece counts (1080, 270, 320…). Replaced with `<input type="number" min="1" step="1">` so users type any count.
- **Financial section: money only, no FBM**: the parser prompt now says "MONEY ONLY" for the Financial category and explicitly routes footage / FBM / total pcs / total pkgs to Unrecognized; a server-side backstop matches `fbm|footage|board feet|totalpcs|totalpieces|totalpkg|totalpackages` and moves any offenders out of Financial.
- **Per-line unit price + line total + order subtotal**: `SlipLineItem` gained an optional `unitPrice` (USD / piece). Prompt guidance teaches the AI to pull it from invoice unit-price columns or to convert `$/MBF` to per-piece using board-feet math. EditForm adds a Unit-price input next to Qty plus a read-only auto-computed Line total; each slip row displays `Unit price: $X.XX / pc · $Y.YY line total`; the bottom-bar stats grid gains a **Total** column summing (unitPrice × qty) over the currently-selected rows.
- **New confirmation page after Confirm & Create**: the batch no longer jumps straight to Stock Locator. When the queue finishes it lands on a summary page whose heading adapts to outcome:
  - All succeeded → `N of N slips imported`
  - Partial → `X of Y slips imported — K failed` (each file listed as imported N tags / Parse failed / Skipped with the matching icon)
  - All failed → `Import failed` (coral warning)
  - Below: three buttons — **View created tags →** (Stock Locator filtered to this batch), **View all stock** (unfiltered), **Upload more** (returns to the upload screen). Skip on the parse-error page is now always available (previously only when another file remained), so already-successful files aren't lost by Cancel.

**Files / 改动:** `api/_core.ts`, `src/lib/anthropic.ts`, `src/features/tag-entry/TagEntry.tsx`, `src/features/delivery-slips/DeliverySlips.tsx`

---

## 2026-07-16

### 筛选自动生效 + 表格分页 + 统一按钮体系 + 珊瑚色去过度使用 — Auto-apply filters + pagination + unified Button primitive + coral overuse cull

**🇨🇳 中文**
- **筛选点击即时生效，去掉 Apply Now 按钮**：Stock Locator / Available-to-Sell 用的 `FilterDropdown` / `PillFilter` / `DateFilter` 全面重构——每次点 pill 或日期就直接更新 filter 状态，表格立刻重算，popover 保持打开供多选，点外部关闭。删除了 `sameSet` 判等和 draft/apply 两态 → 底栏 Apply Now 按钮同步移除。
- **数据表分页**：新增共享组件 [`Pagination`](src/components/shared/Pagination.tsx) + `usePagedSlice` helper，默认 25 行/页（admin 表格惯例 · Airtable / Linear / Notion），提供 **10 / 25 / 50 / 100** 选项。Stock Locator 与 Available-to-Sell 表格接入：底部显示 "Showing N–M of X · Rows / page · Page N of M · ‹ ›"；filter 变化时自动 reset 到第 1 页，`total` 缩小时 clamp。
- **统一按钮 primitive**：新增 [`Button`](src/components/shared/Button.tsx)，四个 variant × 三个 size：
  - `primary`（filled coral，主 CTA）· `secondary`（sage 描边，中性/取消）· `destructive`（coral 描边，删除类）· `ghost`（纯文本）
  - `sm` / `md` / `lg`，含 `disabled` 兜底样式与 focus ring
  - 各种散落的手写按钮（Confirm & create / Cancel / Save / Delete / Reserve / Retry / Skip 等 20+ 处）迁移到该 primitive，hover / disabled / focus 一致。
- **珊瑚色过度使用治理**（遵循 60/30/10 rule 与 "accent = signal, not decoration"）：
  - **保留 coral**：primary CTA、destructive 按钮、sidebar 当前项、激活的 filter chip、低库存告警（qty < 50）、Discrepancy 状态、警告图标/文本、Row 选中底色、Detail Drawer 最终 bin badge、上传页 Truck hero icon、拖拽悬停高亮、"N tags to create" 强调。
  - **去除 coral**：Stock Locator 表格整列 Tag ID → 深灰；Detail Drawer / Floor 卡 / 删除弹窗里的所有 Tag ID → 深灰；Delivery Slips 每行 FBM 总数与展开子行 FBM → 深灰（原本每行橙字重复）；底栏 stats（Pcs/Pkgs 是 ink 而 FBM 是 coral）统一 ink；EditForm 的 FBM 公式行降为 `text-text-sec` + 结果 ink；Header "File N of M" 进度 → ink；Tag Entry 完成 CheckCircle 从 coral 换为 `emerald-500`（success 语义应为绿）；Dashboard "FBM by Species" bar chart 原本 ink/coral 交替填充（data-viz 单序列应用单色），改为纯 ink + hover opacity。

**🇬🇧 English**
- **Filters auto-apply on every click, Apply Now button removed**: `FilterDropdown` / `PillFilter` / `DateFilter` no longer keep a draft — every pill or date click updates the filter state directly and the table re-filters live. The popover stays open for multi-select; clicking outside dismisses. `sameSet` equality and the applyEnabled gate are gone.
- **Pagination on data tables**: new shared [`Pagination`](src/components/shared/Pagination.tsx) primitive + `usePagedSlice`, default 25 rows/page (admin-table convention — Airtable / Linear / Notion) with **10 / 25 / 50 / 100** options. Stock Locator and Available-to-Sell now render "Showing N–M of X · Rows / page · Page N of M · ‹ ›" beneath the table; page auto-resets to 1 on filter change, clamps when the total shrinks.
- **Unified Button primitive**: new [`Button`](src/components/shared/Button.tsx) with four variants × three sizes:
  - `primary` (filled coral CTA) · `secondary` (sage outline neutral) · `destructive` (coral outline delete) · `ghost` (text-only)
  - `sm` / `md` / `lg`, with baked-in disabled styling and a focus ring
  - Twenty-plus ad-hoc buttons across features (Confirm & create, Cancel, Save, Delete, Reserve, Retry, Skip …) migrated to the primitive so hover / disabled / focus states match.
- **Coral overuse cleanup** (following the 60/30/10 rule — accent belongs to signals, not decoration):
  - **Kept coral for**: primary CTAs, destructive buttons, active sidebar item, active filter chip, low-qty warning (qty < 50), Discrepancy status, alert icons/text, selected-row background tint, DetailDrawer final-bin badge, upload-page Truck hero icon, drag-over dropzone highlight, "N tags to create" emphasis.
  - **Removed coral from**: the whole Tag ID column in Stock Locator (a full column of orange text); Tag ID in DetailDrawer / floor cards / delete confirm modal — all now dark ink; per-row FBM totals in Delivery Slips group cards and expanded package-detail children (repeated orange numbers) — now ink; bottom-bar stats where FBM was coral while Pcs/Pkgs were ink — all unified to ink; EditForm's FBM formula readout to `text-text-sec` with the result in ink; the "File N of M" progress hint to ink. Tag Entry's completion CheckCircle went from coral to `emerald-500` (success semantically = green, not warning). The Dashboard "FBM by Species" bar chart previously alternated ink/coral fills (a data-viz single-series should be single-color) — now uniform ink with hover opacity feedback.

**Files / 改动:** new `src/components/shared/Button.tsx`, `src/components/shared/Pagination.tsx`; `src/features/stock-locator/filters.tsx`, `src/features/stock-locator/StockLocator.tsx`, `src/features/available-to-sell/AvailableToSell.tsx`, `src/features/delivery-slips/DeliverySlips.tsx`, `src/features/tag-entry/TagEntry.tsx`, `src/features/dashboard/Dashboard.tsx`

---

## 2026-07-16 (2)

### Floor Dashboard 修复 + Sales 角色三态入口与权限矩阵收紧 — Floor Dashboard fix + Sales role toggle & tightened permission matrix

**🇨🇳 中文**
- **Floor 视角的 Dashboard 找回入口**：侧边栏权限表里 Dashboard 之前没把 `floor` 列进去——地板工一旦切到别的功能，就再也没有入口点回 Dashboard 了。现在补上，Floor 的侧边栏随时能点回 Dashboard。
- **Floor Dashboard 内容修正**：`My Tasks Today` / `Recent Scans` 的计数原来是写死的 `3` / `5`，改成动态算数组长度；Recent Scans 每行原来用"取前三个词 + …"的方式硬切文字，把地点、方向信息都切没了，现在显示完整消息；每行加上点击跳转到对应 Tag 详情。
- **顺带修了一个静默失效的死点击**：点击 Recent Scans 跳到 Stock Locator 后，Floor 视角其实从来没渲染过对应 Tag 的详情（状态设了但没画面）。新增一个只读的 `FloorTagSheet`（复用现有底部弹层样式），显示 Tag 的状态/位置/规格/历史，Pending 状态还带"Confirm Receipt"直达按钮。
- **Sales 角色补上真正的三态切换入口**：`Role` 类型早就有 `sales`，但顶栏的 Manager/Floor 二态开关一直没给它入口。现在顶栏是 Manager View / Sales View / Floor View 三态直切，Manager/Floor 原有行为不受影响。
- **权限矩阵按"销售能看什么、不能看什么"的原则收紧**：Sales 拿掉了 Purchase Orders / Production / Reports（进货成本、排产、缺口核算属于内部运营数据）；新增 Shipping / Trucking、Invoicing 两个占位入口（对 Manager + Sales 开放，功能待建）；Approvals 对 Sales 也开放（先和 Manager 共用同一个占位页，"提交 + 我的申请"这套独立视图还没建）。
- **Stock Locator 对 Sales 改成真正的只读**：之前 Sales 打开 Tag 详情面板其实能点 Edit 改位置/规格甚至状态——现在 Edit 按钮只在 Manager 下出现，Linked Transactions 仍可见，Pricing 仍隐藏；Available to Sell 自己的 Reserve 流程走独立路径，不受影响。
- **Floor 的 Settings 入口顺手拿掉**：这一项本来路由层就已经拦住非 Manager 访问，侧边栏却还留着个点了没反应的死链接。

**🇬🇧 English**
- **Floor Dashboard is reachable again**: the sidebar's permission table never listed `floor` for the Dashboard entry, so once a floor worker navigated elsewhere there was no way back. Fixed — Dashboard now always shows in Floor's sidebar.
- **Floor Dashboard content fixes**: `My Tasks Today` / `Recent Scans` counts were hardcoded (`3` / `5`) — now computed from the actual array length. Recent Scans rows used to hard-truncate to the first three words plus "…", losing the location/direction detail — now shows the full message, and each row is tappable through to that tag.
- **Fixed a silent dead click along the way**: tapping a Recent Scans row navigated to Stock Locator, but floor view never actually rendered the opened tag (state was set with nothing drawn). Added a read-only `FloorTagSheet` (reusing the existing bottom-sheet styling) showing status/location/specs/history, with a "Confirm Receipt" shortcut when the tag is Pending.
- **Sales gets a real three-way toggle**: `Role` already had `sales` at the type level, but the TopBar switch was Manager/Floor only. It's now a three-way Manager View / Sales View / Floor View switch; Manager and Floor behavior is unchanged.
- **Permission matrix tightened to "what Sales needs vs. internal ops data"**: Sales loses Purchase Orders / Production / Reports (procurement cost, scheduling, and shortage/cost roll-ups are internal). Gains two new placeholder entries, Shipping / Trucking and Invoicing (Manager + Sales, feature TBD), and Approvals (shares Manager's placeholder page for now — the "submit + my requests" view is still unbuilt).
- **Stock Locator is genuinely read-only for Sales now**: Sales could previously open a tag's detail panel and Edit its location/specs/even status. The Edit button now only renders for Manager; Linked Transactions stays visible, Pricing stays hidden. Available to Sell's own Reserve flow is a separate path and is unaffected.
- **Dropped Floor's dead Settings link**: the route itself was already Manager-only, so this was a sidebar entry that led nowhere for Floor.

**Files / 改动:** `src/components/layout/Sidebar.tsx`, `src/components/layout/TopBar.tsx`, `src/hooks/useRole.ts`, `src/App.tsx`, `src/features/dashboard/Dashboard.tsx`, `src/features/stock-locator/StockLocator.tsx`

---

## 2026-07-17

### Phase 3 功能落地：Sales Orders 实模块 + 部分数量 Reserve 拆分 + Approvals + 客户实体 CRM + 合并 Insights — Phase 3 feature landing: real Sales Orders + partial-qty Reserve split + Approvals + Client CRM + merged Insights

**🇨🇳 中文**

**1. Sales Orders 实模块**（新 [`features/sales-orders/`](src/features/sales-orders/)）
- 从 ComingSoon 占位换成真实列表页 + 侧抽屉详情页（复用 Stock Locator 的 side drawer + fullscreen 模式）。列表列显示 SO Number / Customer / Status / Line Items / Total / Created，支持按 Status 和 Customer 筛选（复用 `PillFilter`），复用 Pagination。
- **状态推进**：Open → Picked → Shipped 顺序前进（Cancelled 是终态无按钮）；二次确认弹窗。**Shipped 触发级联**：SO 状态和所有关联 Reserved tag 状态在同一 event handler 里连续 setState，React 18 批更新，两个 store 不会分裂到不同帧；tag movement history 追加 `Shipped via {soId}`。
- **深链打通**：Stock Locator 的 Linked Transactions 里 SO 号从"coming soon" tooltip 换成可点击 chip 深链到 Sales Orders 页并自动打开对应抽屉；SO 详情里的 Tag ID chip 深链回 Stock Locator 并打开 Tag 抽屉。
- **共享组件抽取**：`SOStatusPill` 从 Stock Locator 抽到 [`components/shared/SOStatusPill.tsx`](src/components/shared/SOStatusPill.tsx)，两个 feature 共用一份。
- Sidebar label 从 "Sales" 改成 "Sales Order"（NavKey 保持 `sales`）。

**2. Available to Sell 的 Reserve 弹窗加"部分数量保留"**
- Reserve 弹窗新增 Qty 数字输入框（默认 = tag.qty，min 1，max tag.qty），实时提示"整条保留" vs "会拆分 X pcs，剩 Y pcs 保持 Available"。
- **Qty < tag.qty 触发拆分**：生成新 tag 继承原 tag 全部字段（species/grade/dims/state/milling/supplier/location/parentLog + 原完整 history），qty 为输入值，fbm 用 `calcFbm` 按新 qty 重算（**用 `calcFbm` 而非 `calcBoardFeet`——否则拆出来的 Tag 会带小数 FBM，和表里所有其它整数 tag 不一致**），status = Reserved，`parentTagId` 指回原 tag，history 追加 `Split from {原 id} · Reserved via Available-to-Sell`；原 tag qty 扣减、fbm 重算、`splitTagIds` 追加新 id、history 追加 `Split N pcs into {newId} · ...`；SO lineItem 挂新 tag。
- 新增 App 层 `onCreateTag` 回调（`setTags(prev => [...prev, tag])`）——之前所有 tag mutation 都是 mutate-in-place，这是第一个 create-new 的路径。
- Stock Locator 详情面板 Traceability 下方新增 **Tag Lineage** 区块：Split from / Split into 都是可点击 chip 跳转对应 tag。

**3. Approvals 实模块**（新 [`features/approvals/`](src/features/approvals/)）
- `lib/types.ts` 加 `ApprovalRequest` 类型（id/type: discount|creditTerm|orderCancellation|other / requestedBy / relatedSoId / relatedClientId / details / status: Pending|Approved|Rejected / reviewedBy / reviewNote / createdAt / resolvedAt）。
- 同一个 `nav === "approvals"` 入口按 role 分派：Sales → [`MyApprovals`](src/features/approvals/MyApprovals.tsx)（我的请求，全状态历史），Manager → [`ApprovalQueue`](src/features/approvals/ApprovalQueue.tsx)（Pending 队列，Approve/Reject + 可选 reviewNote，二次确认）。
- **入口点**：Available to Sell Reserve 弹窗左下角"Need approval? Request one"（stack 在 Reserve 上不打断保留流程）；Sales Order 详情 header 加"Request approval"按钮（自动 prefill related SO）。共享 [`RequestApprovalForm`](src/features/approvals/RequestApprovalForm.tsx)。
- **决议通知**：Manager 决定后，Sales 下次访问 MyApprovals 时顶部 ConfirmationBanner "1 of your requests has a decision" + 卡片 coral 高亮 + "NEW DECISION" 标签；点 "Got it" 或右上角 X 后 acknowledge 落到 App 层 `acknowledgedApprovalIds: Set<string>`（隔离 store，不改动 spec 的 ApprovalRequest 字段），跨 nav 往返不重现。resolved 详情（Approved by X + note）永远保留在卡片上。

**4. Client Profile CRM + `SalesOrder.customer` → `SalesOrder.clientId` FK 迁移**（新 [`features/clients/`](src/features/clients/)）
- `Client` 类型（id/name/contactName?/phone?/email?/address?/notes?/createdAt）。
- [`useClients` hook](src/hooks/useClients.tsx) 参照 useLookups 的 Context+Provider+localStorage 模式（key `timbridge_clients`）；`load()` 首次读到空时把 [`INITIAL_CLIENTS`](src/lib/mock-data.ts) seed 落库；暴露 `clients`/`clientById`/`getClientName`/`updateClient`。
- **一次性迁移**：mock-data.ts 新增 `INITIAL_CLIENTS`（C-0001 Coastal / C-0002 Fraser / C-0003 Island Pallet），salesOrders seed 的 `customer` 字符串全部换成对应 `clientId`。
- Clients 列表页（搜索 + Pagination + 表格）+ Client 详情抽屉（View/Edit 内联切换，Linked Sales Orders 聚合显示 SO 计数 + 总收入 + 可点击跳转 SO 详情）。
- **全线切换到 client resolver**：SalesOrders 表 / SalesOrderDetail / StockLocator Linked Transactions + Reserved 状态确认下拉 / AvailableToSell Reserve 弹窗 SO 选项 label 全部改走 `getClientName(so.clientId)`。SO 表和 SO 详情的客户名可点击深链回 Client Profile。孤儿 clientId 兜底显示 "Unknown"。
- Filter by customer 用**解析后的 name**（跟现有 `PillFilter: string[]` API 保持一致），代价：rename 后 filter option 列表会自然刷新。

**5. Insights 合并页**（新 [`features/insights/Insights.tsx`](src/features/insights/Insights.tsx)）
- Sidebar 里 Reports + Analytics 两个空占位合并成一个 "Insights"（NavKey `insights` 替换 `reports`/`analytics`），默认落 Analytics tab。
- **Analytics tab**（Manager + Sales 可见）三张图：
  - **FBM 按周/月**（Weekly/Monthly toggle）：从 tag.date 分桶到 ISO 周（Monday）或月，柱状图
  - **按树种销售速度**：分组柱状（Reserved lime + Shipped ink），过滤掉 0 活跃度的树种，按总量降序
  - **Days-in-yard 分布**：Available tag 分 5 桶（0-7/8-30/31-60/61-90/91+），91+ 桶 coral 强调，有 aging tag 时挂 "Aging inventory" 徽章
- **Reports tab**（Manager only；Sales role 下 tab 按钮不渲染 + defense-in-depth useEffect 拨回 Analytics）：**Shortage & Asset by species+grade**，按种/等级聚合 Physical / Reserved / Available FBM + Available Count + Open Demand 标记，**Shortage 判据 = hasOpenDemand ∧ availableFbm === 0**（有活跃需求但零库存），shortage 行置顶 + coral 染色。**CSV 导出**（复用 StockLocator `csvCell` RFC 4180 转义模式，文件名 `timbridge_shortage_report_YYYY-MM-DD_HHMM.csv`）。
- TopBar 面包屑简化：Insights 现在是顶层无 parent。

**🇬🇧 English**

**1. Real Sales Orders module** (new [`features/sales-orders/`](src/features/sales-orders/))
- Replaces the ComingSoon placeholder with a real list page + side-drawer detail (mirrors Stock Locator's drawer + fullscreen pattern). Columns: SO Number / Customer / Status / Line Items / Total / Created, filtered by Status and Customer (reusing `PillFilter`), Pagination applied.
- **Status ladder**: Open → Picked → Shipped is forward-only (Cancelled is a terminal state with no advance button); two-step confirm dialog. **Shipped triggers a cascade**: the SO status update and every linked Reserved tag's status update run in the same event handler — React 18 batches both setStates into one commit so the two stores can't diverge; each tag's history gets `Shipped via {soId}`.
- **Deep-linking wired both ways**: Stock Locator's Linked Transactions SO chip (previously a "coming soon" tooltip) becomes a real click-through that navigates to Sales Orders and opens the drawer. SO detail's Tag ID chips deep-link back to Stock Locator and open the Tag drawer.
- **Shared component extraction**: `SOStatusPill` moves out of Stock Locator into [`components/shared/SOStatusPill.tsx`](src/components/shared/SOStatusPill.tsx) so both features render the same styling.
- Sidebar label: "Sales" → "Sales Order" (NavKey unchanged for routing stability).

**2. Partial-qty Reserve with tag split** (in Available to Sell's Reserve modal)
- Modal gains a Qty number input (default = tag.qty, min 1, max tag.qty) with live hints: "Reserves the whole tag — no split" vs "Splits off a new tag for X pcs; Y remain Available on {id}."
- **Qty < tag.qty triggers a split**: a new tag is created inheriting the original's species/grade/dims/state/milling/supplier/location/parentLog and the full history, with qty = input, fbm recomputed via `calcFbm` (**not `calcBoardFeet` — that would introduce decimal FBM values inconsistent with every other integer-FBM tag in the table**), status = Reserved, `parentTagId` pointing back to the source, history appended with `Split from {id} · Reserved via Available-to-Sell`. The original tag's qty is decremented, fbm recomputed, `splitTagIds` gains the new id, and its history is appended with `Split N pcs into {newId} · ...`. The SO lineItem is created against the new tag.
- New App-level `onCreateTag` callback (`setTags(prev => [...prev, tag])`) — every prior tag mutation was mutate-in-place; this is the first create-new path.
- Stock Locator detail drawer's Traceability section is followed by a new **Tag Lineage** block: Split from / Split into rendered as clickable chips that navigate to the linked tag.

**3. Real Approvals module** (new [`features/approvals/`](src/features/approvals/))
- `lib/types.ts` gains `ApprovalRequest` (id / type: discount|creditTerm|orderCancellation|other / requestedBy / relatedSoId / relatedClientId / details / status: Pending|Approved|Rejected / reviewedBy / reviewNote / createdAt / resolvedAt).
- One `nav === "approvals"` entry, dispatched by role: Sales → [`MyApprovals`](src/features/approvals/MyApprovals.tsx) (own requests across all states), Manager → [`ApprovalQueue`](src/features/approvals/ApprovalQueue.tsx) (Pending-only queue, Approve / Reject with optional reviewNote, two-step confirm).
- **Entry points**: Reserve modal's bottom-left "Need approval? Request one" link (stacks above the modal at higher z-index so the reservation-in-progress is preserved); SO detail header "Request approval" button (auto-prefills related SO). Both open the shared [`RequestApprovalForm`](src/features/approvals/RequestApprovalForm.tsx).
- **Decision notification**: when Manager resolves, the next Sales visit to MyApprovals shows a ConfirmationBanner "1 of your requests has a decision" plus coral border + "NEW DECISION" label on the card. "Got it" or the dismiss X calls a single acknowledge callback that lands in App-level `acknowledgedApprovalIds: Set<string>` (kept separate from the `ApprovalRequest` type to preserve the spec's exact field list). Banner stays gone across nav in-session; the Approved-by-X + reviewNote block remains on the card permanently for record.

**4. Client Profile CRM + `SalesOrder.customer` → `SalesOrder.clientId` FK migration** (new [`features/clients/`](src/features/clients/))
- `Client` type (id / name / contactName? / phone? / email? / address? / notes? / createdAt).
- [`useClients` hook](src/hooks/useClients.tsx) mirrors useLookups's Context+Provider+localStorage pattern (key `timbridge_clients`); `load()` seeds and persists on first miss; exposes `clients` / `clientById` / `getClientName` / `updateClient`.
- **One-time migration**: mock-data.ts gains `INITIAL_CLIENTS` (C-0001 Coastal / C-0002 Fraser / C-0003 Island Pallet), and the salesOrders seed swaps every free-string `customer` for the matching `clientId`.
- Clients list page (search + Pagination + table) + Client detail drawer (View / inline Edit toggle, Linked Sales Orders section with SO count + total revenue + click-to-open-SO chips).
- **Every display site now resolves via useClients**: SalesOrders table / SalesOrderDetail / StockLocator Linked Transactions + Reserved status-confirm dropdown / AvailableToSell Reserve modal SO-picker option label all route through `getClientName(so.clientId)`. SO table and SO detail's customer names are clickable back into Client Profile. Orphan clientIds fall back to "Unknown" so the UI degrades gracefully.
- Filter-by-customer uses **resolved names** (matches the existing `PillFilter: string[]` API); trade-off: renaming a client updates the pill list on next render.

**5. Insights (merged Reports + Analytics)** (new [`features/insights/Insights.tsx`](src/features/insights/Insights.tsx))
- Sidebar collapses the two INSIGHTS placeholders into one "Insights" (NavKey `insights` replaces `reports`/`analytics`), defaulting to the Analytics tab.
- **Analytics tab** (Manager + Sales), three charts:
  - **FBM by week / month** with a Weekly / Monthly toggle: bucketed off `tag.date` by ISO week (Monday) or month.
  - **Species sales velocity**: grouped bars, Reserved (lime) + Shipped (ink) per species, sorted by total, empty-activity species filtered out.
  - **Days-in-yard distribution**: Available tags bucketed into 0–7 / 8–30 / 31–60 / 61–90 / 91+d; the 91+ bucket is coral, and an "Aging inventory" badge appears when it has any tags.
- **Reports tab** (Manager-only; the tab button doesn't render for Sales, and a defense-in-depth useEffect snaps Sales back to Analytics if role toggles mid-view): **Shortage & Asset by species+grade** — aggregated Physical / Reserved / Available FBM + Available Count + Open Demand marker, with the **shortage rule = hasOpenDemand ∧ availableFbm === 0** (active demand but zero quotable inventory). Shortage rows float to the top with coral tinting. **CSV export** reuses StockLocator's `csvCell` RFC 4180 escaper; filename `timbridge_shortage_report_YYYY-MM-DD_HHMM.csv`.
- TopBar breadcrumb simplifies: Insights is now a top-level page with no parent.

**Files / 改动:** new `src/features/sales-orders/`, `src/features/approvals/`, `src/features/clients/`, `src/features/insights/`, `src/hooks/useClients.tsx`, `src/hooks/useApprovalRequests.ts`, `src/components/shared/SOStatusPill.tsx`; `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/TopBar.tsx`, `src/features/available-to-sell/AvailableToSell.tsx`, `src/features/stock-locator/StockLocator.tsx`, `src/lib/mock-data.ts`, `src/lib/types.ts`

---

## 2026-07-20

### 抽取共享 FilterBar 组件 + Available-to-Sell 多选建 Sales Order — Extracted shared FilterBar + multi-select Create Sales Order from Available-to-Sell

**🇨🇳 中文**

**1. FilterBar 组件抽取重构**（新 [`components/shared/FilterBar.tsx`](src/components/shared/FilterBar.tsx)）
- 把 Stock Locator 的筛选条（leader、filter pills、Reset 按钮——含它的位置/样式/空状态行为）抽成独立组件，Available-to-Sell / Sales Orders / Client Profile 三处复用。
- **Stock Locator 视觉零变化**：先抽取重连 Stock Locator、逐项核对 Reset 按钮的 class、点击行为、disabled/隐藏逻辑与重构前完全一致，确认 pixel-parity 之后才动其它三处。
- **Available-to-Sell、Sales Orders 的 Reset 换样式**：原本是纯文字 underline 链接，现在统一成 Stock Locator 那种描边 pill + RotateCcw 图标（这是明确要求的风格统一，不是意外差异）；筛选条也加上了 `<Filter>` icon + "Filter By" 文字 leader。
- **Client Profile 的独立搜索框改用 FilterBar 的 search 插槽**：FilterBar 新增可选 `search` prop（无 pill 时自动隐藏 leader），搜索逻辑本身没有变。
- 右侧的计数文案（"5 tags available" / "4 orders" / "3 clients"）都改成 caller 传入的 `rightSlot`，跟筛选逻辑解耦。

**2. Available-to-Sell 支持多选建 Sales Order**（新 [`CreateSalesOrderPanel.tsx`](src/features/available-to-sell/CreateSalesOrderPanel.tsx) / [`AddToOrderPicker.tsx`](src/features/available-to-sell/AddToOrderPicker.tsx) / [`ClientSelector.tsx`](src/features/available-to-sell/ClientSelector.tsx)）
- 表格加了勾选框（含全选），勾选 1 个以上 tag 后表格上方弹出 action bar：**Create Sales Order** 和 **Add to Existing Order**。
- **Create Sales Order** 打开右侧 slide-in（沿用 Stock Locator DetailDrawer 的位置/宽度/backdrop 规范），面板里：可搜索的 Client 选择器（打字过滤 name/contact/email）、line items 表格（每行 tag 的品种/等级/尺寸/件数/FBM + 可编辑单价 + 算出的小计）、订单总额、**Save as Draft** 和 **Confirm Order** 两个动作。
- **Add to Existing Order** 打开一个 picker，**只列 Draft 状态的 SO**（Open/Picked/Shipped 已经"冻结"，不能再往里加——这是为了不违反"tag 只能在 Confirm 时才转 Reserved"这条护栏）。
- **新增 `SalesOrderStatus` 里的 "Draft"** 状态：Draft 阶段 tag 保持 Available 不动；点 **Confirm Order** 才会把 SO 状态从 Draft/新建直接置为 Open，并在同一次 commit 里把所有关联 tag 批量从 Available 转成 Reserved（history 追加 `Reserved for {soId} via Available-to-Sell`）。**Confirm 前有一道防御性复查**：任何一个 tag 如果在选中之后已经被别的动作抢先 Reserve 了，Confirm 会失败并在面板里高亮报错，不会静默提交一个坏订单。
- `SOStatusPill` 新增 Draft 样式——虚线 sage 边框，和 Open 的实心灰区分开。
- **本批次的一个已知偏离**：按你的要求，Manager 这次也能建单（不是只读），后续如果要收紧回"Manager 只读"，把 action bar 和面板的渲染条件加一个 role 判断即可。

**🇬🇧 English**

**1. Extracted shared FilterBar component** (new [`components/shared/FilterBar.tsx`](src/components/shared/FilterBar.tsx))
- Stock Locator's filter bar (leader, filter pills, Reset button — including position, styling, and empty-state behavior) is now a standalone component reused by Available-to-Sell, Sales Orders, and Client Profile.
- **Stock Locator verified pixel-identical first**: re-wired Stock Locator alone and confirmed the Reset button's class, click behavior, and show/hide logic matched pre-refactor exactly before touching the other three surfaces.
- **Available-to-Sell and Sales Orders pick up the bordered-pill Reset** (previously a plain underlined text link) plus the `<Filter>` icon + "Filter By" leader — an explicit style-unification call, not an accidental drift.
- **Client Profile's standalone search input now uses FilterBar's optional `search` slot** (the "Filter By" leader auto-hides when there are no pill children); the search logic itself is unchanged.
- Right-side counters ("5 tags available" / "4 orders" / "3 clients") move to a caller-supplied `rightSlot`, decoupled from the filter logic.

**2. Available-to-Sell: create a Sales Order from a multi-tag selection** (new [`CreateSalesOrderPanel.tsx`](src/features/available-to-sell/CreateSalesOrderPanel.tsx) / [`AddToOrderPicker.tsx`](src/features/available-to-sell/AddToOrderPicker.tsx) / [`ClientSelector.tsx`](src/features/available-to-sell/ClientSelector.tsx))
- The tag table gains row checkboxes (+ select-all); checking one or more tags surfaces an action bar above the table with **Create Sales Order** and **Add to Existing Order**.
- **Create Sales Order** opens a right-side slide-in (matching Stock Locator's DetailDrawer position/width/backdrop convention) pre-populated with the selected tags: a searchable Client selector (type-filters by name/contact/email), a line-items table (species/grade/dims/pieces/FBM per tag, editable unit price, computed extended price), a running order total, and **Save as Draft** / **Confirm Order**.
- **Add to Existing Order** opens a picker scoped to **Draft orders only** (Open/Picked/Shipped are frozen — adding to them would require reserving tags outside of Confirm, which breaks the guardrail that tags only transition on Confirm).
- **New `"Draft"` value on `SalesOrderStatus`**: while Draft, every linked tag stays Available. Hitting **Confirm Order** sets the SO to Open and, in the same commit, batch-transitions every linked tag Available → Reserved (history: `Reserved for {soId} via Available-to-Sell`). A **defensive re-check on Confirm** catches the case where a selected tag got Reserved by something else in the meantime — it fails inline with the offending rows highlighted instead of silently committing a bad reservation.
- `SOStatusPill` gains a dashed-border Draft style, visually distinct from Open's solid neutral.
- **Known deviation for this batch**: per your instruction, Manager can create orders here too (not read-only) — if that needs tightening back to view-only later, gate the action bar and panel render on `role`.

**Files / 改动:** new `src/components/shared/FilterBar.tsx`, `src/features/available-to-sell/CreateSalesOrderPanel.tsx`, `src/features/available-to-sell/AddToOrderPicker.tsx`, `src/features/available-to-sell/ClientSelector.tsx`; `src/features/stock-locator/StockLocator.tsx`, `src/features/sales-orders/SalesOrders.tsx`, `src/features/clients/Clients.tsx`, `src/features/available-to-sell/AvailableToSell.tsx`, `src/components/shared/SOStatusPill.tsx`, `src/lib/types.ts`, `src/App.tsx`

## 2026-07-20

### `386fd40`..`006b2fd` · 21:44 · Sales Order view/edit + Client Profile module — 销售单查看编辑 + 客户档案模块

**🇨🇳 中文**

**1. Sales Orders 支持查看/编辑已有订单，按状态门控可编辑字段**（合并 [`CreateSalesOrderPanel.tsx`](src/features/available-to-sell/CreateSalesOrderPanel.tsx) + [`SalesOrderDetail.tsx`](src/features/sales-orders/SalesOrderDetail.tsx) 为统一的新 [`SalesOrderPanel.tsx`](src/features/sales-orders/SalesOrderPanel.tsx)）
- 一个面板三种形态：`create`（新建）、`view` 下的 `edit-all`（Draft）、`meta-only`（Open/Picked）、`readonly`（Shipped/Cancelled）。状态判定逻辑集中在新文件 [`permissions.ts`](src/features/sales-orders/permissions.ts) 的单一函数 `getSalesOrderEditMode()`，面板顶部只算一次，不再散落在各字段里判断。
- **Draft**：customer、line items（增删 tag、改数量/单价/折扣）、notes、预计发货日期全部可编辑；面板内直接 **Confirm Order**（Draft → Open，批量把关联 tag 转 Reserved，带防御性复查）。
- **Open / Picked**：仅 notes + 预计发货日期可改；customer 和 line items 显示虚线锁定框，hover 提示"Cancel the reservation to modify line items."——按设计不做"静默改单"，要改 line items 必须先取消预约。
- **Shipped / Cancelled**：整个面板只读，不渲染任何编辑控件。
- `SalesOrder` 模型新增 `notes`、`expectedShipDate`；`SalesOrderLineItem` 新增可选 `discountPct`。

**2. 新增 Client Profile 客户档案模块**（新 [`ClientCreate.tsx`](src/features/clients/ClientCreate.tsx)）
- **New Client** 按钮打开右侧 slide-in 创建表单——沿用 ClientDetail/Stock Locator 同款面板外壳（backdrop、宽度、关闭动画完全一致，不是新造的面板模式）；字段：客户名、联系人、电话、邮箱、片区（territory）、付款条款、备注。
- `useClients` 新增 `createClient()`，自动分配下一个 `C-####` id 并写入 localStorage；创建成功后自动跳转打开新客户的详情面板。
- 列表新增 **Territory**（片区）筛选 pill（复用 FilterBar）、**Open Orders**（Draft/Open/Picked 计数，Shipped/Cancelled 不算）、**Last Activity**（最近一次 SO 日期，无订单则回退到建档时间）列。
- 详情面板 view/edit 模式都加上 Territory + Payment Terms 展示与编辑。
- **验收要点**：面板是 fixed 定位的浮层，列表 DOM 全程留在原地——打开客户详情再关闭，滚动位置和已生效的筛选/搜索条件原样保留，全程没有一次页面跳转。

**🇬🇧 English**

**1. Sales Orders: view/edit existing orders, editability gated by status** (merged [`CreateSalesOrderPanel.tsx`](src/features/available-to-sell/CreateSalesOrderPanel.tsx) + [`SalesOrderDetail.tsx`](src/features/sales-orders/SalesOrderDetail.tsx) into a single new [`SalesOrderPanel.tsx`](src/features/sales-orders/SalesOrderPanel.tsx))
- One panel, three faces: `create`, `view` with `edit-all` (Draft), `meta-only` (Open/Picked), `readonly` (Shipped/Cancelled). The status → editability mapping lives in one place, a new `getSalesOrderEditMode()` in [`permissions.ts`](src/features/sales-orders/permissions.ts) — the panel derives it once at the top instead of checking status per field.
- **Draft**: customer, line items (add/remove tags, edit qty/unit price/discount), notes, and expected ship date are all editable; **Confirm Order** is available right from the panel (Draft → Open, batch-reserves linked tags with the same defensive re-check used elsewhere).
- **Open / Picked**: only notes + expected ship date are editable; customer and line items render inside a dashed lock border with a hover tooltip — "Cancel the reservation to modify line items." No silent line-item edits on a reserved order by design.
- **Shipped / Cancelled**: fully read-only, no edit controls render at all.
- `SalesOrder` gains `notes` and `expectedShipDate`; `SalesOrderLineItem` gains optional `discountPct`.

**2. New Client Profile module** (new [`ClientCreate.tsx`](src/features/clients/ClientCreate.tsx))
- **New Client** button opens a right-side slide-in creation form, reusing the same panel shell as ClientDetail/Stock Locator (identical backdrop, width, close animation — not a new panel pattern). Fields: name, contact, phone, email, territory, payment terms, notes.
- `useClients` gains `createClient()`, which mints the next `C-####` id and persists to localStorage; on success the new client's detail panel opens automatically.
- The list gains a **Territory** pill filter (via the shared FilterBar), an **Open Orders** count (Draft/Open/Picked only — Shipped/Cancelled don't count), and a **Last Activity** column (latest linked SO date, falling back to the client's created date).
- Both view and edit modes on the detail panel now surface Territory + Payment Terms.
- **Acceptance verified**: the panel is a fixed-position overlay, so the list underneath stays mounted the whole time — opening a client's detail and closing it restores the exact scroll position and active filters/search, with zero page navigation.

**Files / 改动:** new `src/features/sales-orders/SalesOrderPanel.tsx`, `src/features/sales-orders/permissions.ts`, `src/features/clients/ClientCreate.tsx`; deleted `src/features/available-to-sell/CreateSalesOrderPanel.tsx`, `src/features/sales-orders/SalesOrderDetail.tsx`; modified `src/App.tsx`, `src/features/available-to-sell/AvailableToSell.tsx`, `src/features/sales-orders/SalesOrders.tsx`, `src/features/clients/Clients.tsx`, `src/features/clients/ClientDetail.tsx`, `src/hooks/useClients.tsx`, `src/lib/types.ts`, `src/lib/mock-data.ts`

## 2026-07-21

### `632a6d6` · 11:02 · Approval Queue discount pricing + accordion review + Sales quick-entry — 审批队列折扣算价 + 手风琴式审批 + 销售快速发起

**🇨🇳 中文**

**1. 折扣类审批请求自动算价**（新 [`lib/pricing.ts`](src/lib/pricing.ts)）
- `ApprovalRequest` 新增可选 `discountRate`（0–100）。折扣请求现在关联一个真实 Sales Order（`relatedSoId`）+ 一个数值折扣率，不再是纯自由文本。
- 新增共享公式 `calcExtendedPrice(qty, unitPrice, discountPct?)`，从 Sales Order line items 原有的私有 `lineExtended` 里抽出来——两处（Sales Order 明细价、审批算价）现在共用同一套价格公式，不是两份。
- Approval Queue 对折扣类请求实时展示「原价 × 折扣率 = 折后价」，折扣率变了就跟着重算，不需要手动算。

**2. Manager 的 Approval Queue 改成手风琴式行内展开**（重写 [`ApprovalQueue.tsx`](src/features/approvals/ApprovalQueue.tsx)）
- 点一行请求，行内直接展开：客户、关联 line items、折扣算价、申请人备注全部原地显示；Approve / Reject + 可选审核备注也挪到展开区里——不再跳到 Sales Order 页面，也不再弹一个脱离上下文的二次确认框。
- 同一时间只能展开一行，展开新的自动收起旧的。
- 展开区里加了「View full order」链接，需要看完整订单时把已有的 Sales Order 面板当本地浮层直接打开（不换页），关掉就精确回到刚才展开的审批行。
- Approve/Reject 后该行立刻从队列里消失（因为队列只显示 Pending），配一个右下角 toast 确认操作已生效——全程停留在 Approval Queue，不发生任何页面跳转。

**3. Sales 侧新增「Request Discount」快速发起入口**（新 [`RequestDiscountForm.tsx`](src/features/approvals/RequestDiscountForm.tsx)）
- My Approval Requests 页顶部新按钮，打开一个小表单：可搜索的 Open 订单选择器（仿 ClientSelector 的输入即筛选交互）、折扣率、必填理由，实时预览「原价 × 折扣率 = 折后价」。
- 提交后直接写入跟 Approval Queue 读的同一个 `ApprovalRequest` store，Manager 那边立刻能看到，全程不需要先打开 Sales Order 手动改价。

**🇬🇧 English**

**1. Auto-calculated pricing for discount requests** (new [`lib/pricing.ts`](src/lib/pricing.ts))
- `ApprovalRequest` gains an optional `discountRate` (0–100). Discount requests now tie to a real Sales Order (`relatedSoId`) plus a numeric rate, instead of being pure free text.
- New shared `calcExtendedPrice(qty, unitPrice, discountPct?)`, extracted from Sales Order line items' previously-private `lineExtended` — one pricing formula shared by both Sales Order pricing and the Approval Queue's calc, not two.
- The Approval Queue shows Original × Discount = Discounted Price live for discount-type requests, recalculating immediately if the rate changes.

**2. Manager's Approval Queue rebuilt as an inline accordion** (rewrote [`ApprovalQueue.tsx`](src/features/approvals/ApprovalQueue.tsx))
- Clicking a request expands it in place: customer, related line items, the discount calc, and the requester's note render inline; Approve/Reject plus an optional reviewer note moved into that same expanded panel — no more jumping to Sales Order or a disconnected confirm modal.
- Only one row expands at a time; opening another collapses the current one.
- A "View full order" link inside the expanded panel opens the existing Sales Order panel as a local overlay (not a nav change) when more context is needed; closing it returns to the exact same expanded queue row.
- Approve/Reject removes the row immediately (the queue only lists Pending) with a bottom-right toast confirming the action — the whole flow never leaves the Approval Queue.

**3. Sales-side "Request Discount" quick-entry form** (new [`RequestDiscountForm.tsx`](src/features/approvals/RequestDiscountForm.tsx))
- New button on My Approval Requests opens a small form: a searchable Open-order picker (modeled on ClientSelector's type-to-filter pattern), a discount rate field, and a required reason, with the same live Original × Rate = Discounted preview.
- Submitting writes straight into the same `ApprovalRequest` store the queue already reads — Manager sees it immediately, with no detour through Sales Order to hand-edit a price field first.

**Files / 改动:** new `src/lib/pricing.ts`, `src/features/approvals/RequestDiscountForm.tsx`; modified `src/App.tsx`, `src/features/approvals/ApprovalQueue.tsx`, `src/features/approvals/MyApprovals.tsx`, `src/features/approvals/RequestApprovalForm.tsx`, `src/features/sales-orders/SalesOrderPanel.tsx`, `src/hooks/useApprovalRequests.ts`, `src/lib/mock-data.ts`, `src/lib/types.ts`

## 2026-07-21

### `d48ed0b` · 22:50 · 审批 UX 精修 + Sales 只读订单视图 + 审批搜索 + Insights→Pulse 改名 — Approval UX refinements + read-only Sales order view + approval search + Insights→Pulse rename

**🇨🇳 中文**

**1. 审批交互精修**
- **Request Discount 按钮去掉图标**；折扣申请表单的 **Reason 改成选填**（不写也能提交，空备注在卡片里显示灰色斜体 "No note provided"）。
- **SalesOrderPanel 全屏从"整屏奶油底铺满"改成半透明暗底 lightbox**（对齐 Stock Locator）——全屏时背后的列表/审批队列还看得见（变暗），不再像是跳到一个空白新页面。
- **右侧详情面板 header 拆成两行**（SalesOrderPanel、ClientDetail、Stock Locator 标签抽屉）：第一行放标识符（SO 号 / 标签号 / 客户号）+ 状态，第二行放功能按钮——解决按钮多时关闭(X)按钮被挤出面板边界的问题。
- **Sales 的 MyApprovals 重写成手风琴式**（对齐 Manager 队列）：展开显示客户、line items、原价 × 折扣率 = 折后价。Pending 折扣申请新增 **Edit 编辑**（App 新增 `handleUpdateApproval`，改完仍是 Pending、id 不变，Manager 侧同步更新）。**"View full order" 打开的是只读版 SalesOrderPanel**（新增 `readOnly` prop）——纯浮层、不跳转、内部客户/标签也不再是可点链接，Sales 全程不离开审批界面。
- 把 `DiscountCalc` / `LineItemsList` 抽到共享的 [`discountParts.tsx`](src/features/approvals/discountParts.tsx)，Manager 和 Sales 两侧共用。

**2. 审批搜索**
- Manager 和 Sales 的审批界面都加了搜索框（复用共享 [`FilterBar`](src/components/shared/FilterBar.tsx)），可按**审批号 / SO 号 / 客户名**过滤，带实时命中计数和"无匹配"空态。共享匹配函数 `matchesApprovalSearch`，两侧行为一致。

**3. Insights → Pulse 改名**
- 合并后的 Reports + Analytics 模块从 **"Insights" 改名为 "Pulse"**（侧边栏项、页面标题、breadcrumb、组件名、nav 路由 key `insights`→`pulse`），避免与侧边栏分类 "INSIGHTS" 撞名。**分类标签 "INSIGHTS" 保留不动**（撞名问题靠改页面名已解决）。文件 `features/insights/Insights.tsx` → `features/pulse/Pulse.tsx`（git rename，保留历史）。

**🇬🇧 English**

**1. Approval UX refinements**
- **Request Discount button drops its icon**; the discount form's **Reason is now optional** (submittable when blank; empty notes render a muted italic "No note provided" on the card).
- **SalesOrderPanel fullscreen switches from an opaque cream takeover to a dim-backdrop lightbox** (matching Stock Locator) — the list/queue behind stays visible (dimmed) instead of reading as a blank new page.
- **Right-side detail-panel headers split into two rows** (SalesOrderPanel, ClientDetail, Stock Locator tag drawer): identifier (SO / tag / client id) + status on top, action buttons below — so the close (X) no longer overflows the panel edge on crowded headers.
- **Sales' MyApprovals rebuilt as an accordion** mirroring the Manager queue: expands to show customer, line items, and Original × Discount = Discounted price. Pending discount requests gain an **Edit** action (new `handleUpdateApproval`; stays Pending, same id, Manager sees the update). **"View full order" opens a read-only SalesOrderPanel** (new `readOnly` prop) — a pure overlay, no navigation, with its internal customer/tag links suppressed, so Sales never leaves the approval view.
- Extracted `DiscountCalc` / `LineItemsList` into shared [`discountParts.tsx`](src/features/approvals/discountParts.tsx), used by both queues.

**2. Approval search**
- Both the Manager and Sales approval views gain a search box (reusing the shared [`FilterBar`](src/components/shared/FilterBar.tsx)) matching **approval # / SO # / client name**, with a live match count and a no-match empty state. Shared `matchesApprovalSearch` keeps both sides identical.

**3. Insights → Pulse rename**
- The merged Reports + Analytics module is renamed from **"Insights" to "Pulse"** (sidebar label, page title, breadcrumb, component name, nav route key `insights`→`pulse`) so it no longer collides with the sidebar's **INSIGHTS** category. The **category header "INSIGHTS" is left unchanged** (renaming the page resolves the collision). File `features/insights/Insights.tsx` → `features/pulse/Pulse.tsx` (git rename, history preserved).

**Files / 改动:** new `src/features/approvals/discountParts.tsx`; renamed `src/features/insights/Insights.tsx` → `src/features/pulse/Pulse.tsx`; modified `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/TopBar.tsx`, `src/features/approvals/ApprovalQueue.tsx`, `src/features/approvals/MyApprovals.tsx`, `src/features/approvals/RequestDiscountForm.tsx`, `src/features/sales-orders/SalesOrderPanel.tsx`, `src/features/clients/ClientDetail.tsx`, `src/features/stock-locator/StockLocator.tsx`

---
## 2026-07-23

### `8d415d8` · 19:52 · Sales order flow — 重构预留流程 / 仅销售可下单 / 客户档案建单 / 订单 UX 批量优化

**🇨🇳 中文**

**1. 预留流程整合 + 审批绑定订单**
- 移除 Available-to-Sell 里每行的「Reserve」弹窗；所有预留（单个或批量）统一走 **勾选 + 操作栏**（Create Sales Order / Add to Existing Order）。
- 把「部分数量拆分」抽成唯一的共享 helper（[`src/lib/reserveSplit.ts`](src/lib/reserveSplit.ts)），在 App 的两条 confirm 路径里调用：当下单数量 < 标签数量时，拆出一张 Reserved 子标签（`calcFbm` / `parentTagId` / `splitTagIds` / 历史），逻辑不再重复两份。
- **RequestApprovalForm 现在强制绑定一个真实 SO**（`prefillSoId` → 必填 `relatedSoId`）；申请审批只能从 SO 面板头部按钮和「Request Discount」两处发起，清掉所有指向已删除 Reserve 弹窗的死引用（文案 + 注释）。

**2. 下单权限：仅 Sales**
- 建单是 Sales 的动作：Available-to-Sell 的勾选框/操作栏、Client Profile 的「New Sales Order」按钮都用 `role === "sales"` 门控，并加中途切换角色的 teardown effect（沿用 Settings 仅 Manager 的防御式写法）。

**3. Client Profile**
- 新增 **「New Sales Order」**（仅 Sales）：打开 create 模式的 SalesOrderPanel，客户**预填且锁定**（新 `lockedClientId` 属性），复用面板自带的 TagPicker 选标签。
- 修复客户全屏从「不透明整屏接管」改为 **暗底 lightbox**（与 Stock Locator 一致），列表仍在背后可见，不再像空白新页。
- 修复跨设备客户数据不一致的 bug：localStorage key 加版本（`timbridge_clients` → `_v2`），旧设备重新按当前 `INITIAL_CLIENTS` 播种（territory/contact 恢复）。
- **去掉 Territory 筛选，只保留搜索**。

**4. 订单 UX**
- Create 面板从右侧抽屉改为**居中展开的 lightbox**（所有入口一致）。
- 修好 create 模式下「预计发货日期 / 备注」两个字段（原来是空操作，点了没反应），并写入订单。
- Confirm 后新增 **成功页**（仿 Delivery Slips）：查看本单 / 查看全部订单 / 再建一单。
- Sales 在建单时填了折扣，Confirm 后**自动生成一条绑定该 SO 的 Pending 折扣审批**（含混合折扣率 + 逐行明细）。
- Sales Orders：加**全文搜索**（SO# / 客户 / 状态，Manager 与 Sales 都可用）；表头**改成和 Stock Locator 一致**（搜索 + 导出在上，筛选在下）；**多选导出 PDF**（改用隐藏 iframe 打印，避免被浏览器拦截的弹窗）；加宽被截断的 Qty 输入框。

**🇬🇧 English**

**1. Reservation flow consolidation + SO-scoped approvals**
- Removed the per-row Reserve modal in Available-to-Sell; every reservation (single or multi) now routes through the **checkbox + action bar** (Create Sales Order / Add to Existing Order).
- Extracted the partial-qty split into one shared helper ([`src/lib/reserveSplit.ts`](src/lib/reserveSplit.ts)) called from both confirm paths in App: Qty < tag.qty spawns a Reserved child (`calcFbm` / `parentTagId` / `splitTagIds` / history) with no duplicated logic.
- **RequestApprovalForm now always requires a real SO** (`prefillSoId` → required `relatedSoId`); approvals are reachable only from the SO panel header + Request Discount. Removed stale Reserve-modal references (copy + comments).

**2. Order creation is Sales-only**
- Gated the Available-to-Sell checkboxes/action bar and Client Profile's "New Sales Order" behind `role === "sales"`, with a mid-session teardown effect (mirrors the Manager-only Settings guard).

**3. Client Profile**
- Added **"New Sales Order"** (Sales-only): opens SalesOrderPanel create mode with the customer **pre-filled + locked** (new `lockedClientId` prop); reuses the built-in TagPicker.
- Fixed the client fullscreen to a **dim lightbox** (matching Stock Locator) instead of an opaque takeover.
- Fixed the stale-client localStorage bug by versioning the store key (`timbridge_clients` → `_v2`) so devices re-seed the current `INITIAL_CLIENTS`.
- **Removed the Territory filter; search only.**

**4. Order UX**
- The create panel opens as a centered expanded lightbox from every entry point.
- Wired the expected-ship-date and notes fields (were no-ops) and persist them onto the order.
- Post-confirm **success screen** (like Delivery Slips) with view-order / view-all / create-another.
- Sales-entered discounts **auto-create a Pending discount approval** linked to the SO (blended rate + per-line detail).
- Sales Orders: free-text **search** (SO# / client / status; both roles); header **restructured to match Stock Locator** (search + Export on top, filters below); multi-select **Export PDF** via a hidden iframe (no blocked pop-up); widened the cramped Qty input.

**Files / 改动:** new `src/lib/reserveSplit.ts`; modified `src/App.tsx`, `src/features/available-to-sell/AvailableToSell.tsx`, `src/features/sales-orders/SalesOrderPanel.tsx`, `src/features/sales-orders/SalesOrders.tsx`, `src/features/clients/Clients.tsx`, `src/features/clients/ClientDetail.tsx`, `src/features/approvals/RequestApprovalForm.tsx`, `src/features/approvals/MyApprovals.tsx`, `src/hooks/useClients.tsx`, `src/hooks/useApprovalRequests.ts`, `src/lib/types.ts`

---
## Pending / 未来 (not yet built — 尚未开始)

- **Approvals 里 Sales 视图看到的历史范围**（当前 MyApprovals 显示所有状态，Manager 只看 Pending；如果 Manager 需要审批历史查阅，加个 History tab）
- **Client 的 delete**（create/edit 都已支持；delete 尚未建）
- **Client Profile 的 Linked Sales Orders 之外的 CRM 活动记录**（通话/拜访/会议日志——按当前批次要求是 backlog，不在这一轮）
- **Shipping/Trucking、Invoicing 实际功能**（目前只是导航占位，功能待建）
- **Delivery Slip 持久化与列表视图**（送货单解析结果当前只在会话内存里；持久化 + Recent 下拉追踪 + 列表视图都还没建）
- **`daysInYard` helper 公共抽取到 `lib/history.ts`**（当前 AvailableToSell 和 Insights 各一份，第三个 caller 出现时升级）
