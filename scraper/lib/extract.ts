import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedOpportunity, RssItem } from "../types.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You extract arts funding opportunities from web content. Return ONLY a valid JSON array.

Each item in the array must have:
- "title": string (name of the opportunity)
- "organiser": string (organisation running it)
- "caption": string (1-2 sentence plain-English summary of what it is)
- "type": one of "Grant" | "Residency" | "Commission" | "Open Call" | "Prize" | "Display"
- "country": the primary country or eligibility — use "NZ", "AUS", "UK", "US", "EU", or "Global"
- "deadline": "YYYY-MM-DD" or null
- "url": direct link to the opportunity page, or null
- "funding_range": e.g. "up to $10,000" or "$5,000–$25,000" or null

Rules:
- Only include genuine arts opportunities (grants, prizes, residencies, open calls, commissions, display opportunities)
- Skip job listings, internships, and non-arts content
- If a page lists multiple opportunities, return all of them
- If no opportunities are found, return []
- Return only the JSON array, no other text`;

export async function extractFromPage(
  text: string,
  sourceUrl: string,
  defaultCountry: string
): Promise<ScrapedOpportunity[]> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Source: ${sourceUrl}\nDefault country if not specified: ${defaultCountry}\n\nContent:\n${text}`,
        },
      ],
    });

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
