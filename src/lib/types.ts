// Timbridge domain types — single source of truth for the Tag table and friends.
// See kickoff §4 (architecture) and §5 (terminology).

// ─── Controlled vocabularies (kickoff §5) ───────────────────────────────────────
export type Species = "SPF" | "Doug Fir" | "Western Red Cedar" | "Hem-Fir";
export type Grade = "#1" | "#2" | "#3" | "Select" | "Clear" | "MSR 1650";
export type MoistureState = "GRN" | "KD" | "HT" | "KD-HT";
export type Milling = "RGH" | "STD" | "S4S";

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
  history: MovementEvent[];
}

// ─── Sales orders (kickoff §4.5 — link Reserved tags; unblocks Available-to-Sell) ─
export type SalesOrderStatus = "Open" | "Confirmed" | "Shipped" | "Cancelled";

export interface SalesOrder {
  id: string; // e.g. "SO-2026-0445"
  orderNumber: string; // human reference shown in history, e.g. "#445"
  customer: string;
  status: SalesOrderStatus;
  createdAt: string; // display string
  tagIds: string[]; // linked tags (Reserved while order is active)
  notes?: string;
}

// ─── Dashboard / activity feed ───────────────────────────────────────────────────
export type ActivityType = "move" | "receive" | "reserve" | "qc" | "scan";

export interface ActivityEvent {
  type: ActivityType;
  msg: string;
  worker: string;
  time: string;
}

export interface FloorTask {
  title: string;
  loc: string;
  priority: "High" | "Normal";
}

// ─── Recent records (top-nav "Recent" dropdown; persisted to localStorage) ────────
export type RecentRecordType = "tag" | "slip";

export interface RecentRecord {
  type: RecentRecordType;
  id: string;
  label: string;
  timestamp: number; // epoch ms of last access
}
