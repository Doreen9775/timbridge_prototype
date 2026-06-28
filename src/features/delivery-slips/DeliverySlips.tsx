import { useCallback, useMemo, useRef, useState } from "react";
import {
  Truck, Upload, Loader, ArrowLeft, RefreshCw, ChevronDown, ChevronRight,
  Plus, X, AlertTriangle, Tag as TagIcon, Edit3, CheckCircle,
} from "lucide-react";
import type { Tag, EntryFilter } from "@/lib/types";
import {
  parseDeliverySlip,
  emptyParsedSlip,
  type ParsedSlip,
  type SlipSections,
  type SectionKey,
  type SlipField,
  type SlipLineItem,
} from "@/lib/anthropic";
import { calcFbm } from "@/lib/fbm";

type Stage = "upload" | "analyzing" | "detail";

// Left metadata panel width bounds (px). MIN is large enough that the 3-column
// Total FBM / Total Pcs / Total Pkgs stat grid in the Summary Card never wraps
// or overlaps — narrower than this and 5-6 digit bold numbers collide.
const LEFT_PANEL_MIN = 300;
const LEFT_PANEL_MAX = 480;
const LEFT_PANEL_DEFAULT = 300;

interface SectionSpec {
  key: SectionKey;
  title: string;
  alwaysRender: boolean; // Shipment Identity is always rendered (if any field present)
  defaultOpen: boolean;  // Unrecognized defaults closed
}

const SECTIONS: SectionSpec[] = [
  { key: "shipment_identity", title: "Shipment Identity", alwaysRender: true, defaultOpen: true },
  { key: "logistics", title: "Logistics", alwaysRender: false, defaultOpen: true },
  { key: "parties", title: "Parties", alwaysRender: false, defaultOpen: true },
  { key: "dates_location", title: "Dates & Location", alwaysRender: false, defaultOpen: true },
  { key: "financial", title: "Financial", alwaysRender: false, defaultOpen: true },
  { key: "unrecognized", title: "Unrecognized", alwaysRender: false, defaultOpen: false },
];

// camelCase → "Title Case". `orderNo` → `Order No`, `vgmWeight` → `Vgm Weight`.
function toTitleCase(camel: string): string {
  if (!camel) return "";
  const spaced = camel
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
  return spaced.replace(/(^|\s)\w/g, (m) => m.toUpperCase());
}

// Same dot, three states. high=green filled · medium=amber filled · low=red hollow.
// 6px diameter (w-1.5 h-1.5 = 6px in Tailwind). Tooltips per spec.
function ConfidenceDot({ level }: { level: SlipField["confidence"] }) {
  if (level === "high") {
    return <span title="High confidence" className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />;
  }
  if (level === "medium") {
    return <span title="Review recommended" className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />;
  }
  return (
    <span
      title="Verify manually — low confidence"
      className="inline-block w-1.5 h-1.5 rounded-full border-[1.5px] border-red-500 bg-transparent"
    />
  );
}

// Key-priority candidate lookup (case-insensitive, normalized).
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s._-]/g, "")
    .replace(/(number|num|no)$/, "");
}
function lookupField(sections: SlipField[][], candidates: string[]): string {
  for (const candidate of candidates) {
    const target = normalizeKey(candidate);
    for (const section of sections) {
      for (const f of section) {
        if (normalizeKey(f.field) === target) return f.value;
      }
    }
  }
  return "—";
}

// FBM for the group row: trust per-tag tally when present (Mode A), else compute.
function groupFbm(it: SlipLineItem): number {
  if (it.tags && it.tags.length > 0) return it.tags.reduce((s, t) => s + t.fbm, 0);
  return calcFbm(it.thick, it.width, it.length, it.qty);
}

