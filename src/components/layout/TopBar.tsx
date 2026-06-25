import { Search, Bell, ChevronRight } from "lucide-react";
import type { NavKey } from "./Sidebar";
import type { RecentRecord } from "@/lib/types";
import { RecentMenu } from "./RecentMenu";

const titles: Record<NavKey, string> = {
  dashboard: "Dashboard", locator: "Stock Locator", tagentry: "Tag Entry",
  delivery: "Delivery Slips", po: "Purchase Orders", prod: "Production", sales: "Sales",
  avail: "Available to Sell", clientprofile: "Client Profile", approvals: "Approvals",
  reports: "Reports", analytics: "Analytics", settings: "Settings",
};

const parents: Partial<Record<NavKey, string>> = {
  locator: "Inventory", tagentry: "Inventory", avail: "Inventory",
  delivery: "Operations", po: "Operations", prod: "Operations", sales: "Operations", clientprofile: "Operations", approvals: "Operations",
  reports: "Insights", analytics: "Insights", settings: "Setup",
};

interface TopBarProps {
  nav: NavKey;
  floorView: boolean;
  setFloorView: (floor: boolean) => void;
  onOpenRecord: (r: RecentRecord) => void;
}

export function TopBar({ nav, floorView, setFloorView, onOpenRecord }: TopBarProps) {
  return (
    <div className="bg-white h-14 flex items-center px-6 border-b border-sage sticky top-0 z-10 gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-[13px] text-text-sec">
          {parents[nav] && (
            <>
              <span>{parents[nav]}</span>
              <ChevronRight size={12} />
            </>
          )}
          <span className="text-text font-medium">{titles[nav] || "Dashboard"}</span>
        </div>
      </div>

      <div className="flex bg-[#F3F4F6] rounded-[20px] p-[3px] gap-[2px]">
        {(["Manager View", "Floor View"] as const).map((v) => {
          const active = (v === "Floor View") === floorView;
          return (
            <button
              key={v}
              onClick={() => setFloorView(v === "Floor View")}
              className={[
                "px-3.5 py-[5px] rounded-2xl border-0 cursor-pointer text-xs font-medium",
                active ? "bg-ink text-white" : "bg-transparent text-text-sec hover:text-text",
              ].join(" ")}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Search size={18} className="text-text-sec cursor-pointer hover:text-ink" />
        <div className="relative">
          <Bell size={18} className="text-text-sec cursor-pointer hover:text-ink" />
          <span className="absolute -top-0.5 -right-0.5 w-[7px] h-[7px] rounded-full bg-coral" />
        </div>
        <RecentMenu onOpenRecord={onOpenRecord} />
        <div className="w-[30px] h-[30px] rounded-full bg-coral flex items-center justify-center text-white text-[11px] font-semibold">DW</div>
      </div>
    </div>
  );
}
