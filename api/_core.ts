// Server-side core for the Delivery Slip parser. Runs inside the Vercel Edge Function
// (api/parse-slip.ts) and the Vite dev middleware. The Anthropic API key is passed in by
// the caller and never reaches the browser. Returns the raw parsed array (client casts it).
// (Underscore-prefixed files in /api are helpers, not routes — Vercel won't expose this.)

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

export async function extractLineItems(
  base64: string,
  mediaType: string,
  isPDF: boolean,
  apiKey: string,
): Promise<unknown[]> {
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
            { type: "text", text: "Extract all lumber line items from this delivery slip. Respond with ONLY the JSON array — start with [ and end with ], no other text." },
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

  // Isolate the JSON array between the first "[" and last "]" — tolerates a prose
  // preamble or markdown code fences around the JSON.
  const cleaned = raw.replace(/```json|```/gi, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The AI result was empty or cut off. Try a clearer scan, or use the sample delivery slip.");
  }
  const items = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(items) ? items : [];
}
