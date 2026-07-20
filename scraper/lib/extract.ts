import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedOpportunity, RssItem } from "../types.js";
import { withRateLimit, estimateTokens } from "./rate-limiter.js";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Anthropic API credits exhausted — add credits and re-run");
    this.name = "InsufficientCreditsError";
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Run-wide extraction tally. `extractFromPage` swallows per-page failures and
 * returns [] so one bad page doesn't abort a source — but a run where *every*
 * call fails (e.g. an API/connection outage) would otherwise report "Done" with
 * 0 inserts and a green CI job. run.ts reads these to fail the run loudly when
 * the failure rate is high. See run.ts summary.
 */
export const extractStats = { attempts: 0, failures: 0, geoDropped: 0 };

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
- If unsure about anything other than geography, include it but set "confidence" to "low"
- If a page has NO relevant opportunities, return []

GEOGRAPHY — Patronage serves artists based in NZ and Australia. An opportunity is only useful if such an artist can actually enter. Classify every opportunity's "geo_eligibility":
- "nz" — restricted to NZ-based artists, residents, or citizens
- "aus" — restricted to Australia-based artists, residents, or citizens
- "worldwide_explicit" — the page explicitly states international eligibility: "international", "worldwide", "open to all artists", "any nationality", "artists from anywhere", or an explicit list of eligible countries that includes NZ or Australia
- "worldwide_likely" — no residency/citizenship restriction stated anywhere, AND entry/submission is fully online (digital images, online form, email), AND nothing ties participation to being physically present in one region
- "local_only" — ANY of the following, regardless of what else the page says:
  * residency or citizenship restricted to a single country/state/region other than NZ/AUS ("US residents", "UK-based artists", "artists of the Pacific Northwest")
  * work must be hand-delivered or dropped off, or collected in person, with no mention of shipped/international entries
  * a community/regional show, fair, festival, or guild exhibition serving one locality (county shows, city art trails, member exhibitions)
  * a job, teaching role, or paid position located outside NZ/Australia
  * funding from a national arts body available only to that country's residents (e.g. Arts Council England, Creative Scotland funds)
- DO NOT EXTRACT "local_only" opportunities at all — leave them out of the array entirely.
- Organiser being based in the US/UK/EU is NOT evidence of international eligibility. Without explicit signals, prefer "local_only" over "worldwide_likely" for gallery shows and juried exhibitions; physical group shows are usually local affairs.

Each item in the array:
{
  "title": "string — name of the opportunity",
  "organiser": "string — organisation running it",
  "caption": "string — one to two sentences, max 300 characters. Plain language, NZ spelling. What it is, who it's for, what's offered. No markdown, no jargon.",
  "type": "Grant" | "Residency" | "Commission" | "Open Call" | "Prize" | "Display" | "Job / Employment" | "Studio / Space" | "Public Art",
  "country": "NZ" | "AUS" | "Global",
  "opens_at": "YYYY-MM-DD or null — only if a future open date is explicitly stated",
  "deadline": "YYYY-MM-DD or null",
  "url": "direct link to the opportunity page, or null — if the content includes an outbound link to the organiser's own application page, return that URL instead of the page URL you're reading",
  "funding_range": "e.g. 'Up to $10,000 NZD' or '$5,000–$25,000' or null",
  "full_description": "Structured plain-text description for the detail page. Use short section headings on their own line, always ending with a colon (e.g. 'Eligibility:', 'Prize:', 'How to Apply:', 'About the Residency:', 'Who can apply:'). Headings must be Title Case followed by colon — never ALL CAPS, never without colon. Write content after each heading as plain text on the next line(s). No markdown bold/italic. Max 1500 characters. Null if the source page has no substantive detail beyond the caption.",
  "sub_categories": ["string array — relevant tags for discipline, medium, career stage, identity, focus. Include whatever applies from the content. Examples: Painting, Sculpture, Photography, Ceramics, Digital, Printmaking, Drawing, Textile, Film & Video, Performance, Installation, Sound, Poetry, Writing, Mixed Media, Early Career, Emerging, Mid-Career, Established, Māori, Pasifika, Indigenous, First Nations, Youth, Women, LGBTQ+, International, Travel, Research, Community, Environmental, Public Art, Experimental. Add any other relevant tags not in this list."],
  "disciplines": ["string array from: visual_art, music, poetry, writing, dance, film, photography, craft, performance, other"],
  "geo_eligibility": "nz" | "aus" | "worldwide_explicit" | "worldwide_likely",
  "confidence": "high" | "medium" | "low"
}

