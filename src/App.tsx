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
import type { RecentRecord, Tag } from "@/lib/types";
import { useRole } from "@/hooks/useRole";
import { useTags } from "@/hooks/useTags";

export default function App() {
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const { isFloor, setFloorView } = useRole();
  const { tags, setTags } = useTags();

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

  if (!authed) return <LoginPage onSignIn={() => setAuthed(true)} />;

  return (
    <RecentRecordsProvider>
      <div className="flex h-screen bg-cream text-text overflow-hidden animate-fade-in">
        <Sidebar nav={nav} setNav={setNav} floorView={isFloor} onLogout={() => setAuthed(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar nav={nav} floorView={isFloor} setFloorView={setFloorView} onOpenRecord={handleOpenRecord} />
          {isFloor && <FloorBanner />}
          <div className="flex-1 overflow-y-auto">
            {nav === "dashboard" && <Dashboard tags={tags} floorView={isFloor} />}
            {nav === "locator" && <StockLocator tags={tags} floorView={isFloor} openTagId={pendingTagId} onTagOpened={handleTagOpened} onUpdateTag={handleUpdateTag} />}
            {nav === "tagentry" && <TagEntry tags={tags} setTags={setTags} floorView={isFloor} />}
            {nav === "delivery" && <DeliverySlips tags={tags} setTags={setTags} />}
            {!["dashboard", "locator", "tagentry", "delivery"].includes(nav) && <ComingSoon name={nav} />}
          </div>
        </div>
      </div>
    </RecentRecordsProvider>
  );
}
