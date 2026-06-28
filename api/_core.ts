// Server-side core for the Delivery Slip parser. Runs inside the Vercel Edge Function
// (api/parse-slip.ts) and the Vite dev middleware. The Anthropic API key is passed in by
// the caller and never reaches the browser.
//
// Returns a two-part shape:
//   - line_items:   structured cargo rows (one per lumber line — the "WHAT")
//   - 6 sections:   categorized metadata key/value pairs (the "WHO/WHERE/WHEN/HOW/IDs/MONEY")
// (Underscore-prefixed files in /api are helpers, not routes — Vercel won't expose this.)

export type Confidence = "high" | "medium" | "low";
export type SectionKey =
  | "shipment_identity"
  | "logistics"
  | "parties"
  | "dates_location"
  | "financial"
  | "unrecognized";

export interface SlipField {
  field: string; // camelCase, AI-normalized
  value: string;
  confidence: Confidence;
}

// One tag child row inside a Package Details breakdown (Mode A documents only).
export interface SlipLineItemTag {
  tagNo: string;
  pcs: number;
  fbm: number;
}

export interface SlipLineItem {
  species: string;
  grade: string;
  thick: number;
  width: number;
  length: number;
  qty: number;     // pieces
  pkgs?: number;   // package count if visible
  state: string;
  milling: string;
  notes: string;
  confidence: Confidence;
  // Present only on Mode A documents (Package Details with per-tag tally).
  // Each entry is one tag row; aggregated counts (qty / pkgs / fbm) on the parent.
  tags?: SlipLineItemTag[];
}

export type SlipSections = Record<SectionKey, SlipField[]>;

export interface ParsedSlip {
  lineItems: SlipLineItem[];
  sections: SlipSections;
}

const SECTION_KEYS: SectionKey[] = [
  "shipment_identity",
  "logistics",
  "parties",
  "dates_location",
  "financial",
  "unrecognized",
];

const SYSTEM_PROMPT = `You are a logistics document parser for a lumber ERP system.

Extract data in TWO parts: structured cargo line items AND categorized metadata fields.

PART 1 — line_items: an array, one entry per lumber product line in the document.

A "lumber product line" is ANY per-product row, regardless of how the document is titled:
  - A row in a delivery slip's Summary table (e.g. "2×4 HF #2 Shop & Btr RGH GRN")
  - An invoice line item under columns like Description / Item / Product
    (e.g. "2×6×12 #1 S4S HT White; 2.000 PKG; 3,840 footage; $350.00/MBF")
  - A pick list or packing list row
  - Any per-product row that shows dimensions, grade, and a quantity or footage

Common abbreviations to map:
  Species — S-P-F → SPF, DF → Doug Fir, WRC → Western Red Cedar, HF → Hem-Fir
  Dimension formats — "2×6×12", "2x6 x 12", "2-6-12" all mean thick=2 width=6 length=12

For each product line, extract:
{
  "species":    "SPF | Doug Fir | Western Red Cedar | Hem-Fir | (or document text if uncategorized)",
  "grade":      "#1 | #2 | #3 | Select | Clear | MSR 1650 | Stud | (or document text)",
  "thick":      number (inches),
  "width":      number (inches),
  "length":     number (feet),
  "qty":        integer piece count (Pcs),
  "pkgs":       integer package count (Pkgs) if visible, otherwise omit,
  "state":      "GRN | KD | HT | KD-HT" (default KD if unclear),
  "milling":    "RGH | STD | S4S" (default STD if unclear),
  "notes":      string (per-line description text or note; empty string if none),
  "confidence": "high | medium | low"
}

Critical: if you see product lines, you MUST extract them. Do NOT return an empty list just
because the document is an invoice rather than a delivery slip — invoices have line items
too. Empty [] is only correct if there are literally no lumber rows anywhere in the document.

IMPORTANT (tags field): ONLY populate the "tags" array if the document also contains a
separate per-tag tally section listing individual tag numbers (e.g. 999048597) with their
own pcs/fbm. Most invoices and pick lists DO NOT have this. For those, omit the "tags"
field entirely on every line item — every line item then appears as a flat row in the UI.
Tags array format when present:
  { "tagNo": string, "pcs": number, "fbm": number }
Do NOT create separate top-level lineItems for tag rows — they are children of the product group.

PART 2 — categorized metadata. Extract ALL non-cargo key-value pairs visible in the document.
Categorize each into EXACTLY one of these 6 categories. Be deliberate — a Sales Tax field is
financial, not unrecognized. A vessel name is logistics, not unrecognized.
   - shipment_identity  (slip numbers, order numbers, booking references, PO numbers, custOrdNo, deliveryNo)
   - logistics          (vessel, voyage, shipping line, ports, container type, carrier, vehicle type, tare weight, VGM weight, cargo weight, loading port, destination)
   - parties            (customer, ship-to address, supplier, shipper, vendor, consignee, billTo)
   - dates_location     (dates, yard location, delivery address, ship date)
   - financial          (payment terms, taxable / non-taxable amounts, sales tax, tax rates, total invoice amount, currency, discount notes, price totals)
   - unrecognized       (only if a field truly fits none of the above — e.g. page numbers, internal stamps, free-text comments unrelated to money/parties/dates/logistics/IDs)

For each metadata field: normalize the key to camelCase English; assign confidence (high|medium|low).
Do not filter, skip, or summarize any non-cargo fields.

Return ONLY a valid JSON object in this exact shape — no preamble, no markdown fences, no explanation:
{
  "line_items":        [{ "species":"string","grade":"string","thick":0,"width":0,"length":0,"qty":0,"pkgs":0,"state":"string","milling":"string","notes":"string","confidence":"high|medium|low" }],
  "shipment_identity": [{ "field":"string","value":"string","confidence":"high|medium|low" }],
  "logistics":         [{ "field":"string","value":"string","confidence":"high|medium|low" }],
  "parties":           [{ "field":"string","value":"string","confidence":"high|medium|low" }],
  "dates_location":    [{ "field":"string","value":"string","confidence":"high|medium|low" }],
  "financial":         [{ "field":"string","value":"string","confidence":"high|medium|low" }],
  "unrecognized":      [{ "field":"string","value":"string","confidence":"high|medium|low" }]
}`;

