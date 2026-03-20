import { NextRequest, NextResponse } from "next/server";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You extract opportunity listing data for Patronage (patronage.nz), a cultural infrastructure platform for artists in Aotearoa New Zealand and Australia.

Given raw text from an opportunity page, extract ALL available fields into JSON.

RULES:
- NZ spelling (organisation, programme, recognised, colour)
- caption: one sentence, max 160 chars, plain language, explains what it IS
- full_description: warm, clear, practical. Not institutional jargon.
- Dates: YYYY-MM-DD format
- funding values: include currency e.g. "$5,000 - $25,000 NZD"
- null for missing fields
- For country: output only "NZ", "AUS", or "Global". Map UK/US/EU opportunities that accept international applicants to "Global". Skip entirely if restricted to a single country outside NZ/AUS with no international eligibility.
- For type: use exactly one of "Grant", "Residency", "Commission", "Open Call", "Prize", "Display", "Job / Employment", "Studio / Space", "Public Art"
- For disciplines: suggest from this list but allow custom: Painting, Sculpture, Photography, Ceramics, Digital, Printmaking, Drawing, Textile, Jewellery, Glass, Weaving / Fibre, Film & Video, Performance, Installation, Sound, Mixed Media, Poetry, Writing, Music, Architecture, Design, Multidisciplinary, Public Art
- For career_stage: use from Student, Early Career, Emerging, Mid-Career, Established, All stages
- For tags: freeform array of relevant tags for identity, themes, focus (e.g. Māori, Pasifika, Indigenous, First Nations, Women, LGBTQ+, Disabled artists, International, Site-specific, Environmental, Research, Collaborative, etc.)

Return ONLY valid JSON, no markdown fences:
{
  "title": "string",
  "organisation": "string",
  "caption": "string (max 160 chars)",
  "type": "string",
  "country": "NZ" | "AUS" | "Global",
  "opens_at": "YYYY-MM-DD or null",
  "deadline": "YYYY-MM-DD or null",
  "city": "string or null",
  "funding_range": "string or null",
  "entry_fee": "number or null",
  "disciplines": ["string"],
  "career_stage": ["string"],
  "tags": ["string"],
  "full_description": "string",
  "email": "string or null",
  "application_url": "string or null",
  "type_specific": {}
}`;

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .slice(0, 15000)
    .trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const type = formData.get("type") as string;

  type MessageContent =
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

  let content: MessageContent[];

  if (type === "url") {
    const url = formData.get("url") as string;
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });
    try {
      const pageRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Patronage/1.0; +https://patronage.nz)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
      const html = await pageRes.text();
      const text = stripHtml(html);
      content = [{ type: "text", text: `URL: ${url}\n\n${text}` }];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: `Could not fetch URL: ${msg}` }, { status: 422 });
    }
  } else if (type === "text") {
    const text = formData.get("text") as string;
    if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });
    content = [{ type: "text", text: text.slice(0, 15000) }];
  } else if (type === "file") {
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    content = [{
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    }];
  } else {
    return NextResponse.json({ error: "Invalid type — must be url, text, or file" }, { status: 400 });
  }

  let claudeRes: Response;
  try {
    claudeRes = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Claude API request failed: ${msg}` }, { status: 502 });
  }

  if (!claudeRes.ok) {
    const body = await claudeRes.text().catch(() => "");
    return NextResponse.json({ error: `Claude API error ${claudeRes.status}: ${body.slice(0, 200)}` }, { status: 502 });
  }

  const claudeData = await claudeRes.json();
  const rawText: string = claudeData.content?.[0]?.text ?? "{}";

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Invalid JSON from Claude", raw: rawText.slice(0, 500) }, { status: 502 });
  }
}