COUNTRY RULES — derive from geo_eligibility, never from organiser location:
- geo_eligibility "nz" → country "NZ"
- geo_eligibility "aus" → country "AUS"
- geo_eligibility "worldwide_explicit" or "worldwide_likely" → country "Global"

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

export interface ExtractOptions {
    /**
     * Source is dominated by local/regional listings (US show platforms, UK
     * aggregators): keep only opportunities with EXPLICIT international
     * eligibility (or NZ/AUS), dropping "worldwide_likely" inferences.
     */
    strictGeo?: boolean;
}

type ParsedOpp = ScrapedOpportunity & { confidence?: string; geo_eligibility?: string };

/**
 * Post-parse gate for extracted opportunities. Pure — exported for tests.
 */
export function applyExtractionFilters(parsed: ParsedOpp[], opts: ExtractOptions = {}): ScrapedOpportunity[] {
    return parsed
        // Must have title and organiser
        .filter((o) => o.title && o.organiser)
        // The AI wasn't sure it's a real opportunity
        .filter((o) => o.confidence !== "low")
        // Geo gate: local-only should never have been emitted, but drop any
        // stragglers; under strictGeo an unstated-eligibility inference isn't
        // good enough — demand explicit evidence (or NZ/AUS eligibility).
        .filter((o) => {
            const geo = o.geo_eligibility ?? "";
            const keep = geo === "local_only"
                ? false
                : opts.strictGeo
                    ? geo === "worldwide_explicit" || geo === "nz" || geo === "aus"
                    : true;
            if (!keep) extractStats.geoDropped++;
            return keep;
        })
        // Map country to DB-safe values
        .map((o) => ({
            ...o,
            country: mapCountryForDb(o.country),
            // Ensure caption doesn't exceed DB limit
            caption: o.caption?.slice(0, 400) ?? null,
        }));
}

export async function extractFromPage(
    text: string,
    sourceUrl: string,
    defaultCountry: string,
    opts: ExtractOptions = {}
): Promise<ScrapedOpportunity[]> {
    // Truncate to ~12k chars to stay within context limits while allowing more content than before
    const truncated = text.slice(0, 12000);
    const prompt = `Source: ${sourceUrl}\nDefault country if not specified: ${mapCountryForPrompt(defaultCountry)}\n\nContent:\n${truncated}`;
    const estimated = estimateTokens(prompt);

    extractStats.attempts++;
    try {
        const response = await withRateLimit(
            () =>
                client.messages.create({
                    model: "claude-haiku-4-5-20251001",
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

        const parsed = JSON.parse(jsonMatch[0]) as ParsedOpp[];
        return applyExtractionFilters(parsed, opts);
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        // Credit exhaustion is fatal for the whole run — propagate immediately
        if (msg.includes("credit balance is too low")) {
            throw new InsufficientCreditsError();
        }
        extractStats.failures++;
        console.error(`  Extract error for ${sourceUrl}:`, msg);
        return [];
    }
}

export async function extractFromRssItem(
    item: RssItem,
    sourceUrl: string,
    defaultCountry: string,
    opts: ExtractOptions = {}
): Promise<ScrapedOpportunity[]> {
    const content = `Title: ${item.title}\nLink: ${item.link}\nDate: ${item.pubDate}\nContent: ${item.content}`;
    return extractFromPage(content, sourceUrl, defaultCountry, opts);
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