function asConfidence(raw: unknown): Confidence {
  const c = typeof raw === "string" ? raw.toLowerCase() : "";
  return c === "high" || c === "medium" || c === "low" ? c : "low";
}

// Coerce one metadata section into a clean SlipField[] — guards the UI against
// missing keys, non-arrays, or malformed items in the model output.
function ensureFieldArray(raw: unknown): SlipField[] {
  if (!Array.isArray(raw)) return [];
  const out: SlipField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const field = typeof obj.field === "string" ? obj.field.trim() : "";
    const value = typeof obj.value === "string" ? obj.value.trim() : "";
    if (!field || !value) continue;
    out.push({ field, value, confidence: asConfidence(obj.confidence) });
  }
  return out;
}

// Coerce the AI's line_items array into clean SlipLineItem[]. Drops entries
// missing the structural keys (species/grade/thick/width/length/qty).
function ensureLineItemArray(raw: unknown): SlipLineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SlipLineItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const species = typeof o.species === "string" ? o.species.trim() : "";
    const grade = typeof o.grade === "string" ? o.grade.trim() : "";
    const thick = Number(o.thick);
    const width = Number(o.width);
    const length = Number(o.length);
    const qty = Math.round(Number(o.qty));
    if (!species || !grade) continue;
    if (!Number.isFinite(thick) || !Number.isFinite(width) || !Number.isFinite(length)) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const pkgsRaw = Number(o.pkgs);
    const pkgs = Number.isFinite(pkgsRaw) && pkgsRaw > 0 ? Math.round(pkgsRaw) : undefined;
    // Optional tags[] array — only on Mode A documents. Drop malformed entries
    // (missing tagNo / non-positive pcs|fbm). Omit field entirely if no valid tags.
    let tags: SlipLineItemTag[] | undefined;
    if (Array.isArray(o.tags)) {
      const cleaned: SlipLineItemTag[] = [];
      for (const t of o.tags) {
        if (!t || typeof t !== "object") continue;
        const tt = t as Record<string, unknown>;
        const tagNo = typeof tt.tagNo === "string" ? tt.tagNo.trim() : "";
        const pcs = Math.round(Number(tt.pcs));
        const fbm = Math.round(Number(tt.fbm));
        if (!tagNo) continue;
        if (!Number.isFinite(pcs) || pcs <= 0) continue;
        if (!Number.isFinite(fbm) || fbm < 0) continue;
        cleaned.push({ tagNo, pcs, fbm });
      }
      if (cleaned.length > 0) tags = cleaned;
    }
    out.push({
      species,
      grade,
      thick,
      width,
      length,
      qty,
      pkgs,
      state: typeof o.state === "string" && o.state ? o.state : "KD",
      milling: typeof o.milling === "string" && o.milling ? o.milling : "STD",
      notes: typeof o.notes === "string" ? o.notes : "",
      confidence: asConfidence(o.confidence),
      tags,
    });
  }
  return out;
}

export async function extractSlipSections(
  base64: string,
  mediaType: string,
  isPDF: boolean,
  apiKey: string,
): Promise<ParsedSlip> {
  const contentBlock = isPDF
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            { type: "text", text: "Extract all cargo line items AND all non-cargo metadata key/value pairs from this delivery slip. Respond with ONLY the JSON object — start with { and end with }, no other text." },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Anthropic API error ${resp.status}. Check the server API key, or try again.`);
  }

  const data = (await resp.json()) as { content?: { text?: string }[] };
  const raw = (data.content ?? []).map((c) => c.text ?? "").join("");

  // Isolate the JSON object between the first "{" and last "}" — tolerates a prose
  // preamble or markdown code fences around the JSON.
  const cleaned = raw.replace(/```json|```/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The AI result was empty or cut off. Try a clearer scan, or use the sample delivery slip.");
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

  const sections = {} as SlipSections;
  for (const key of SECTION_KEYS) {
    sections[key] = ensureFieldArray(parsed[key]);
  }
  return {
    lineItems: ensureLineItemArray(parsed.line_items),
    sections,
  };
}