// ── Demo seeds ────────────────────────────────────────────────────────────────
// Mode A: AC Transport-style export slip with Package Details (per-tag tally).
// Tag counts and fbm are sized so child sums match the group totals shown in the
// original document Summary.
const DEMO_A: ParsedSlip = {
  lineItems: [
    {
      species: "Hem-Fir", grade: "#2", thick: 1, width: 4, length: 14,
      qty: 1080, pkgs: 4, state: "GRN", milling: "RGH",
      notes: "1×4 HF #2 Shop & Btr RGH GRN, Cust Ord No. CHL131641", confidence: "high",
      tags: [
        { tagNo: "999048597", pcs: 270, fbm: 964 },
        { tagNo: "999048709", pcs: 270, fbm: 963 },
        { tagNo: "999048807", pcs: 270, fbm: 964 },
        { tagNo: "999049148", pcs: 270, fbm: 963 },
      ],
    },
    {
      species: "Hem-Fir", grade: "#2", thick: 2, width: 4, length: 10,
      qty: 280, pkgs: 2, state: "GRN", milling: "RGH",
      notes: "2×4 HF #2 Shop & Btr RGH GRN", confidence: "high",
      tags: [
        { tagNo: "999049666", pcs: 140, fbm: 824 },
        { tagNo: "999050409", pcs: 140, fbm: 824 },
      ],
    },
    {
      species: "Hem-Fir", grade: "Select", thick: 2, width: 4, length: 14,
      qty: 140, pkgs: 1, state: "GRN", milling: "RGH",
      notes: "2×4 HF Std & Btr RGH GRN", confidence: "medium",
      tags: [{ tagNo: "999049196", pcs: 140, fbm: 987 }],
    },
    {
      species: "Hem-Fir", grade: "#3", thick: 2, width: 4, length: 10,
      qty: 700, pkgs: 5, state: "GRN", milling: "RGH",
      notes: "2×4 HF Utility RGH GRN", confidence: "high",
      tags: [
        { tagNo: "999050501", pcs: 140, fbm: 811 },
        { tagNo: "999050502", pcs: 140, fbm: 811 },
        { tagNo: "999050503", pcs: 140, fbm: 811 },
        { tagNo: "999050504", pcs: 140, fbm: 811 },
        { tagNo: "999050505", pcs: 140, fbm: 811 },
      ],
    },
    {
      species: "Hem-Fir", grade: "#3", thick: 2, width: 6, length: 10,
      qty: 48, pkgs: 1, state: "GRN", milling: "RGH",
      notes: "2×6 HF Utility & Better RGH GRN", confidence: "medium",
      tags: [{ tagNo: "999051207", pcs: 48, fbm: 421 }],
    },
    {
      species: "Hem-Fir", grade: "Clear", thick: 4, width: 4, length: 14,
      qty: 140, pkgs: 2, state: "GRN", milling: "RGH",
      notes: "4×4 HF Factory Flitch & D Clr RGH GRN", confidence: "low",
      tags: [
        { tagNo: "999051402", pcs: 70, fbm: 864 },
        { tagNo: "999051403", pcs: 70, fbm: 864 },
      ],
    },
    {
      species: "Hem-Fir", grade: "Clear", thick: 4, width: 6, length: 14,
      qty: 49, pkgs: 1, state: "GRN", milling: "RGH",
      notes: "4×6 HF Factory Flitch & D Clr RGH GRN", confidence: "low",
      tags: [{ tagNo: "999051508", pcs: 49, fbm: 944 }],
    },
  ],
  sections: {
    shipment_identity: [
      { field: "slipNo", value: "1615-09", confidence: "high" },
      { field: "orderNo", value: "VANA12248400", confidence: "high" },
      { field: "bookingNumber", value: "VANA12248400", confidence: "high" },
      { field: "custOrdNo", value: "CHL131641", confidence: "medium" },
    ],
    logistics: [
      { field: "carrier", value: "AC Transport Ltd.", confidence: "high" },
      { field: "vessel", value: "HMM VANCOUVER", confidence: "high" },
      { field: "voyage", value: "0300W(PN3/", confidence: "medium" },
      { field: "shippingLine", value: "Hyundai Merchant Marine", confidence: "high" },
      { field: "containerType", value: "40' HC", confidence: "high" },
      { field: "destination", value: "Qingdao", confidence: "high" },
      { field: "loadingPort", value: "Deltaport", confidence: "high" },
      { field: "tareWeight", value: "0", confidence: "low" },
      { field: "vgmWeight", value: "0", confidence: "low" },
    ],
    parties: [
      { field: "supplier", value: "AC Transport Ltd.", confidence: "high" },
      { field: "customer", value: "INTEREX Forest Products Ltd.", confidence: "high" },
      { field: "shipTo", value: "410 - 4400 Dominion St, Burnaby, BC V5G 4G3", confidence: "medium" },
    ],
    dates_location: [
      { field: "shipDate", value: "08/20/2025", confidence: "high" },
      { field: "yardLocation", value: "Spruce Rd.", confidence: "medium" },
    ],
    financial: [],
    unrecognized: [
      { field: "pageInfo", value: "Page 1 of 1", confidence: "low" },
    ],
  },
};

// Mode B: flat invoice — no Package Details. Modelled on the SPF S4S HT invoice the
// user shared (16li2.pdf), with line items in the Description column instead of a
// Summary table. Three product lines, all 2×6 SPF #1, sizes 12'/14'/16'.
const DEMO_B: ParsedSlip = {
  lineItems: [
    {
      species: "SPF", grade: "#1", thick: 2, width: 6, length: 12,
      qty: 320, pkgs: 2, state: "HT", milling: "S4S",
      notes: "2×6×12 #1 S4S HT White; 2.000 PKG; 3,840 footage; $350.00/MBF",
      confidence: "high",
    },
    {
      species: "SPF", grade: "#1", thick: 2, width: 6, length: 14,
      qty: 320, pkgs: 2, state: "HT", milling: "S4S",
      notes: "2×6×14 #1 S4S HT White; 2.000 PKG; 4,480 footage; $375.00/MBF",
      confidence: "high",
    },
    {
      species: "SPF", grade: "#1", thick: 2, width: 6, length: 16,
      qty: 960, pkgs: 6, state: "HT", milling: "S4S",
      notes: "2×6×16 #1 S4S HT White; 6.000 PKG; 15,360 footage; $400.00/MBF",
      confidence: "medium",
    },
  ],
  sections: {
    shipment_identity: [
      { field: "invoiceNo", value: "16li2", confidence: "high" },
      { field: "orderNo", value: "PO-2026-0142", confidence: "high" },
    ],
    logistics: [],
    parties: [
      { field: "supplier", value: "Western Sawmill Co.", confidence: "high" },
      { field: "customer", value: "Timbridge Yard A", confidence: "medium" },
    ],
    dates_location: [
      { field: "invoiceDate", value: "11/15/2025", confidence: "high" },
      { field: "deliveryDate", value: "11/22/2025", confidence: "medium" },
    ],
    financial: [
      { field: "paymentTerms", value: "2% 10 Days Net 11", confidence: "high" },
      { field: "subtotal", value: "$9,168.00", confidence: "high" },
      { field: "salesTax", value: "$916.80", confidence: "high" },
      { field: "totalInvoiceAmount", value: "$10,084.80", confidence: "high" },
    ],
    unrecognized: [],
  },
};

