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
import { Insights } from "@/features/insights/Insights";
import { RecentRecordsProvider } from "@/hooks/useRecentRecords";
import { LookupsProvider } from "@/hooks/useLookups";
import { ClientsProvider } from "@/hooks/useClients";
import type { ApprovalRequest, ApprovalRequestType, EntryFilter, RecentRecord, SalesOrder, SalesOrderStatus, Tag } from "@/lib/types";
import { useRole } from "@/hooks/useRole";
import { useTags } from "@/hooks/useTags";
import { useSalesOrders } from "@/hooks/useSalesOrders";
import { useApprovalRequests } from "@/hooks/useApprovalRequests";

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

  // Available to Sell, Sales Orders, Approvals, Client Profile and Insights are
  // Manager + Sales only; bounce Floor to Stock Locator (sidebar hides them for
  // Floor; this is defense-in-depth).
  useEffect(() => {
    if ((nav === "avail" || nav === "sales" || nav === "approvals" || nav === "clientprofile" || nav === "insights") && role === "floor") setNav("locator");
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

  // Append a brand-new tag to the shared Tag table (Available-to-Sell's partial-qty
  // Reserve split — the only caller so far that needs to add rather than mutate).
  const handleCreateTag = useCallback((tag: Tag) => {
    setTags((prev) => [...prev, tag]);
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
      lineItems: { tagId: string; qty: number; unitPrice: number }[],
      confirm: boolean,
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
      const newSo: SalesOrder = {
        id: newId,
        clientId,
        status: confirm ? "Open" : "Draft",
        date: iso,
        lineItems,
      };
      setSalesOrders((prev) => [...prev, newSo]);

      if (confirm) {
        const idSet = new Set(lineItems.map((li) => li.tagId));
        const worker = identityFor(role);
        const stamp = nowStamp();
        setTags((prev) =>
          prev.map((t) =>
            idSet.has(t.id)
              ? {
                  ...t,
                  status: "Reserved",
                  updated: "just now",
                  history: [...t.history, { e: `Reserved for ${newId} via Available-to-Sell`, t: stamp, w: worker }],
                }
              : t,
          ),
        );
      }
      return { ok: true, soId: newId };
    },
    [tags, salesOrders.length, role, setSalesOrders, setTags],
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

  // Submit a new approval request from Reserve modal / SO detail. Auto-assigns id +
  // createdAt + Pending status; requester identity is stamped from the current role.
  const handleCreateApproval = useCallback(
    (draft: { type: ApprovalRequestType; relatedSoId?: string; details: string }) => {
      const newReq: ApprovalRequest = {
        id: `AR-2026-${String(approvalRequests.length + 1).padStart(4, "0")}`,
        type: draft.type,
        requestedBy: identityFor(role),
        relatedSoId: draft.relatedSoId,
        details: draft.details,
        status: "Pending",
        createdAt: nowStamp(),
      };
      setApprovalRequests((prev) => [...prev, newReq]);
    },
    [approvalRequests.length, role, setApprovalRequests],
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
                  onUpdateTag={handleUpdateTag}
                  onCreateTag={handleCreateTag}
                  onLinkSalesOrder={handleLinkSalesOrder}
                  onCreateSalesOrder={handleCreateSalesOrder}
                  onAppendToDraftOrder={handleAppendToDraftOrder}
                  onCreateApproval={handleCreateApproval}
                  requesterIdentity={identityFor(role)}
                />
              )}
              {nav === "sales" && role !== "floor" && (
                <SalesOrders
                  salesOrders={salesOrders}
                  tags={tags}
                  openSoId={pendingSoId}
                  onSoOpened={handleSoOpened}
                  onAdvanceStatus={handleAdvanceSoStatus}
                  onOpenTag={handleOpenTagFromSo}
                  onOpenClient={handleOpenClient}
                  onCreateApproval={handleCreateApproval}
                  requesterIdentity={identityFor(role)}
                />
              )}
              {nav === "clientprofile" && role !== "floor" && (
                <Clients
                  salesOrders={salesOrders}
                  openClientId={pendingClientId}
                  onClientOpened={handleClientOpened}
                  onOpenSo={handleOpenSoFromLocator}
                />
              )}
              {nav === "insights" && role !== "floor" && (
                <Insights tags={tags} salesOrders={salesOrders} role={role} />
              )}
              {nav === "approvals" && role === "sales" && (
                <MyApprovals
                  approvalRequests={approvalRequests}
                  identity={identityFor(role)}
                  acknowledgedIds={acknowledgedApprovalIds}
                  onAcknowledgeResolved={handleAcknowledgeApprovals}
                  onOpenSo={handleOpenSoFromLocator}
                />
              )}
              {nav === "approvals" && role === "manager" && (
                <ApprovalQueue
                  approvalRequests={approvalRequests}
                  onResolve={handleResolveApproval}
                  onOpenSo={handleOpenSoFromLocator}
                />
              )}
              {!["dashboard", "locator", "tagentry", "delivery", "settings", "avail", "sales", "approvals", "clientprofile", "insights"].includes(nav) && <ComingSoon name={nav} />}
            </div>
          </div>
        </div>
        </ClientsProvider>
      </LookupsProvider>
    </RecentRecordsProvider>
  );
}
