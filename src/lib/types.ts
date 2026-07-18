// Timbridge domain types — single source of truth for the Tag table and friends.
// See kickoff §4 (architecture) and §5 (terminology).

// ─── Controlled vocabularies (kickoff §5) ───────────────────────────────────────
// Widened from literal unions to plain string so Manager-added custom lookup values
// (Settings → Custom Values, src/lib/lookups.ts) can flow into these fields. The
// hardcoded literal sets used to live here as the unions; they now live as
// SYSTEM_DEFAULTS in src/lib/lookups.ts instead.
export type Species = string;
export type Grade = string;
export type MoistureState = string;
export type Milling = string;

// ─── Tag lifecycle (kickoff §4.5 — the 6-state machine) ──────────────────────────
export type TagStatus =
  | "Pending" // Delivery Slips creation — expected, not yet physically received
  | "Received" // Floor confirms via scan — on yard, not yet released
  | "Available" // Auto after Received — quotable, in Available-to-Sell
  | "Reserved" // Sales Order links the tag — locked to an order
  | "Shipped" // Pick + scan-out complete — out the gate
  | "Discrepancy"; // Floor exception flag — qty / grade / species mismatch

// ─── Roles & surfaces (kickoff §4.2) ─────────────────────────────────────────────
export type Role = "manager" | "sales" | "floor";
export type View = "desktop" | "tablet";

// ─── The Tag table (single source of truth — kickoff §4.4) ───────────────────────
export interface MovementEvent {
  e: string; // event description
  t: string; // timestamp, display string
  w: string; // worker initials
}

export interface Tag {
  id: string; // e.g. "T-2026-0101"
  species: Species;
  grade: Grade;
  thick: number; // inches
  width: number; // inches
  length: number; // feet
  qty: number; // piece count
  fbm: number; // board feet — thick × width × length × qty ÷ 12
  state: MoistureState;
  milling: Milling;
  yard: string;
  section: string;
  rack: string;
  bin: string;
  status: TagStatus;
  date: string; // system entry date (ISO YYYY-MM-DD) — derived from the first history event
  updated: string; // relative display string, e.g. "2h ago"
  parentLog: string | null; // display-only traceability (out of scope this semester)
  supplier?: string; // origin supplier (from a delivery slip; "In-house production" or absent otherwise)
  cost?: number; // per unit, USD — Manager-curated/seeded tags only; absent from Tag Entry / Delivery Slips
  marketValue?: number; // per unit, USD — same availability as cost
  history: MovementEvent[];
  parentTagId?: string; // set on a tag created by splitting a quantity off another tag (Available-to-Sell partial reserve)
  splitTagIds?: string[]; // ids of tags split off this one, if any
}

// ─── Sales orders (kickoff §4.5 — link Reserved tags; unblocks Available-to-Sell) ─
export type SalesOrderStatus = "Open" | "Picked" | "Shipped" | "Cancelled";

export interface SalesOrderLineItem {
  tagId: string; // links to a Tag — typically one with status Reserved while the order is active
  qty: number; // pieces drawn from this tag, may be less than the tag's full qty
  unitPrice: number; // USD per piece
}

export interface SalesOrder {
  id: string; // e.g. "SO-0042"
  clientId: string; // FK → Client.id (was a free-string `customer` field pre-CRM migration)
  status: SalesOrderStatus;
  date: string; // ISO date (YYYY-MM-DD)
  lineItems: SalesOrderLineItem[];
}

// ─── Clients (CRM MVP — replaces the pre-migration free-string customer field) ────
export interface Client {
  id: string;                 // e.g. "C-0001"
  name: string;               // company / customer name — the primary display label
  contactName?: string;       // primary contact person
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;             // free-text CRM notes
  createdAt: string;          // display-format timestamp (matches history/activity conventions)
}

// ─── Approval requests (Sales asks Manager to sign off on discounts, credit terms, etc.) ─
export type ApprovalRequestType = "discount" | "creditTerm" | "orderCancellation" | "other";
export type ApprovalRequestStatus = "Pending" | "Approved" | "Rejected";

export interface ApprovalRequest {
  id: string;                     // e.g. "AR-2026-0001"
  type: ApprovalRequestType;
  requestedBy: string;            // display name of the submitter (role identity)
  relatedSoId?: string;           // set when originated from Reserve modal or SO detail
  relatedClientId?: string;       // reserved for the customer-entity phase
  details: string;                // free-text reason / justification
  status: ApprovalRequestStatus;
  reviewedBy?: string;            // set on resolve
  reviewNote?: string;            // optional reviewer note
  createdAt: string;              // display-format timestamp (matches history/activity conventions)
  resolvedAt?: string;            // set on resolve
}

// ─── Dashboard / activity feed ───────────────────────────────────────────────────
export type ActivityType = "move" | "receive" | "reserve" | "qc" | "scan";

export interface ActivityEvent {
  type: ActivityType;
  msg: string;
  worker: string;
  time: string;
  tagId: string; // links back to the Tag table — Dashboard click-through opens this tag's drawer
}

export interface FloorTask {
  title: string;
  loc: string;
  priority: "High" | "Normal";
}

// ─── Entry-surface filter (deep-link Stock Locator with a pre-applied filter) ─────
// Passed into Stock Locator from App via the same transient-state pattern as openTagId.
// Provided fields map onto the existing filter bar; tagIds is a hard ID-set gate.
export interface EntryFilter {
  tagIds?: string[];
  status?: TagStatus[];
  species?: Species[];
  grade?: Grade[]; // feeds the existing Grade filter — used by Delivery Slip "Match to Tags"
  yard?: string[]; // feeds the existing Location filter — used by the Dashboard Yard Map drill-through
  lowQty?: boolean;
  // Resolves to a tagIds set (Sales Orders → linked tags). Auto-opens the drawer
  // if exactly one tag matches. Used by Delivery Slip "Match to Transaction".
  orderNo?: string;
}

// ─── Recent records (top-nav "Recent" dropdown; persisted to localStorage) ────────
export type RecentRecordType = "tag" | "slip";

export interface RecentRecord {
  type: RecentRecordType;
  id: string;
  label: string;
  timestamp: number; // epoch ms of last access
}
