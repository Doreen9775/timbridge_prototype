import { extractSlipSections } from "./_core";

// Vercel Edge Function. Receives { base64, mediaType, isPDF } from the browser, calls
// Anthropic with the server-only ANTHROPIC_API_KEY, and returns { parsed: ParsedSlip }.
export const config = { runtime: "edge" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "Server is not configured with an Anthropic API key." }, 500);

  try {
    const { base64, mediaType, isPDF } = (await req.json()) as {
      base64?: string;
      mediaType?: string;
      isPDF?: boolean;
    };
    if (!base64) return json({ error: "No file data received." }, 400);
    const parsed = await extractSlipSections(base64, mediaType ?? "application/pdf", Boolean(isPDF), apiKey);
    return json({ parsed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Parsing failed." }, 502);
  }
}
