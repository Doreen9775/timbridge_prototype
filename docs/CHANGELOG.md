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
## Pending / 未来 (not yet built — 尚未开始)

- **Reports & Saved Views**（报表与保存视图）
- **Sales role UI entry point**（`Role` 类型已含 sales，但仍无角色切换入口；权限矩阵已按角色生效）
- **Delivery Slip 持久化与列表视图**（送货单解析结果当前只在会话内存里；持久化 + Recent 下拉追踪 + 列表视图都还没建）
