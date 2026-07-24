import { useCallback, useEffect, useState } from "react";
import { Sidebar, type NavKey } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { FloorBanner } from "@/components/layout/FloorBanner";
import { ComingSoon } from "@/components/shared/ComingSoon";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { StockLocator } from "@/features/stock-locator/StockLocator";
import { TagEntry } from "@/features/tag-entry/TagEntry";
import { DeliverySlips } from "@/features/delivery-slips/DeliverySlips";
import { LoginPage } from "@/features/auth/LoginPage";
import { CustomValuesSettings } from "@/features/settings/CustomValuesSettings";
import { AvailableToSell } from "@/features/available-to-sell/AvailableToSell";
import { SalesOrders } from "@/features/sales-orders/SalesOrders";
import { MyApprovals } from "@/features/approvals/MyApprovals";
import { ApprovalQueue } from "@/features/approvals/ApprovalQueue";
import { Clients } from "@/features/clients/Clients";
import { Pulse } from "@/features/pulse/Pulse";
import { RecentRecordsProvider } from "@/hooks/useRecentRecords";
import { LookupsProvider } from "@/hooks/useLookups";
import { ClientsProvider } from "@/hooks/useClients";
import type { ApprovalRequest, ApprovalRequestType, EntryFilter, RecentRecord, SalesOrder, SalesOrderStatus, Tag } from "@/lib/types";
import { useRole } from "@/hooks/useRole";
import { useTags } from "@/hooks/useTags";
import { useSalesOrders } from "@/hooks/useSalesOrders";
import { useApprovalRequests } from "@/hooks/useApprovalRequests";
import { reserveLineItems } from "@/lib/reserveSplit";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS_SHORT[d.getMonth()]} ${p(d.getDate())} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function identityFor(role: "manager" | "sales" | "floor"): string {
  return role === "sales" ? "Sales" : role === "manager" ? "Manager" : "Floor";
}

