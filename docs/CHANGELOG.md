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

### `2026-06-22` · Selection-based CSV export — 勾选式导出

**🇨🇳 中文** — Stock Locator 表格每行前新增**复选框**（含表头**全选/半选**状态）。导出行为改为**只导出勾选的标签**：未勾选任何行时「Export CSV」按钮**置灰不可用**；勾选 ≥1 行后按钮变**实心 coral 可点**并显示**已选数量**（如 `Export CSV (3)`）。用颜色清晰区分可交互状态；点复选框**不会**打开详情抽屉（行点击仍正常打开）。与筛选无关——无论是否有筛选，都需先勾选才能导出。（此举改变了 Prompt 2「导出全部筛选结果」的旧行为。）

**🇬🇧 English** — Added a **checkbox** to every Stock Locator row (plus a header **select-all / indeterminate**). Export now exports **only the checked tags**: the "Export CSV" button is **disabled/grey** with nothing selected, and becomes **solid coral** with a **count** (`Export CSV (3)`) once ≥1 is checked. Clear color states for enabled/disabled; checkbox clicks don't open the drawer (row click still does). Filter-independent — selection is always required. (Supersedes Prompt 2's "export all filtered" behavior.)

**Files / 改动:** `StockLocator.tsx`

---

## Pending / 未来 (not yet built — 尚未开始)

- **Available-to-Sell**（销售视图；`salesOrders` Mock 数据已就绪）
- **Reports & Saved Views**（报表与保存视图）
- **Role-based permission matrix**（按角色启用权限矩阵，含 Sales 角色 + Floor 只显示 Tag Entry/Stock Locator）
- **Tag lifecycle wiring**（生命周期状态流转：Floor 确认 Pending→Received→Available；销售单关联 Available→Reserved 等）
- **Delivery Slip detail view**（送货单详情页 — 之后 Recent 下拉即可追踪 `slip` 记录）
