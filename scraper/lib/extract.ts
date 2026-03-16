import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedOpportunity, RssItem } from "../types.js";
import { withRateLimit, estimateTokens } from "./rate-limiter.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You extract arts funding opportunities from web content. Return ONLY a valid JSON array.

Each item in the array must have:
- "title": string (name of the opportunity)
- "organiser": string (organisation running it)
- "caption": string — 250–500 character plain-English summary. Include: what it is, who it's for, what's offered, and any eligibility highlights. Write in third person, no markdown.
- "type": one of "Grant" | "Residency" | "Commission" | "Open Call" | "Prize" | "Display"
- "country": the primary country or eligibility — use "NZ", "AUS", "UK", "US", "EU", or "Global"
- "opens_at": "YYYY-MM-DD" if the application window hasn't opened yet (i.e. a future open date is explicitly stated), otherwise null
- "deadline": "YYYY-MM-DD" or null
- "url": direct link to the opportunity page, or null
- "funding_range": e.g. "up to $10,000" or "$5,000–$25,000" or null
- "sub_categories": string array of relevant discipline and focus tags. Include applicable mediums (e.g. "Painting", "Sculpture", "Photography", "Ceramics", "Digital", "Printmaking", "Drawing", "Textile", "Film & Video", "Performance", "Installation", "Sound", "Poetry", "Writing", "Mixed Media") and focus tags (e.g. "Early Career", "Emerging", "Mid-Career", "Established", "Māori", "Pasifika", "Indigenous", "Youth", "International", "Travel", "Research"). Only include tags clearly supported by the content. Return [] if none apply.
- "disciplines": string array of primary discipline tags. Use ONLY values from this list: "visual_art", "music", "poetry", "writing", "dance", "film", "photography", "craft", "performance", "other". Include all that clearly apply to this specific opportunity. Return [] if the opportunity is genuinely cross-disciplinary or the discipline cannot be determined.

Rules:
- Only include genuine arts opportunities (grants, prizes, residencies, open calls, commissions, display opportunities)
- Only include opportunities open to individual artists or small artist collectives. Skip opportunities exclusively for established organisations, institutions, libraries, museums, universities, local councils, or corporate bodies
- Skip job listings, internships, volunteer roles, and non-arts content
- Skip opportunities where eligibility is restricted to a specific institution's own members, students, or staff
- ELIGIBILITY FILTER — this platform serves NZ and Australian artists. For the "country" field, use eligibility not location of the organiser:
  * "Global" — open to international applicants with no residency/citizenship requirement, OR the opportunity uses phrases like "open to all", "international artists welcome", "worldwide", "any nationality", or similar
  * "NZ" — explicitly for NZ-based artists/residents
  * "AUS" — explicitly for Australia-based artists/residents
  * "UK" — requires UK residency, citizenship, or institutional affiliation
  * "US" — requires US residency, citizenship, or visa status
  * "EU" — requires EU residency or citizenship
  * SKIP the opportunity entirely if it requires residency/citizenship in a specific country outside NZ/AUS and makes no mention of international eligibility
  * When unsure, prefer "Global" over a country code — many US/EU/UK prizes and residencies accept international applicants even if their organiser is local
- If a page lists multiple opportunities, return all of them (applying the eligibility filter to each)
- If no opportunities are found, return []
- Return only the JSON array, no other text`;

export async function extractFromPage(
  text: string,
  sourceUrl: string,
  defaultCountry: string
): Promise<ScrapedOpportunity[]> {
  const prompt = `Source: ${sourceUrl}\nDefault country if not specified: ${defaultCountry}\n\nContent:\n${text}`;
  const estimated = estimateTokens(prompt);

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
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as ScrapedOpportunity[];
    return parsed.filter((o) => o.title && o.organiser);
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
