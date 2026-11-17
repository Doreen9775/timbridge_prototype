// Industry packs — a preset of everything that makes Timbridge fit one segment of the
// forest-products chain, layered over the shared core:
//
//   - the product profile its inventory uses (lib/products.ts)
//   - wording (a "tag" is a "lot", "reserved" is "allocated", an order is a "boom" …)
//   - which modules appear in the sidebar
//   - storage sites for the yard map
//   - the demo company and its seed data
//
// Switching pack (Settings) switches demo company: the whole workspace remounts on that
// pack's own data. Shared logic never branches on the pack id — it reads the profile and
// the wording from here, so a new pack is a new entry, not new code paths. (The few
// screens that are genuinely pack-specific — Scale Intake, Booms, Volume Report — are
// chosen by the nav item's key in App.)
import type { NavKey } from "@/components/layout/Sidebar";
import type { ActivityEvent, ApprovalRequest, Client, FloorTask, SalesOrder, SalesOrderStatus, Tag, TagStatus } from "./types";
import type { ProductTypeId } from "./products";
import { INITIAL_APPROVAL_REQUESTS, INITIAL_CLIENTS, floorTasks, initialTags, recentActivity, salesOrders } from "./mock-data";
import { LOG_ACTIVITY, LOG_APPROVALS, LOG_CLIENTS, LOG_FLOOR_TASKS, LOG_ORDERS, LOG_SITES, LOG_TAGS } from "./mock-data-logs";

export type PackId = "lumber" | "logTrading";

export interface PackSeed {
  tags: Tag[];
  salesOrders: SalesOrder[];
  approvals: ApprovalRequest[];
  clients: Client[];
  activity: ActivityEvent[];
  floorTasks: FloorTask[];
}

export interface Site { code: string; letter: string; name: string; lng: number; lat: number }

export interface Terms {
  tag: string; // one unit of inventory: "Tag" / "Lot"
  tags: string;
  order: string; // a customer commitment: "Sales Order" / "Boom"
  orders: string;
  reserve: string; // the verb: "Reserve" / "Allocate"
  reserved: string; // past tense used in history and labels
  ship: string; // "Ship" / "Deliver"
  shipped: string;
}

export interface IndustryPack {
  id: PackId;
  label: string; // shown in Settings
  description: string;
  company: string; // demo company name (sidebar footer)
  productType: ProductTypeId;
  terms: Terms;
  // Display names for lifecycle states — the stored values never change.
  tagStatusLabel: Record<TagStatus, string>;
  orderStatusLabel: Record<SalesOrderStatus, string>;
  hiddenNav: NavKey[];
  navLabels: Partial<Record<NavKey, string>>;
  sites: Site[];
  clientsStorageKey: string;
  seed: () => PackSeed;
}

const SAME_TAG_STATUS: Record<TagStatus, string> = {
  Pending: "Pending", Received: "Received", Available: "Available", Reserved: "Reserved", Shipped: "Shipped", Discrepancy: "Discrepancy",
};
const SAME_ORDER_STATUS: Record<SalesOrderStatus, string> = {
  Draft: "Draft", Open: "Open", Picked: "Picked", Shipped: "Shipped", Cancelled: "Cancelled",
};

export const PACKS: Record<PackId, IndustryPack> = {
  lumber: {
    id: "lumber",
    label: "Sawmill / lumber",
    description: "Tagged lumber measured in board feet, sold per piece on sales orders.",
    company: "Westcoast Lumber Co.",
    productType: "lumber",
    terms: { tag: "Tag", tags: "Tags", order: "Sales Order", orders: "Sales Orders", reserve: "Reserve", reserved: "Reserved", ship: "Ship", shipped: "Shipped" },
    tagStatusLabel: SAME_TAG_STATUS,
    orderStatusLabel: SAME_ORDER_STATUS,
    hiddenNav: ["volume"],
    navLabels: {},
    sites: [
      { code: "YD-A", letter: "A", name: "Yard A", lng: -122.662, lat: 49.1908 },
      { code: "YD-B", letter: "B", name: "Yard B", lng: -122.6548, lat: 49.1885 },
      { code: "YD-C", letter: "C", name: "Yard C", lng: -122.6482, lat: 49.1924 },
    ],
    clientsStorageKey: "timbridge_clients_v3",
    seed: () => ({ tags: initialTags, salesOrders, approvals: INITIAL_APPROVAL_REQUESTS, clients: INITIAL_CLIENTS, activity: recentActivity, floorTasks }),
  },
  logTrading: {
    id: "logTrading",
    label: "Log trading",
    description: "Scaled log lots measured in m³, allocated to customer booms that are stored, moved and delivered.",
    company: "Harbour Log Traders",
    productType: "log",
    terms: { tag: "Lot", tags: "Lots", order: "Boom", orders: "Booms", reserve: "Allocate", reserved: "Allocated", ship: "Deliver", shipped: "Delivered" },
    tagStatusLabel: { ...SAME_TAG_STATUS, Reserved: "Allocated", Shipped: "Delivered" },
    orderStatusLabel: { ...SAME_ORDER_STATUS, Open: "In storage", Picked: "In transit", Shipped: "Delivered" },
    // Lumber-only modules (slip parsing, lumber sales flow, production) and Pulse, whose
    // charts are still lumber-worded; the Volume Report covers this pack's reporting.
    hiddenNav: ["delivery", "po", "prod", "shipping", "avail", "pulse"],
    navLabels: { tagentry: "Scale Intake", sales: "Booms", locator: "Log Inventory" },
    sites: LOG_SITES,
    clientsStorageKey: "timbridge_clients_logs_v1",
    seed: () => ({ tags: LOG_TAGS, salesOrders: LOG_ORDERS, approvals: LOG_APPROVALS, clients: LOG_CLIENTS, activity: LOG_ACTIVITY, floorTasks: LOG_FLOOR_TASKS }),
  },
};

export const DEFAULT_PACK: PackId = "lumber";