interface DeliverySlipsProps {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  onNavigateToLocator: (filter: EntryFilter) => void;
}

export function DeliverySlips({ tags, setTags, onNavigateToLocator }: DeliverySlipsProps) {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  // Editable copy of the AI-parsed line items — seeded once from the parse result,
  // then mutated in place as the user edits/selects. Confirm & Create reads from here.
  const [lineItems, setLineItems] = useState<SlipLineItem[]>([]);
  // Editable copy of the AI-parsed metadata sections, same pattern as lineItems —
  // edits to existing AI field values (Shipment Identity, Logistics, Parties, etc.)
  // live here.
  const [editedSections, setEditedSections] = useState<SlipSections>(emptyParsedSlip().sections);
  const [manualSections, setManualSections] = useState<SlipSections>(emptyParsedSlip().sections);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  // Manual override for the Supplier summary cell — null means "use the AI/lookup
  // value"; an empty-string commit from the editor clears back to null.
  const [supplierOverride, setSupplierOverride] = useState<string | null>(null);
  // Width of the left metadata panel, in px — user-draggable via the divider.
  const [leftWidth, setLeftWidth] = useState(LEFT_PANEL_DEFAULT);
  const fileRef = useRef<HTMLInputElement>(null);

  const initParsed = (p: ParsedSlip, name: string) => {
    setFileName(name);
    setLineItems(p.lineItems);
    setEditedSections(p.sections);
    setManualSections(emptyParsedSlip().sections);
    setSelected(new Set(p.lineItems.map((_, i) => i)));
    setSupplierOverride(null);
    setStage("detail");
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setError("");
    const isPDF = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPDF && !isImage) {
      setError("Please upload a PDF or image file (JPG / PNG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = String(e.target?.result).split(",")[1];
      setStage("analyzing");
      try {
        const result = await parseDeliverySlip(b64, file.type, isPDF);
        initParsed(result, file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Parse failed.");
        setStage("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setStage("upload");
    setFileName("");
    setLineItems([]);
    setEditedSections(emptyParsedSlip().sections);
    setManualSections(emptyParsedSlip().sections);
    setSelected(new Set());
    setSupplierOverride(null);
    setError("");
  };

  // ── Left-panel resize (drag the divider to widen/narrow the metadata panel) ─
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const onMove = (ev: MouseEvent) => {
      const next = startWidth + (ev.clientX - startX);
      setLeftWidth(Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, next)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  // ── Line-item editing ─────────────────────────────────────────────────────
  const updateLineItem = (idx: number, key: keyof SlipLineItem, val: string) => {
    setLineItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const numeric = key === "thick" || key === "width" || key === "length" || key === "qty" || key === "pkgs";
        return { ...it, [key]: numeric ? Number(val) : val } as SlipLineItem;
      }),
    );
  };

  // ── Selection (Mode A: per-group; Mode B: per-row — same shape) ───────────
  const toggleSelected = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  const toggleSelectAll = () => {
    if (selected.size === lineItems.length) setSelected(new Set());
    else setSelected(new Set(lineItems.map((_, i) => i)));
  };

  // ── Manual metadata field add/remove ──────────────────────────────────────
  const addManualField = (key: SectionKey, field: string, value: string) => {
    setManualSections((prev) => ({
      ...prev,
      [key]: [...prev[key], { field, value, confidence: "high" }],
    }));
  };
  const removeManualField = (key: SectionKey, index: number) => {
    setManualSections((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  // ── AI-extracted field editing (every section — Shipment Identity, Logistics,
  // Parties, Dates & Location, Financial, Unrecognized) ─────────────────────
  const updateSectionField = (key: SectionKey, index: number, value: string) => {
    setEditedSections((prev) => ({
      ...prev,
      [key]: prev[key].map((f, i) => (i === index ? { ...f, value } : f)),
    }));
  };
  const updateManualField = (key: SectionKey, index: number, value: string) => {
    setManualSections((prev) => ({
      ...prev,
      [key]: prev[key].map((f, i) => (i === index ? { ...f, value } : f)),
    }));
  };

  // Supplier from parties (broadened lookup over the *edited* sections so a
  // correction made directly on the Parties row also updates this), unless the
  // user has overridden it via the editable Summary Card field. Shared by the
  // Summary Card display and the Tag.supplier value written on Confirm & Create.
  const supplier = supplierOverride ?? lookupField(
    [editedSections.parties, editedSections.logistics],
    ["supplier", "shipper", "vendor", "from", "carrier"],
  );

  // ── Confirm & Create ──────────────────────────────────────────────────────
  // Mode A: one Pending Tag per tag-child row across all checked groups.
  // Mode B: one Pending Tag per checked flat row.
  const confirmCreate = () => {
    const groups = lineItems.filter((_, i) => selected.has(i));
    if (groups.length === 0) return;
    const poNumber = lookupField(
      [editedSections.shipment_identity],
      ["poNumber", "po", "purchaseOrder", "purchaseOrderNumber", "orderNo", "orderNumber", "bookingNumber"],
    );
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const stamp = `${monthsShort[today.getMonth()]} ${pad(today.getDate())} ${today.getFullYear()} ${pad(today.getHours())}:${pad(today.getMinutes())}`;

    const newTags: Tag[] = [];
    let counter = tags.length;
    for (const g of groups) {
      const children = g.tags && g.tags.length > 0
        ? g.tags.map((t) => ({ qty: t.pcs, fbm: t.fbm, tagNo: t.tagNo as string | null }))
        : [{ qty: g.qty, fbm: calcFbm(g.thick, g.width, g.length, g.qty), tagNo: null as string | null }];
      for (const child of children) {
        counter += 1;
        const slipNote = child.tagNo ? ` · Slip Tag: ${child.tagNo}` : "";
        newTags.push({
          id: `T-2026-${String(counter + 100).padStart(4, "0")}`,
          species: g.species,
          grade: g.grade,
          thick: g.thick,
          width: g.width,
          length: g.length,
          qty: child.qty,
          fbm: child.fbm,
          state: g.state,
          milling: g.milling,
          yard: "YD-A", section: "A-1", rack: "R-01", bin: "B1",
          status: "Pending",
          date: iso,
          updated: "just now",
          parentLog: null,
          supplier: supplier !== "—" ? supplier : undefined,
          history: [{
            e: `Created from delivery slip${poNumber !== "—" ? " PO " + poNumber : ""}${slipNote}`,
            t: stamp,
            w: "DW",
          }],
        });
      }
    }
    setTags([...tags, ...newTags]);
    onNavigateToLocator({ tagIds: newTags.map((t) => t.id) });
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const mode: "A" | "B" = useMemo(
    () => lineItems.some((li) => Array.isArray(li.tags) && li.tags.length > 0) ? "A" : "B",
    [lineItems],
  );
  const selectedItems = useMemo(
    () => lineItems.filter((_, i) => selected.has(i)),
    [lineItems, selected],
  );
  const totalFbm = useMemo(
    () => selectedItems.reduce((s, it) => s + groupFbm(it), 0),
    [selectedItems],
  );
  const totalPcs = useMemo(
    () => selectedItems.reduce((s, it) => s + it.qty, 0),
    [selectedItems],
  );
  const totalPkgs = useMemo(
    () => selectedItems.reduce((s, it) => s + (it.pkgs ?? 0), 0),
    [selectedItems],
  );
  // N = tags that would be created on confirm (Mode A: child rows; Mode B: flat rows).
  const tagsToCreate = useMemo(() => {
    if (mode === "B") return selectedItems.length;
    return selectedItems.reduce((s, it) => s + (it.tags?.length ?? 1), 0);
  }, [mode, selectedItems]);
  const productCount = lineItems.length;
  // Warning count: number of items with med/low confidence.
  const warningCount = lineItems.filter((it) => it.confidence !== "high").length;

  // ── Upload / Analyzing ────────────────────────────────────────────────────
  if (stage === "upload" || stage === "analyzing") {
    return (
      <div className="p-8 bg-cream min-h-full">
        <div className="max-w-[600px] mx-auto">
          <div className="bg-white rounded-2xl p-10 shadow-[0_1px_8px_rgba(0,0,0,0.08)] text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-4">
              <Truck size={28} className="text-coral" />
            </div>
            <div className="text-xl font-display font-semibold text-ink mb-2">Delivery Slip — AI Parser</div>
            <div className="text-[13px] text-text-sec mb-7 leading-relaxed">
              Upload a delivery slip (PDF or photo) and AI will extract the cargo line items<br />
              and structured metadata (shipment, logistics, parties, dates, financial).
            </div>

            {stage === "analyzing" ? (
              <div className="py-10">
                <Loader size={36} className="text-coral animate-spin mx-auto mb-4" />
                <div className="text-sm text-text-sec">Analyzing "{fileName}"…</div>
                <div className="text-xs text-text-ter mt-1.5">AI is extracting cargo lines and categorizing every field</div>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-sage rounded-[10px] px-6 py-9 cursor-pointer transition-colors hover:border-coral mb-4"
                >
                  <Upload size={28} className="text-text-ter mx-auto mb-2.5" />
                  <div className="text-sm text-text font-medium mb-1">Click to upload or drag & drop</div>
                  <div className="text-xs text-text-ter">PDF, JPG, PNG supported</div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                {error && (
                  <div className="bg-coral/10 border border-coral rounded-lg px-3.5 py-2.5 text-[13px] text-coral mb-3">{error}</div>
                )}
                <div className="text-xs text-text-ter mt-3">— or try a demo —</div>
                <div className="flex gap-2 justify-center mt-2.5">
                  <button
                    onClick={() => initParsed(DEMO_A, "sample · two-level (Mode A)")}
                    className="px-4 py-2 bg-transparent border border-sage rounded-lg text-[13px] text-text-sec cursor-pointer hover:border-coral hover:text-coral"
                  >
                    Mode A — Package Details
                  </button>
                  <button
                    onClick={() => initParsed(DEMO_B, "sample · flat invoice (Mode B)")}
                    className="px-4 py-2 bg-transparent border border-sage rounded-lg text-[13px] text-text-sec cursor-pointer hover:border-coral hover:text-coral"
                  >
                    Mode B — Flat Invoice
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Detail (3-zone layout) ────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-cream">
      {/* Feature top header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-sage">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={reset}
            aria-label="Back to upload"
            className="p-1.5 rounded-md border border-sage text-text-sec hover:border-coral hover:text-coral cursor-pointer shrink-0"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <div className="text-[15px] font-display font-semibold text-ink truncate">
              {fileName || "Delivery Slip"}
            </div>
            <div className="text-[11px] text-text-ter">
              {productCount} {productCount === 1 ? "product" : "products"} · {mode === "A" ? "Two-level (Package Details)" : "Flat invoice"}
            </div>
          </div>
        </div>
        <button
          onClick={reset}
          className="shrink-0 px-3 py-1.5 bg-transparent border border-sage rounded-md text-[12px] cursor-pointer text-text-sec flex items-center gap-1.5 hover:border-coral hover:text-coral"
        >
          <RefreshCw size={13} />Re-upload
        </button>
      </div>

      {/* Middle area: left aside + draggable divider + main */}
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel
          width={leftWidth}
          totalFbm={totalFbm}
          totalPcs={totalPcs}
          totalPkgs={totalPkgs}
          supplier={supplier}
          onChangeSupplier={(v) => setSupplierOverride(v === "" ? null : v)}
          tagsToCreate={tagsToCreate}
          productCount={productCount}
          sections={editedSections}
          manualSections={manualSections}
          onAdd={addManualField}
          onRemoveManual={removeManualField}
          onEditAi={updateSectionField}
          onEditManual={updateManualField}
        />
        <div
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize metadata panel"
          className="w-1 shrink-0 cursor-col-resize bg-sage/50 hover:bg-coral/60 active:bg-coral transition-colors"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <LineItemsCards
            mode={mode}
            lineItems={lineItems}
            selected={selected}
            onToggle={toggleSelected}
            onToggleAll={toggleSelectAll}
            onUpdate={updateLineItem}
            totalPcs={totalPcs}
            totalFbm={totalFbm}
            totalPkgs={totalPkgs}
            tagsToCreate={tagsToCreate}
          />
        </main>
      </div>

      {/* Sticky bottom bar */}
      <div className="shrink-0 border-t border-sage bg-white px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {warningCount > 0 ? (
            <>
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <span className="text-[12px] text-text-sec truncate">
                {warningCount} {warningCount === 1 ? "item" : "items"} with medium or low confidence — review before confirming
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={reset}
            className="px-4 py-2 bg-transparent border border-sage rounded-md text-[13px] cursor-pointer text-text-sec hover:border-coral hover:text-coral"
          >
            Cancel
          </button>
          <button
            onClick={confirmCreate}
            disabled={tagsToCreate === 0}
            className={[
              "px-5 py-2 rounded-md text-[13px] font-semibold flex items-center gap-1.5",
              tagsToCreate === 0
                ? "bg-[#ccc] text-white cursor-not-allowed"
                : "bg-coral text-white cursor-pointer hover:brightness-95",
            ].join(" ")}
          >
            Confirm & create {tagsToCreate} tag{tagsToCreate === 1 ? "" : "s"} →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Left panel ──────────────────────────────────────────────────────────────
function LeftPanel({
  width, totalFbm, totalPcs, totalPkgs, supplier, onChangeSupplier, tagsToCreate, productCount,
  sections, manualSections, onAdd, onRemoveManual, onEditAi, onEditManual,
}: {
  width: number;
  totalFbm: number; totalPcs: number; totalPkgs: number; supplier: string;
  onChangeSupplier: (v: string) => void;
  tagsToCreate: number; productCount: number;
  sections: SlipSections; manualSections: SlipSections;
  onAdd: (key: SectionKey, field: string, value: string) => void;
  onRemoveManual: (key: SectionKey, index: number) => void;
  onEditAi: (key: SectionKey, index: number, value: string) => void;
  onEditManual: (key: SectionKey, index: number, value: string) => void;
}) {
  return (
    <aside style={{ width }} className="shrink-0 overflow-y-auto bg-white border-r border-sage">
      <div className="p-4">
        <SummaryCard
          totalFbm={totalFbm} totalPcs={totalPcs} totalPkgs={totalPkgs}
          supplier={supplier} onChangeSupplier={onChangeSupplier}
          tagsToCreate={tagsToCreate} productCount={productCount}
        />
        <div className="mt-4 flex flex-col gap-2">
          {SECTIONS.map((spec) => (
            <SectionAccordion
              key={spec.key}
              spec={spec}
              aiItems={sections[spec.key]}
              manualItems={manualSections[spec.key]}
              onAdd={(field, value) => onAdd(spec.key, field, value)}
              onRemoveManual={(idx) => onRemoveManual(spec.key, idx)}
              onEditAi={(idx, value) => onEditAi(spec.key, idx, value)}
              onEditManual={(idx, value) => onEditManual(spec.key, idx, value)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function SummaryCard({
  totalFbm, totalPcs, totalPkgs, supplier, onChangeSupplier, tagsToCreate, productCount,
}: {
  totalFbm: number; totalPcs: number; totalPkgs: number; supplier: string;
  onChangeSupplier: (v: string) => void;
  tagsToCreate: number; productCount: number;
}) {
  return (
    <div className="bg-cream/50 rounded-lg border border-sage/60 p-3.5">
      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        <Stat label="Total FBM" value={totalFbm.toLocaleString()} big />
        <Stat label="Total pcs" value={totalPcs.toLocaleString()} big />
        <Stat label="Total pkgs" value={totalPkgs > 0 ? totalPkgs.toLocaleString() : "—"} big />
      </div>
      <div className="mt-3 pt-3 border-t border-sage/40">
        <SupplierField value={supplier} onChange={onChangeSupplier} />
      </div>
      <div className="mt-3 pt-2.5 border-t border-sage/40 text-[11px] text-text-ter">
        {tagsToCreate} tag{tagsToCreate === 1 ? "" : "s"} · {productCount} product{productCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-text-ter uppercase tracking-wide font-medium">{label}</div>
      <div className={big ? "mt-0.5 text-[18px] font-bold text-ink tabular-nums" : "mt-0.5 text-[13px] font-medium text-ink"}>
        {value}
      </div>
    </div>
  );
}

// Supplier is the one summary field a Manager may need to correct (the AI's
// candidate lookup can miss unusual headers) — editable in place, and wraps
// onto multiple lines instead of truncating since supplier names run long.
function SupplierField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => {
    setDraft(value === "—" ? "" : value);
    setEditing(true);
  };
  const commit = () => {
    onChange(draft.trim());
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-text-ter uppercase tracking-wide font-medium">Supplier</div>
          <div className="mt-0.5 text-[13px] font-medium text-ink leading-snug break-words">{value}</div>
        </div>
        <button
          onClick={startEdit}
          aria-label="Edit supplier"
          className="shrink-0 mt-3.5 p-1 rounded hover:bg-sage/30 cursor-pointer text-text-ter hover:text-coral"
        >
          <Edit3 size={12} />
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] text-text-ter uppercase tracking-wide font-medium mb-1">Supplier</div>
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          placeholder="Supplier name"
          className="flex-1 min-w-0 px-2 py-1 text-[13px] border border-sage rounded-md bg-white outline-none focus:border-coral"
        />
        <button onClick={commit} aria-label="Save supplier" className="shrink-0 p-1 rounded bg-coral text-white cursor-pointer hover:brightness-95">
          <CheckCircle size={12} />
        </button>
        <button onClick={cancel} aria-label="Cancel edit" className="shrink-0 p-1 rounded border border-sage text-text-sec cursor-pointer hover:border-coral hover:text-coral">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Metadata accordion section ───────────────────────────────────────────────
// One Edit/Done toggle next to the section title puts every row in the block
// into edit mode at once — rather than a pencil per row. Edits apply live as
// the user types (no separate per-row save); Done just exits the edit view.
function SectionAccordion({
  spec, aiItems, manualItems, onAdd, onRemoveManual, onEditAi, onEditManual,
}: {
  spec: SectionSpec;
  aiItems: SlipField[];
  manualItems: SlipField[];
  onAdd: (field: string, value: string) => void;
  onRemoveManual: (index: number) => void;
  onEditAi: (index: number, value: string) => void;
  onEditManual: (index: number, value: string) => void;
}) {
  const [open, setOpen] = useState(spec.defaultOpen);
  const [editingBlock, setEditingBlock] = useState(false);
  if (aiItems.length === 0 && manualItems.length === 0 && !spec.alwaysRender) return null;
  if (aiItems.length === 0 && !spec.alwaysRender) return null;

  const totalCount = aiItems.length + manualItems.length;
  const hasFields = totalCount > 0;

  return (
    <div className="bg-white rounded-lg border border-sage/60 overflow-hidden">
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-3 py-2.5 hover:bg-sage/10 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-semibold text-ink truncate">{spec.title}</span>
          <span className="text-[10px] text-text-ter bg-sage/30 rounded-full px-1.5 py-0.5">{totalCount}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasFields ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!editingBlock) setOpen(true);
                setEditingBlock((b) => !b);
              }}
              className={[
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border cursor-pointer",
                editingBlock
                  ? "bg-coral text-white border-coral"
                  : "bg-transparent text-text-sec border-sage hover:border-coral hover:text-coral",
              ].join(" ")}
            >
              {editingBlock ? <><CheckCircle size={10} />Done</> : <><Edit3 size={10} />Edit</>}
            </button>
          ) : null}
          <ChevronDown size={13} className={`text-text-sec transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>
      {open ? (
        <div className="border-t border-sage/40">
          {aiItems.map((f, i) => (
            <FieldRow key={`ai-${i}`} field={f} editing={editingBlock} onChange={(value) => onEditAi(i, value)} />
          ))}
          {manualItems.map((f, i) => (
            <FieldRow
              key={`m-${i}`}
              field={f}
              manual
              editing={editingBlock}
              onChange={(value) => onEditManual(i, value)}
              onDelete={() => onRemoveManual(i)}
            />
          ))}
          <AddFieldRow onAdd={onAdd} />
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  field, manual, editing, onChange, onDelete,
}: {
  field: SlipField;
  manual?: boolean;
  editing: boolean;
  onChange: (value: string) => void;
  onDelete?: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-t border-sage/20 first:border-t-0 text-[11.5px]">
        <div className="w-[88px] shrink-0 text-text-sec leading-tight">{toTitleCase(field.field)}</div>
        <input
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-1.5 py-1 text-[11.5px] border border-sage rounded-md bg-white outline-none focus:border-coral"
        />
        <div className="flex items-center gap-1 shrink-0">
          {manual ? (
            <span className="text-[9px] uppercase tracking-wide bg-[#E5E7EB] text-[#4B5563] rounded-full px-1.5 py-0.5 font-semibold">
              Manual
            </span>
          ) : (
            <ConfidenceDot level={field.confidence} />
          )}
          {onDelete ? (
            <button onClick={onDelete} aria-label="Delete field" className="shrink-0 p-0.5 rounded hover:bg-sage/30 cursor-pointer text-text-ter hover:text-coral">
              <X size={11} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-t border-sage/20 first:border-t-0 text-[11.5px]">
      <div className="w-[88px] shrink-0 text-text-sec leading-tight">{toTitleCase(field.field)}</div>
      <div className="flex-1 min-w-0 text-ink leading-tight break-words">{field.value}</div>
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {manual ? (
          <span className="text-[9px] uppercase tracking-wide bg-[#E5E7EB] text-[#4B5563] rounded-full px-1.5 py-0.5 font-semibold">
            Manual
          </span>
        ) : (
          <ConfidenceDot level={field.confidence} />
        )}
        {onDelete ? (
          <button onClick={onDelete} aria-label="Delete field" className="p-0.5 rounded hover:bg-sage/30 cursor-pointer text-text-ter hover:text-coral">
            <X size={11} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AddFieldRow({ onAdd }: { onAdd: (field: string, value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const canAdd = field.trim().length > 0 && value.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd(field.trim(), value.trim());
    setField("");
    setValue("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-3 py-2 border-t border-sage/30 bg-sage/5 hover:bg-sage/15 cursor-pointer text-[11px] text-text-sec"
      >
        <Plus size={11} /> Add field
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 border-t border-sage/30 bg-sage/10">
      <input
        autoFocus
        value={field}
        onChange={(e) => setField(e.target.value)}
        placeholder="Field name"
        className="px-2 py-1 text-[11.5px] border border-sage rounded-md bg-white outline-none focus:border-coral"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Value"
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        className="px-2 py-1 text-[11.5px] border border-sage rounded-md bg-white outline-none focus:border-coral"
      />
      <div className="flex items-center gap-1.5">
        <button
          onClick={submit}
          disabled={!canAdd}
          className={[
            "flex-1 px-2 py-1 rounded-md text-[11px] font-semibold",
            canAdd ? "bg-coral text-white cursor-pointer hover:brightness-95" : "bg-sage/30 text-text-ter cursor-not-allowed",
          ].join(" ")}
        >
          Add
        </button>
        <button
          onClick={() => { setOpen(false); setField(""); setValue(""); }}
          className="px-2 py-1 rounded-md text-[11px] border border-sage text-text-sec cursor-pointer hover:border-coral hover:text-coral"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Line items table (Mode A or Mode B auto) ────────────────────────────────
// Standard option lists for the Edit form. Non-standard incoming values
// (e.g. "Stud", "Utility") are prepended dynamically by optionsFor.
const FIELDS: Record<string, (string | number)[]> = {
  species: ["SPF", "Doug Fir", "Western Red Cedar", "Hem-Fir"],
  grade: ["#1", "#2", "#3", "Select", "Clear", "MSR 1650"],
  state: ["GRN", "KD", "HT", "KD-HT"],
  milling: ["RGH", "STD", "S4S"],
  thick: [1, 2, 4],
  width: [4, 6, 8, 10],
  length: [8, 10, 12, 14, 16, 18, 20],
};

// ── Cargo line items — card layout ──────────────────────────────────────────
function LineItemsCards({
  mode, lineItems, selected, onToggle, onToggleAll, onUpdate,
  totalPcs, totalFbm, totalPkgs, tagsToCreate,
}: {
  mode: "A" | "B";
  lineItems: SlipLineItem[];
  selected: Set<number>;
  onToggle: (idx: number) => void;
  onToggleAll: () => void;
  onUpdate: (idx: number, key: keyof SlipLineItem, val: string) => void;
  totalPcs: number;
  totalFbm: number;
  totalPkgs: number;
  tagsToCreate: number;
}) {
  const allSelected = lineItems.length > 0 && selected.size === lineItems.length;
  const someSelected = selected.size > 0 && selected.size < lineItems.length;

  return (
    <div className="bg-white rounded-xl border border-sage overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-sage/60">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={onToggleAll}
            className="accent-coral w-4 h-4 cursor-pointer align-middle"
          />
          <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Cargo Line Items
          </span>
          <span className="text-[11px] text-text-ter bg-sage/30 rounded-full px-2 py-0.5">
            {lineItems.length}
          </span>
          <span className="text-[11px] text-text-ter">
            · {mode === "A" ? "Two-level (Package Details)" : "Flat layout"}
          </span>
        </div>
      </div>

      {lineItems.length === 0 ? (
        <div className="px-5 py-8 text-[13px] text-text-ter text-center">
          No cargo line items detected on this document.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-4">
          {lineItems.map((it, idx) => (
            <GroupCard
              key={idx}
              item={it}
              mode={mode}
              isSel={selected.has(idx)}
              onToggle={() => onToggle(idx)}
              onUpdate={(k, v) => onUpdate(idx, k, v)}
            />
          ))}
        </div>
      )}

      {lineItems.length > 0 ? (
        <div className="px-5 py-3 bg-sage/15 border-t border-sage text-[12px] flex items-center justify-between gap-4 flex-wrap">
          <span className="text-text-sec font-medium">
            {selected.size} of {lineItems.length} selected · <span className="text-coral font-semibold">{tagsToCreate} {tagsToCreate === 1 ? "tag" : "tags"}</span> to create
          </span>
          <div className="flex gap-5 tabular-nums">
            <span><span className="text-text-ter">Pcs:</span> <span className="text-ink font-bold ml-1">{totalPcs.toLocaleString()}</span></span>
            <span><span className="text-text-ter">FBM:</span> <span className="text-coral font-bold ml-1">{totalFbm.toLocaleString()}</span></span>
            <span><span className="text-text-ter">Pkgs:</span> <span className="text-ink font-bold ml-1">{totalPkgs > 0 ? totalPkgs.toLocaleString() : "—"}</span></span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  item, mode, isSel, onToggle, onUpdate,
}: {
  item: SlipLineItem;
  mode: "A" | "B";
  isSel: boolean;
  onToggle: () => void;
  onUpdate: (key: keyof SlipLineItem, val: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const hasChildren = mode === "A" && Array.isArray(item.tags) && item.tags.length > 0;
  const fbm = groupFbm(item);
  // FBM in the edit form uses the live formula so dimension/qty edits are reflected.
  const formulaFbm = calcFbm(item.thick, item.width, item.length, item.qty);

  return (
    <div
      className={[
        "bg-white rounded-[10px] px-4 py-3 border-[1.5px] transition-colors",
        isSel ? "border-coral opacity-100" : "border-sage opacity-60",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSel}
          onChange={onToggle}
          className="mt-1 accent-coral w-4 h-4 cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0">
          {!isEdit ? (
            <>
              <div className="flex items-center gap-2.5 flex-wrap">
                {hasChildren ? (
                  <button
                    onClick={() => setExpanded((e) => !e)}
                    className="text-text-sec hover:text-coral cursor-pointer p-0.5 -ml-1"
                    aria-label={expanded ? "Collapse package details" : "Expand package details"}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : null}
                <span className="text-[15px] font-semibold text-ink">{item.species}</span>
                <span className="bg-sage/30 text-ink px-2 py-0.5 rounded-[10px] text-xs">{item.grade}</span>
                <span className="text-[13px] text-text font-mono">{item.thick}×{item.width} × {item.length}'</span>
                <span className="text-[13px] text-text">{item.qty.toLocaleString()} pcs</span>
                <span className="text-[13px] text-text-sec">{item.state} · {item.milling}</span>
                {item.pkgs !== undefined ? (
                  <span className="text-[12px] text-text-sec">· {item.pkgs} pkg{item.pkgs === 1 ? "" : "s"}</span>
                ) : null}
                <ConfidenceDot level={item.confidence} />
                <span className="ml-auto text-[14px] font-bold text-coral whitespace-nowrap tabular-nums">
                  {fbm.toLocaleString()} FBM
                </span>
              </div>
              {item.notes ? (
                <div className="text-[11px] text-text-ter mt-1.5">{item.notes}</div>
              ) : null}
              {hasChildren && expanded ? (
                <div className="mt-3 pl-5 border-l-2 border-sage/40 flex flex-col gap-1.5">
                  {item.tags!.map((t, ti) => (
                    <div key={ti} className="flex items-center gap-3 text-[12px]">
                      <TagIcon size={11} className="text-text-ter shrink-0" />
                      <span className="font-mono text-ink">{t.tagNo}</span>
                      <span className="ml-auto tabular-nums text-text-sec">
                        {t.pcs.toLocaleString()} pcs · <span className="text-coral font-semibold">{t.fbm.toLocaleString()} FBM</span> · 1 pkg
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <EditForm item={item} formulaFbm={formulaFbm} onUpdate={onUpdate} />
          )}
        </div>
        <button
          onClick={() => setIsEdit((e) => !e)}
          className={[
            "shrink-0 px-3 py-1.5 rounded-md text-xs cursor-pointer border flex items-center gap-1 whitespace-nowrap",
            isEdit ? "bg-coral text-white border-coral" : "bg-transparent text-text-sec border-sage hover:border-coral hover:text-coral",
          ].join(" ")}
        >
          {isEdit ? <><CheckCircle size={12} />Done</> : <><Edit3 size={12} />Edit</>}
        </button>
      </div>
    </div>
  );
}

// Edit form — 4×2 grid. If a current value isn't in our standard option list
// (real lumber has "Stud", "Utility", etc.), prepend it as the first option
// so the select stays valid without re-running validation.
function EditForm({
  item, formulaFbm, onUpdate,
}: {
  item: SlipLineItem;
  formulaFbm: number;
  onUpdate: (key: keyof SlipLineItem, val: string) => void;
}) {
  const optionsFor = (k: string, current: string | number): (string | number)[] => {
    const base = FIELDS[k] ?? [];
    if (base.some((v) => String(v) === String(current))) return base;
    return [current, ...base];
  };
  const selectCls = "px-2.5 py-1.5 text-xs border border-sage rounded-md bg-white outline-none text-text w-full";
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {(["species", "grade", "state", "milling"] as const).map((k) => (
        <div key={k}>
          <div className="text-[10px] text-text-ter mb-1 capitalize">{k}</div>
          <select
            value={item[k]}
            onChange={(e) => onUpdate(k, e.target.value)}
            className={selectCls}
          >
            {optionsFor(k, item[k]).map((v) => <option key={v} value={String(v)}>{v}</option>)}
          </select>
        </div>
      ))}
      {(
        [
          ["thick", "Thick"],
          ["width", "Width"],
          ["length", "Length (ft)"],
          ["qty", "Qty (pcs)"],
        ] as const
      ).map(([k, l]) => (
        <div key={k}>
          <div className="text-[10px] text-text-ter mb-1">{l}</div>
          <select
            value={String(item[k])}
            onChange={(e) => onUpdate(k, e.target.value)}
            className={selectCls}
          >
            {optionsFor(k, item[k]).map((v) => <option key={v} value={String(v)}>{v}</option>)}
          </select>
        </div>
      ))}
      <div className="col-span-4 text-xs text-coral font-semibold mt-1">
        FBM = {item.thick}×{item.width}×{item.length}×{item.qty}÷12 = {formulaFbm.toLocaleString()}
      </div>
    </div>
  );
}
