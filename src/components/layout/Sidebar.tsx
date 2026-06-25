import type { ReactNode } from "react";
import {
  Home, MapPin, Tag, Truck, ShoppingCart, Factory,
  FileText, BarChart2, TrendingUp, Settings, LogOut,
  DollarSign, Users, ClipboardCheck,
} from "lucide-react";
import { TimbridgeLogo } from "@/components/shared/TimbridgeLogo";
import type { Role } from "@/lib/types";

export type NavKey =
  | "dashboard" | "locator" | "tagentry"
  | "delivery" | "po" | "prod" | "sales"
  | "avail" | "clientprofile" | "approvals"
  | "reports" | "analytics" | "settings";

interface NavItem { key: NavKey; icon: ReactNode; label: string; allowedRoles?: Role[]; }
interface NavSection { label: string; items: NavItem[]; }

const sections: NavSection[] = [
  { label: "OVERVIEW", items: [
    { key: "dashboard", icon: <Home size={16} />, label: "Dashboard", allowedRoles: ["manager", "sales"] },
  ] },
  { label: "INVENTORY", items: [
    { key: "locator", icon: <MapPin size={16} />, label: "Stock Locator", allowedRoles: ["manager", "sales", "floor"] },
    { key: "tagentry", icon: <Tag size={16} />, label: "Tag Entry", allowedRoles: ["manager", "floor"] },
    { key: "avail", icon: <DollarSign size={16} />, label: "Available to Sell", allowedRoles: ["manager", "sales"] },
  ] },
  { label: "OPERATIONS", items: [
    { key: "delivery", icon: <Truck size={16} />, label: "Delivery Slips", allowedRoles: ["manager"] },
    { key: "po", icon: <ShoppingCart size={16} />, label: "Purchase Orders", allowedRoles: ["manager", "sales"] },
    { key: "prod", icon: <Factory size={16} />, label: "Production", allowedRoles: ["manager", "sales"] },
    { key: "sales", icon: <FileText size={16} />, label: "Sales", allowedRoles: ["manager", "sales"] },
    { key: "clientprofile", icon: <Users size={16} />, label: "Client Profile", allowedRoles: ["manager", "sales"] },
    { key: "approvals", icon: <ClipboardCheck size={16} />, label: "Approvals", allowedRoles: ["manager"] },
  ] },
  { label: "INSIGHTS", items: [
    { key: "reports", icon: <BarChart2 size={16} />, label: "Reports", allowedRoles: ["manager", "sales"] },
    { key: "analytics", icon: <TrendingUp size={16} />, label: "Analytics", allowedRoles: ["manager", "sales"] },
  ] },
  { label: "SETUP", items: [
    { key: "settings", icon: <Settings size={16} />, label: "Settings", allowedRoles: ["manager", "floor"] },
  ] },
];

interface SidebarProps {
  nav: NavKey;
  setNav: (key: NavKey) => void;
  floorView: boolean;
  role: Role;
  onLogout: () => void;
}

export function Sidebar({ nav, setNav, floorView, role, onLogout }: SidebarProps) {
  return (
    <div className="w-[210px] min-w-[210px] bg-ink flex flex-col h-screen sticky top-0">
      <div className="px-4 pt-5 pb-4">
        <TimbridgeLogo />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {sections.map((sec) => {
          const visibleItems = sec.items.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
          return (
            <div key={sec.label} className="mb-2">
              {visibleItems.length > 0 && (
                <>
                  <div className="text-white/35 text-[9px] font-semibold tracking-[1.5px] px-2 pt-2 pb-1">{sec.label}</div>
                  {visibleItems.map((item) => {
                    const active = nav === item.key;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setNav(item.key)}
                        className={[
                          "relative flex items-center gap-2 py-2 px-2.5 rounded-md cursor-pointer mb-0.5",
                          floorView ? "text-base" : "text-[13px]",
                          active ? "bg-coral/45 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                        ].join(" ")}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-lime absolute right-2" />}
                      </div>
                    );
                  })}
                </>
              )}
              {sec.label === "SETUP" && (
                <div
                  onClick={onLogout}
                  className={[
                    "flex items-center gap-2 py-2 px-2.5 rounded-md cursor-pointer mb-0.5 text-white/65 hover:bg-white/5 hover:text-white",
                    floorView ? "text-base" : "text-[13px]",
                  ].join(" ")}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3.5 py-3 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-coral flex items-center justify-center text-white text-[12px] font-semibold">DW</div>
        <div>
          <div className="text-white text-[12px] font-medium">Doreen W.</div>
          <div className="text-white/45 text-[10px]">Westcoast Lumber Co.</div>
        </div>
      </div>
    </div>
  );
}
