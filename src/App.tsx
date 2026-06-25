import { useCallback, useState } from "react";
import { Sidebar, type NavKey } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { FloorBanner } from "@/components/layout/FloorBanner";
import { ComingSoon } from "@/components/shared/ComingSoon";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { StockLocator } from "@/features/stock-locator/StockLocator";
import { TagEntry } from "@/features/tag-entry/TagEntry";
import { DeliverySlips } from "@/features/delivery-slips/DeliverySlips";
import { LoginPage } from "@/features/auth/LoginPage";
import { RecentRecordsProvider } from "@/hooks/useRecentRecords";
import type { EntryFilter, RecentRecord, Tag } from "@/lib/types";
import { useRole } from "@/hooks/useRole";
import { useTags } from "@/hooks/useTags";

export default function App() {
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [entryFilter, setEntryFilter] = useState<EntryFilter | null>(null);
  const [authed, setAuthed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { role, isFloor, setFloorView } = useRole();
  const { tags, setTags } = useTags();

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
      <div className={`flex h-screen bg-cream text-text overflow-hidden animate-fade-in transition-opacity duration-500 ${loggingOut ? "opacity-0" : "opacity-100"}`}>
        <Sidebar nav={nav} setNav={setNav} floorView={isFloor} onLogout={handleLogout} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar nav={nav} floorView={isFloor} setFloorView={setFloorView} onOpenRecord={handleOpenRecord} />
          {isFloor && <FloorBanner />}
          <div className="flex-1 overflow-y-auto">
            {nav === "dashboard" && <Dashboard tags={tags} floorView={isFloor} onNavigateToLocator={handleNavigateToLocator} onOpenTag={handleOpenTagFromDashboard} />}
            {nav === "locator" && <StockLocator tags={tags} floorView={isFloor} role={role} openTagId={pendingTagId} onTagOpened={handleTagOpened} onUpdateTag={handleUpdateTag} entryFilter={entryFilter} onClearEntryFilter={() => setEntryFilter(null)} />}
            {nav === "tagentry" && <TagEntry tags={tags} setTags={setTags} floorView={isFloor} onViewInInventory={handleViewInInventory} />}
            {nav === "delivery" && <DeliverySlips tags={tags} setTags={setTags} onViewInInventory={handleViewInInventory} />}
            {!["dashboard", "locator", "tagentry", "delivery"].includes(nav) && <ComingSoon name={nav} />}
          </div>
        </div>
      </div>
    </RecentRecordsProvider>
  );
}
