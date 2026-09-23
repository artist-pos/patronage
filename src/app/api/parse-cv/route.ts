import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You extract a short artist bio, exhibition history, and press/bibliography entries from a CV/résumé PDF, for Patronage (patronage.nz), a platform for artists in Aotearoa New Zealand and Australia.

RULES:
- NZ spelling (organisation, programme, recognised, colour)
- bio: 2-4 sentences, third person, plain language — not a list of achievements, a short practice statement drawn from what the CV shows
- exhibition_history: every solo/group exhibition, show, or residency you can find, most recent reasonable guess first
- type: "Solo" if the artist was the only exhibitor, else "Group"
- press_bibliography: every review, interview, feature, essay or article ABOUT the artist that the CV lists (not exhibitions) — only if the CV actually has a press/publications/bibliography section
- date: as given (a year, or a fuller date if the CV gives one)
- link: only if the CV actually includes a URL for that entry, else ""
- year: the 4-digit year as a number; if a range, use the start year
- Leave any field empty/[] rather than inventing anything not actually in the document

Return ONLY valid JSON, no markdown fences:
{
  "bio": "string",
  "exhibition_history": [
    { "type": "Solo" | "Group", "title": "string", "venue": "string", "location": "string", "year": number }
  ],
  "press_bibliography": [
    { "type": "Review" | "Interview" | "Feature" | "Essay" | "Article", "author": "string", "title": "string", "publication": "string", "date": "string", "link": "string" }
  ]
}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const ip = await getClientIp();
  // Per-user AND per-IP — a compromised account shouldn't be able to run up
  // Claude API costs just because it passed auth once.
  const [okUser, okIp] = await Promise.all([
    checkRateLimit(`parse-cv:user:${user.id}`, 5, 3600),
    checkRateLimit(`parse-cv:ip:${ip}`, 10, 3600),
  ]);
  if (!okUser || !okIp) {
    return NextResponse.json(
      { error: "Too many CV uploads — try again in a bit." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

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

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large — maximum 10 MB." }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  const magic = new Uint8Array(buffer.slice(0, 4));
  const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46;
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 415 });
  }

  const base64 = Buffer.from(buffer).toString("base64");

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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [{
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          }],
        }],
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
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      bio?: string;
      exhibition_history?: Array<{ type: string; title: string; venue: string; location: string; year: number }>;
      press_bibliography?: Array<{ type: string; author: string; title: string; publication: string; date: string; link: string }>;
    };
    return NextResponse.json({
      bio: parsed.bio ?? "",
      exhibition_history: Array.isArray(parsed.exhibition_history) ? parsed.exhibition_history : [],
      press_bibliography: Array.isArray(parsed.press_bibliography) ? parsed.press_bibliography : [],
    });
  } catch {
    return NextResponse.json({ error: "Couldn't read that CV — try a different file." }, { status: 502 });
  }
}
