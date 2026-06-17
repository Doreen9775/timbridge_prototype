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

// Calls our own /api/parse-slip endpoint — a Vercel serverless (Edge) function in
// production, or the Vite dev middleware locally. The Anthropic key lives on the server
// and never ships in the browser bundle. The "sample delivery slip" demo path needs no key.
export async function parseDeliverySlip(base64: string, mediaType: string, isPDF: boolean): Promise<ParsedItem[]> {
  const resp = await fetch("/api/parse-slip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base64, mediaType, isPDF }),
  });

  let data: { items?: ParsedItem[]; error?: string };
  try {
    data = await resp.json();
  } catch {
    throw new Error("The parser service didn't respond correctly. Try again, or use the sample delivery slip.");
  }

  if (!resp.ok) {
    throw new Error(data.error || "Parsing failed. Try again, or use the sample delivery slip.");
  }
  return data.items ?? [];
}
