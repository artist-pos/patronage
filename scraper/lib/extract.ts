import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedOpportunity, RssItem } from "../types.js";
import { withRateLimit, estimateTokens } from "./rate-limiter.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================
// UPGRADED SYSTEM PROMPT
// 
// Changes from original:
// 1. Added relevance filter — skips commercial jobs, production crew, corporate roles
// 2. Added missing opp types: "Job / Employment", "Studio / Space", "Public Art"
// 3. Country outputs only "NZ" | "AUS" | "Global" (no UK/US/EU that break the DB enum)
// 4. Better caption guidance — shorter, warmer, NZ spelling
// 5. sub_categories as freeform tags (no fixed list constraint)
// 6. Explicit instruction to output valid JSON (fixes Haiku parse errors)
// ============================================================

const SYSTEM = `You extract arts opportunities from web content for Patronage (patronage.nz), a platform serving artists in Aotearoa New Zealand and Australia.

Return ONLY a valid JSON array. No markdown fences, no explanation, no trailing commas.

RELEVANCE FILTER — apply BEFORE extracting:
- YES: grants, prizes, residencies, open calls, commissions, exhibitions, public art opportunities, studio/space access, fellowships for individual artists or small collectives
- NO: commercial job listings (marketing manager, gallery director, production coordinator), internships, volunteer roles, institutional funding for organisations/councils/universities, calls restricted to a specific institution's own students/staff/members, film/TV production crew calls, corporate sponsorship opportunities
- If unsure, include it but set "confidence" to "low"
- If a page has NO relevant opportunities, return []

Each item in the array:
{
  "title": "string — name of the opportunity",
  "organiser": "string — organisation running it",
  "caption": "string — one to two sentences, max 300 characters. Plain language, NZ spelling. What it is, who it's for, what's offered. No markdown, no jargon.",
  "type": "Grant" | "Residency" | "Commission" | "Open Call" | "Prize" | "Display" | "Job / Employment" | "Studio / Space" | "Public Art",
  "country": "NZ" | "AUS" | "Global",
  "opens_at": "YYYY-MM-DD or null — only if a future open date is explicitly stated",
  "deadline": "YYYY-MM-DD or null",
  "url": "direct link to the opportunity page, or null",
  "funding_range": "e.g. 'Up to $10,000 NZD' or '$5,000–$25,000' or null",
  "sub_categories": ["string array — relevant tags for discipline, medium, career stage, identity, focus. Include whatever applies from the content. Examples: Painting, Sculpture, Photography, Ceramics, Digital, Printmaking, Drawing, Textile, Film & Video, Performance, Installation, Sound, Poetry, Writing, Mixed Media, Early Career, Emerging, Mid-Career, Established, Māori, Pasifika, Indigenous, First Nations, Youth, Women, LGBTQ+, International, Travel, Research, Community, Environmental, Public Art, Experimental. Add any other relevant tags not in this list."],
  "disciplines": ["string array from: visual_art, music, poetry, writing, dance, film, photography, craft, performance, other"],
  "confidence": "high" | "medium" | "low"
}

COUNTRY RULES — use eligibility, not organiser location:
- "Global" — open to international applicants, OR uses phrases like "open to all", "international artists welcome", "worldwide", "any nationality". Also use "Global" for US/UK/EU opportunities that accept international applicants.
- "NZ" — explicitly restricted to NZ-based artists, residents, or citizens
- "AUS" — explicitly restricted to Australia-based artists, residents, or citizens
- SKIP entirely if restricted to a single country outside NZ/AUS with no international eligibility
- When unsure, use "Global" — many prizes and residencies accept international applicants even if their organiser is in a specific country

CAPTION STYLE — NZ spelling (organisation, programme, recognised):
GOOD: "Three-month residency in Titirangi with a $10,000 stipend. Open to NZ visual artists at any career stage."
BAD: "Applications are invited for the 2026 iteration of the prestigious XYZ Programme, offering selected artists the opportunity to..."

TYPE MAPPING:
- Grant/fellowship/funding for projects → "Grant"
- Artist residency/retreat/studio time → "Residency"
- Paid commission/brief → "Commission"
- Exhibition submission/group show call → "Open Call"
- Prize/award/competition with monetary prize → "Prize"
- Exhibition/display/showcase (no competition) → "Display"
- Paid role for an artist (teaching, artist-in-residence employment, community arts worker) → "Job / Employment"
- Studio access, workshop space, shared facility → "Studio / Space"
- Public artwork/mural/installation commission → "Public Art"

If a page lists multiple opportunities, return all of them (applying filters to each).
Return ONLY the JSON array.`;

export async function extractFromPage(
    text: string,
    sourceUrl: string,
    defaultCountry: string
): Promise<ScrapedOpportunity[]> {
    // Truncate to ~12k chars to stay within context limits while allowing more content than before
    const truncated = text.slice(0, 12000);
    const prompt = `Source: ${sourceUrl}\nDefault country if not specified: ${mapCountryForPrompt(defaultCountry)}\n\nContent:\n${truncated}`;
    const estimated = estimateTokens(prompt);

    try {
        const response = await withRateLimit(
            () =>
                client.messages.create({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 4096,
                    system: SYSTEM,
                    messages: [{ role: "user", content: prompt }],
                }),
            estimated
        );

        const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";

        // Extract JSON array — handle potential markdown fences from Sonnet
        let jsonStr = raw;

        // Strip markdown fences if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

        // Find the JSON array
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const parsed = JSON.parse(jsonMatch[0]) as (ScrapedOpportunity & { confidence?: string })[];

        return parsed
            // Must have title and organiser
            .filter((o) => o.title && o.organiser)
            // Filter out low-confidence items (the AI wasn't sure it's a real opportunity)
            .filter((o) => o.confidence !== "low")
            // Map country to DB-safe values
            .map((o) => ({
                ...o,
                country: mapCountryForDb(o.country),
                // Ensure caption doesn't exceed DB limit
                caption: o.caption?.slice(0, 400) ?? null,
            }));
    } catch (err) {
        console.error(`  Extract error for ${sourceUrl}:`, err instanceof Error ? err.message : err);
        return [];
    }
}

export async function extractFromRssItem(
    item: RssItem,
    sourceUrl: string,
    defaultCountry: string
): Promise<ScrapedOpportunity[]> {
    const content = `Title: ${item.title}\nLink: ${item.link}\nDate: ${item.pubDate}\nContent: ${item.content}`;
    return extractFromPage(content, sourceUrl, defaultCountry);
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Map any country value to the three DB-safe values.
 * UK, US, EU opportunities that made it past the relevance filter
 * are open to international applicants, so they become "Global".
 */
function mapCountryForDb(country: string): string {
    const upper = country?.toUpperCase?.() ?? "Global";
    if (upper === "NZ") return "NZ";
    if (upper === "AUS" || upper === "AU") return "AUS";
    return "Global"; // UK, US, EU, and anything else → Global
}

/**
 * Map source-level country hint to prompt-friendly value.
 */
function mapCountryForPrompt(country: string): string {
    const upper = country?.toUpperCase?.() ?? "Global";
    if (upper === "NZ") return "NZ";
    if (upper === "AUS" || upper === "AU") return "AUS";
    return "Global";
}