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

## Pending / 未来 (not yet built — 尚未开始)

- **Available-to-Sell**（销售视图；`salesOrders` Mock 数据已就绪）
- **Reports & Saved Views**（报表与保存视图）
- **Role-based permission matrix**（按角色启用权限矩阵，含 Sales 角色 + Floor 只显示 Tag Entry/Stock Locator）
- **Tag lifecycle wiring**（生命周期状态流转：Floor 确认 Pending→Received→Available；销售单关联 Available→Reserved 等）
- **Delivery Slip detail view**（送货单详情页 — 之后 Recent 下拉即可追踪 `slip` 记录）