export default function App() {
  const [nav, setNav] = useState<NavKey>("dashboard");
  // Bumped when the user re-clicks the sidebar item they're already on — used as
  // the feature container's React key, so a same-page click remounts the feature
  // and returns it to its initial screen (wizard step 1, cleared filters, etc.).
  const [navEpoch, setNavEpoch] = useState(0);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [pendingSoId, setPendingSoId] = useState<string | null>(null);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [entryFilter, setEntryFilter] = useState<EntryFilter | null>(null);
  const [authed, setAuthed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { role, isFloor, setRole } = useRole();
  const { tags, setTags } = useTags();
  const { salesOrders, setSalesOrders } = useSalesOrders();
  const { approvalRequests, setApprovalRequests } = useApprovalRequests();
  // Submitter-side "already seen this resolution" tracker — parallel to the
  // request store so the ApprovalRequest type stays exactly as spec'd.
  const [acknowledgedApprovalIds, setAcknowledgedApprovalIds] = useState<Set<string>>(() => new Set());

  // Settings (Custom Values) is Manager-only — redirect away if role changes while on it
  // (e.g. switching to Floor View) or if it's somehow reached otherwise.
  useEffect(() => {
    if (nav === "settings" && role !== "manager") setNav("dashboard");
  }, [nav, role]);

  // Available to Sell, Sales Orders, Approvals, Client Profile and Pulse are
  // Manager + Sales only; bounce Floor to Stock Locator (sidebar hides them for
  // Floor; this is defense-in-depth).
  useEffect(() => {
    if ((nav === "avail" || nav === "sales" || nav === "approvals" || nav === "clientprofile" || nav === "pulse") && role === "floor") setNav("locator");
  }, [nav, role]);

  // Sidebar click: navigate, or — already on that item — reset the feature to its
  // initial screen by bumping the remount epoch.
  const handleNav = useCallback((key: NavKey) => {
    setNav((current) => {
      if (current === key) setNavEpoch((e) => e + 1);
      return key;
    });
  }, []);

  // Every sign-in lands on the Dashboard, regardless of where the last session left off.
  const handleSignIn = useCallback(() => {
    setNav("dashboard");
    setAuthed(true);
  }, []);

  // Fade the app out before returning to the login page (mirrors the sign-in transition).
  const handleLogout = useCallback(() => {
    setLoggingOut(true);
    window.setTimeout(() => {
      setAuthed(false);
      setLoggingOut(false);
    }, 500);
  }, []);

  // Open a record from the Recent dropdown: tags open in Stock Locator's detail drawer.
  const handleOpenRecord = useCallback((r: RecentRecord) => {
    if (r.type === "tag") {
      setNav("locator");
      setPendingTagId(r.id);
    }
  }, []);
  const handleTagOpened = useCallback(() => setPendingTagId(null), []);

  // Persist an edited tag back into the shared Tag table (Stock Locator detail panel).
  const handleUpdateTag = useCallback((updated: Tag) => {
    setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, [setTags]);

  // Manager-only destructive drop from the Tag table (Stock Locator). Callers pre-filter
  // SO-linked tags — this just removes what's handed in, no cascade.
  const handleDeleteTags = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setTags((prev) => prev.filter((t) => !idSet.has(t.id)));
  }, [setTags]);

  // Available → Reserved is a side-effect of linking a tag to a Sales Order (Manager status
  // dropdown), not a direct manual status edit — this appends the real lineItem.
  const handleLinkSalesOrder = useCallback((soId: string, tagId: string, qty: number, unitPrice: number) => {
    setSalesOrders((prev) =>
      prev.map((so) => (so.id === soId ? { ...so, lineItems: [...so.lineItems, { tagId, qty, unitPrice }] } : so)),
    );
  }, [setSalesOrders]);

  // Multi-tag SO creation from Available-to-Sell. `confirm=false` saves as Draft
  // (tags stay Available); `confirm=true` creates an Open SO and batch-transitions
  // every linked tag Available → Reserved in the same commit. Returns the created
  // SO id on success, or a list of tag ids that were no longer Available on failure.
  const handleCreateSalesOrder = useCallback(
    (
      clientId: string,
      lineItems: { tagId: string; qty: number; unitPrice: number; discountPct?: number }[],
      confirm: boolean,
      meta?: { notes?: string; expectedShipDate?: string },
    ): { ok: true; soId: string } | { ok: false; unavailableIds: string[] } => {
      if (confirm) {
        // Defensive check: every referenced tag must still be Available at commit time.
        const tagById = new Map(tags.map((t) => [t.id, t]));
        const unavailable = lineItems
          .filter((li) => tagById.get(li.tagId)?.status !== "Available")
          .map((li) => li.tagId);
        if (unavailable.length > 0) return { ok: false, unavailableIds: unavailable };
      }

      const newId = `SO-${String(salesOrders.length + 42).padStart(4, "0")}`;
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // On Confirm, reserve every line through the shared helper: whole-tag lines flip
      // Available → Reserved, partial-qty lines split off a Reserved child and get
      // rewritten to point at it. On Save-as-Draft, tags stay Available and the lines
      // are stored as-is (the split happens later, at Draft → Open confirm).
      let soLineItems = lineItems;
      if (confirm) {
        const { tags: nextTags, lineItems: reservedLines } = reserveLineItems(tags, lineItems, {
          soId: newId,
          worker: identityFor(role),
          stamp: nowStamp(),
          via: "Available-to-Sell",
        });
        soLineItems = reservedLines;
        setTags(nextTags);
      }

      const newSo: SalesOrder = {
        id: newId,
        clientId,
        status: confirm ? "Open" : "Draft",
        date: iso,
        lineItems: soLineItems,
        notes: meta?.notes,
        expectedShipDate: meta?.expectedShipDate,
      };
      setSalesOrders((prev) => [...prev, newSo]);

      // Sales-entered discounts on a confirmed order auto-generate a Pending discount
      // approval request tied to the new SO, so a Manager sees it in the Approval Queue.
      if (confirm) {
        const discounted = soLineItems.filter((li) => (li.discountPct ?? 0) > 0);
        if (discounted.length > 0) {
          const listTotal = soLineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
          const netTotal = soLineItems.reduce((s, li) => s + li.qty * li.unitPrice * (1 - (li.discountPct ?? 0) / 100), 0);
          const blended = listTotal > 0 ? Math.round((1 - netTotal / listTotal) * 100) : 0;
          const linesText = discounted
            .map((li) => `${li.tagId}: ${li.discountPct}% off (${li.qty} pcs @ $${li.unitPrice.toFixed(2)})`)
            .join("; ");
          const details = `Auto-generated from ${newId}. Discounted lines — ${linesText}. Blended discount ${blended}%.`;
          const stamp = nowStamp();
          const requestedBy = identityFor(role);
          setApprovalRequests((prev) => [
            ...prev,
            {
              id: `AR-2026-${String(prev.length + 1).padStart(4, "0")}`,
              type: "discount",
              requestedBy,
              relatedSoId: newId,
              discountRate: blended,
              details,
              status: "Pending",
              createdAt: stamp,
            },
          ]);
        }
      }

      return { ok: true, soId: newId };
    },
    [tags, salesOrders.length, role, setSalesOrders, setTags, setApprovalRequests],
  );

  // Persist an edited Sales Order back into the store. The panel enforces which
  // fields it's allowed to touch based on status (see permissions.ts); this handler
  // is dumb — it just writes whatever the panel hands back. Tags aren't touched
  // here because line-item edits are only permitted on Draft (tags stay Available).
  const handleUpdateSalesOrder = useCallback((updated: SalesOrder) => {
    setSalesOrders((prev) => prev.map((so) => (so.id === updated.id ? updated : so)));
  }, [setSalesOrders]);

  // Draft → Open transition from the Sales Order view panel. Same double-book
  // check + Available→Reserved batch cascade as handleCreateSalesOrder — but
  // against an existing SO id rather than minting a new one.
  const handleConfirmDraftOrder = useCallback(
    (
      soId: string,
      lineItems: { tagId: string; qty: number; unitPrice: number; discountPct?: number }[],
    ): { ok: true } | { ok: false; unavailableIds: string[] } => {
      const tagById = new Map(tags.map((t) => [t.id, t]));
      const unavailable = lineItems
        .filter((li) => tagById.get(li.tagId)?.status !== "Available")
        .map((li) => li.tagId);
      if (unavailable.length > 0) return { ok: false, unavailableIds: unavailable };

      // Reserve through the shared helper so partial-qty lines split a Reserved child
      // off their Available parent (same rule as Create-and-Confirm), then persist the
      // rewritten line items on the now-Open order.
      const { tags: nextTags, lineItems: reservedLines } = reserveLineItems(tags, lineItems, {
        soId,
        worker: identityFor(role),
        stamp: nowStamp(),
        via: "Sales Orders",
      });
      setSalesOrders((prev) =>
        prev.map((so) => (so.id === soId ? { ...so, status: "Open", lineItems: reservedLines } : so)),
      );
      setTags(nextTags);
      return { ok: true };
    },
    [tags, role, setSalesOrders, setTags],
  );

  // Append multiple line items to an existing Draft SO (Open/Picked/Shipped SOs
  // are frozen per the guardrail — tags only transition on Confirm). Draft target
  // means tags stay Available; the caller (AddToOrderPicker) filters to Draft-only.
  const handleAppendToDraftOrder = useCallback(
    (soId: string, lineItems: { tagId: string; qty: number; unitPrice: number }[]) => {
      setSalesOrders((prev) =>
        prev.map((so) =>
          so.id === soId && so.status === "Draft"
            ? { ...so, lineItems: [...so.lineItems, ...lineItems] }
            : so,
        ),
      );
    },
    [setSalesOrders],
  );

  // Forward-only SO status transition (Open→Picked→Shipped). Shipped cascades every
  // linked Reserved tag to Shipped in the same commit so the two stores can't diverge.
  const handleAdvanceSoStatus = useCallback((soId: string, next: SalesOrderStatus) => {
    let cascadeTagIds: string[] = [];
    setSalesOrders((prev) =>
      prev.map((so) => {
        if (so.id !== soId) return so;
        if (next === "Shipped") cascadeTagIds = so.lineItems.map((li) => li.tagId);
        return { ...so, status: next };
      }),
    );
    if (next === "Shipped" && cascadeTagIds.length > 0) {
      const now = new Date();
      const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const p = (n: number) => String(n).padStart(2, "0");
      const stamp = `${MONTHS_SHORT[now.getMonth()]} ${p(now.getDate())} ${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
      const idSet = new Set(cascadeTagIds);
      setTags((prev) =>
        prev.map((t) =>
          idSet.has(t.id) && t.status === "Reserved"
            ? {
                ...t,
                status: "Shipped",
                updated: "just now",
                history: [...t.history, { e: `Shipped via ${soId}`, t: stamp, w: "System" }],
              }
            : t,
        ),
      );
    }
  }, [setSalesOrders, setTags]);

  // Deep-link: Stock Locator's Linked Transactions SO chip → Sales Orders + open drawer.
  const handleOpenSoFromLocator = useCallback((soId: string) => {
    setNav("sales");
    setPendingSoId(soId);
  }, []);
  const handleSoOpened = useCallback(() => setPendingSoId(null), []);

  // Post-confirm success screen (Create Sales Order) → Sales Orders surface, optionally
  // opening the just-created order.
  const handleViewOrders = useCallback((soId?: string) => {
    setNav("sales");
    if (soId) setPendingSoId(soId);
  }, []);

  // Deep-link: Sales Order detail's Tag ID chip → Stock Locator + open Tag drawer.
  const handleOpenTagFromSo = useCallback((tagId: string) => {
    setNav("locator");
    setPendingTagId(tagId);
  }, []);

  // Deep-link: Sales Order detail's customer name (and Stock Locator's Linked Transactions
  // customer) → Client Profile + open Client drawer.
  const handleOpenClient = useCallback((clientId: string) => {
    setNav("clientprofile");
    setPendingClientId(clientId);
  }, []);
  const handleClientOpened = useCallback(() => setPendingClientId(null), []);

  // Submit a new approval request from the SO detail panel / Request Discount
  // quick-entry form. Auto-assigns id + createdAt + Pending status; requester identity
  // is stamped from the current role. discountRate passes through untouched when the
  // draft sets one (Request Discount form) and stays undefined otherwise (generic form).
  const handleCreateApproval = useCallback(
    (draft: { type: ApprovalRequestType; relatedSoId?: string; discountRate?: number; details: string }) => {
      const newReq: ApprovalRequest = {
        id: `AR-2026-${String(approvalRequests.length + 1).padStart(4, "0")}`,
        type: draft.type,
        requestedBy: identityFor(role),
        relatedSoId: draft.relatedSoId,
        discountRate: draft.discountRate,
        details: draft.details,
        status: "Pending",
        createdAt: nowStamp(),
      };
      setApprovalRequests((prev) => [...prev, newReq]);
    },
    [approvalRequests.length, role, setApprovalRequests],
  );

  // Sales edits one of their own still-Pending requests (Request Discount → Edit). Patches
  // the related order / rate / reason in place; status stays Pending and the id is unchanged,
  // so Manager's queue simply re-renders with the updated values + recalculated price.
  const handleUpdateApproval = useCallback(
    (id: string, patch: { relatedSoId?: string; discountRate?: number; details: string }) => {
      setApprovalRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, relatedSoId: patch.relatedSoId, discountRate: patch.discountRate, details: patch.details }
            : r,
        ),
      );
    },
    [setApprovalRequests],
  );

  // Manager Approve / Reject — stamps reviewer + resolvedAt + optional note.
  const handleResolveApproval = useCallback(
    (id: string, decision: "Approved" | "Rejected", note: string) => {
      const stamp = nowStamp();
      const reviewer = identityFor(role);
      setApprovalRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: decision,
                reviewedBy: reviewer,
                reviewNote: note ? note : undefined,
                resolvedAt: stamp,
              }
            : r,
        ),
      );
    },
    [role, setApprovalRequests],
  );

  // Sales acknowledges a batch of resolved requests — removes their "New decision"
  // highlight in MyApprovals so the banner doesn't reappear on re-visit.
  const handleAcknowledgeApprovals = useCallback((ids: string[]) => {
    setAcknowledgedApprovalIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Deep-link into Stock Locator pre-filtered (Tag Entry / Delivery Slips "View in Inventory").
  const handleViewInInventory = useCallback((filter: EntryFilter) => {
    setNav("locator");
    setEntryFilter(filter);
  }, []);

  // Dashboard drill-through: KPI cards, species bars, status donut/legend → pre-filtered Stock Locator.
  const handleNavigateToLocator = useCallback((filter: EntryFilter) => {
    setNav("locator");
    setEntryFilter(filter);
  }, []);

  // Dashboard drill-through: Yard Activity row → that tag's detail drawer.
  const handleOpenTagFromDashboard = useCallback((tagId: string) => {
    setNav("locator");
    setPendingTagId(tagId);
  }, []);

  if (!authed) return <LoginPage onSignIn={handleSignIn} />;

  return (
    <RecentRecordsProvider>
      <LookupsProvider>
        <ClientsProvider>
        <div className={`flex h-screen bg-cream text-text overflow-hidden animate-fade-in transition-opacity duration-500 ${loggingOut ? "opacity-0" : "opacity-100"}`}>
          <Sidebar nav={nav} setNav={handleNav} floorView={isFloor} role={role} onLogout={handleLogout} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar nav={nav} role={role} setRole={setRole} onOpenRecord={handleOpenRecord} />
            {isFloor && <FloorBanner />}
            <div key={`${nav}:${navEpoch}`} className="flex-1 overflow-y-auto">
              {nav === "dashboard" && <Dashboard tags={tags} floorView={isFloor} onNavigateToLocator={handleNavigateToLocator} onOpenTag={handleOpenTagFromDashboard} />}
              {nav === "locator" && <StockLocator tags={tags} floorView={isFloor} role={role} openTagId={pendingTagId} onTagOpened={handleTagOpened} onUpdateTag={handleUpdateTag} onDeleteTags={handleDeleteTags} entryFilter={entryFilter} onClearEntryFilter={() => setEntryFilter(null)} salesOrders={salesOrders} onLinkSalesOrder={handleLinkSalesOrder} onOpenSo={handleOpenSoFromLocator} />}
              {nav === "tagentry" && <TagEntry tags={tags} setTags={setTags} floorView={isFloor} onViewInInventory={handleViewInInventory} />}
              {nav === "delivery" && <DeliverySlips tags={tags} setTags={setTags} onNavigateToLocator={handleNavigateToLocator} />}
              {nav === "settings" && role === "manager" && <CustomValuesSettings />}
              {nav === "avail" && role !== "floor" && (
                <AvailableToSell
                  tags={tags}
                  role={role}
                  salesOrders={salesOrders}
                  onCreateSalesOrder={handleCreateSalesOrder}
                  onAppendToDraftOrder={handleAppendToDraftOrder}
                  onViewOrders={handleViewOrders}
                />
              )}
              {nav === "sales" && role !== "floor" && (
                <SalesOrders
                  salesOrders={salesOrders}
                  tags={tags}
                  openSoId={pendingSoId}
                  onSoOpened={handleSoOpened}
                  onAdvanceStatus={handleAdvanceSoStatus}
                  onUpdateSalesOrder={handleUpdateSalesOrder}
                  onConfirmDraft={handleConfirmDraftOrder}
                  onOpenTag={handleOpenTagFromSo}
                  onOpenClient={handleOpenClient}
                  onCreateApproval={handleCreateApproval}
                  requesterIdentity={identityFor(role)}
                />
              )}
              {nav === "clientprofile" && role !== "floor" && (
                <Clients
                  tags={tags}
                  role={role}
                  salesOrders={salesOrders}
                  openClientId={pendingClientId}
                  onClientOpened={handleClientOpened}
                  onOpenSo={handleOpenSoFromLocator}
                  onCreateSalesOrder={handleCreateSalesOrder}
                  onViewOrders={handleViewOrders}
                />
              )}
              {nav === "pulse" && role !== "floor" && (
                <Pulse tags={tags} salesOrders={salesOrders} role={role} />
              )}
              {nav === "approvals" && role === "sales" && (
                <MyApprovals
                  approvalRequests={approvalRequests}
                  salesOrders={salesOrders}
                  tags={tags}
                  identity={identityFor(role)}
                  acknowledgedIds={acknowledgedApprovalIds}
                  onAcknowledgeResolved={handleAcknowledgeApprovals}
                  onCreateApproval={handleCreateApproval}
                  onUpdateApproval={handleUpdateApproval}
                />
              )}
              {nav === "approvals" && role === "manager" && (
                <ApprovalQueue
                  approvalRequests={approvalRequests}
                  salesOrders={salesOrders}
                  tags={tags}
                  onResolve={handleResolveApproval}
                  onUpdateSalesOrder={handleUpdateSalesOrder}
                  onConfirmDraft={handleConfirmDraftOrder}
                  onAdvanceStatus={handleAdvanceSoStatus}
                  onOpenTag={handleOpenTagFromSo}
                  onOpenClient={handleOpenClient}
                  onCreateApproval={handleCreateApproval}
                  requesterIdentity={identityFor(role)}
                />
              )}
              {!["dashboard", "locator", "tagentry", "delivery", "settings", "avail", "sales", "approvals", "clientprofile", "pulse"].includes(nav) && <ComingSoon name={nav} />}
            </div>
          </div>
        </div>
        </ClientsProvider>
      </LookupsProvider>
    </RecentRecordsProvider>
  );
}
