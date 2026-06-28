// Client-side wrapper for /api/parse-slip. The Anthropic key lives on the server
// (Vercel Edge / Vite dev middleware) — this file just shapes the request/response.
// The "sample delivery slip" demo path needs no key.

export type Confidence = "high" | "medium" | "low";

export type SectionKey =
  | "shipment_identity"
  | "logistics"
  | "parties"
  | "dates_location"
  | "financial"
  | "unrecognized";

// One AI-extracted key/value pair from a metadata section.
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

// One structured cargo line item — the "WHAT" of the slip, used to create Tags.
export interface SlipLineItem {
  species: string;
  grade: string;
  thick: number;
  width: number;
  length: number;
  qty: number;     // pieces
  pkgs?: number;   // package count if AI extracted it
  state: string;
  milling: string;
  notes: string;
  confidence: Confidence;
  // Present only on Mode A documents (Package Details with per-tag tally).
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

// Guarantee every section is present even if the server returned a partial object,
// so the UI never has to null-check section keys at render time.
export function emptyParsedSlip(): ParsedSlip {
  return {
    lineItems: [],
    sections: {
      shipment_identity: [],
      logistics: [],
      parties: [],
      dates_location: [],
      financial: [],
      unrecognized: [],
    },
  };
}

export async function parseDeliverySlip(
  base64: string,
  mediaType: string,
  isPDF: boolean,
): Promise<ParsedSlip> {
  const resp = await fetch("/api/parse-slip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base64, mediaType, isPDF }),
  });

  let data: { parsed?: ParsedSlip; error?: string };
  try {
    data = await resp.json();
  } catch {
    throw new Error("The parser service didn't respond correctly. Try again, or use the sample delivery slip.");
  }

  if (!resp.ok) {
    throw new Error(data.error || "Parsing failed. Try again, or use the sample delivery slip.");
  }

  const out = emptyParsedSlip();
  const incoming = data.parsed ?? ({} as Partial<ParsedSlip>);
  if (Array.isArray(incoming.lineItems)) out.lineItems = incoming.lineItems;
  const incomingSections = (incoming.sections ?? {}) as Partial<SlipSections>;
  for (const key of SECTION_KEYS) {
    const arr = incomingSections[key];
    if (Array.isArray(arr)) out.sections[key] = arr;
  }
  return out;
}
