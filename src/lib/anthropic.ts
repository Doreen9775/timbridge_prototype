import type { Species, Grade, MoistureState, Milling } from "./types";

// One parsed line item returned by the Delivery Slip parser.
export interface ParsedItem {
  species: Species;
  grade: Grade;
  thick: number;
  width: number;
  length: number;
  qty: number;
  state: MoistureState;
  milling: Milling;
  supplier: string;
  poNumber: string;
  notes: string;
}

const SYSTEM_PROMPT = `You are a data extraction assistant for a lumber yard ERP called TIMBRIDGE. Extract ALL lumber line items from the delivery slip / invoice document. Return ONLY a JSON array — no preamble, no markdown fences. Each item must have these exact keys:
species (one of: SPF, Doug Fir, Western Red Cedar, Hem-Fir — map common abbreviations like "S-P-F", "DF", "WRC", "HF"),
grade (one of: #1, #2, #3, Select, Clear, MSR 1650),
thick (number: 1, 2, or 4),
width (number: 4, 6, 8, or 10),
length (number in feet: 8,10,12,14,16,18,20),
qty (integer piece count),
state (one of: GRN, KD, HT, KD-HT — default KD if unclear),
milling (one of: RGH, STD, S4S — default STD if unclear),
supplier (string, from document header if visible, else ""),
poNumber (string, PO or order number if visible, else ""),
notes (string, any relevant notes or empty string).
If a field is ambiguous, pick the closest valid value. If you cannot find any lumber items, return an empty array [].`;

// Calls the Anthropic API directly from the browser. Requires VITE_ANTHROPIC_API_KEY
// in .env.local. NOTE: this exposes the key in the client bundle — acceptable for a
// local prototype only; a deployed build would route through a small server proxy.
export async function parseDeliverySlip(base64: string, mediaType: string, isPDF: boolean): Promise<ParsedItem[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error("No API key found. Add VITE_ANTHROPIC_API_KEY to .env.local, or use the sample delivery slip below.");
  }

  const contentBlock = isPDF
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: [contentBlock, { type: "text", text: "Extract all lumber line items from this delivery slip." }] },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`API request failed (${resp.status}). Check your key, or use the sample delivery slip.`);
  }

  const data = await resp.json();
  const raw: string = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  let items = JSON.parse(clean);
  if (!Array.isArray(items)) items = [];
  return items as ParsedItem[];
}
