/**
 * Parse a funding_range text string into a number in NZD-ish terms.
 * Takes the lower bound of a range, handles k/K shorthand and common
 * currency symbols/codes. Returns null if nothing parseable is found.
 *
 * Examples:
 *   "$5,000 – $15,000"  → 5000
 *   "Up to NZD 50,000"  → 50000
 *   "€2,500"            → 2500
 *   "£10k"              → 10000
 *   "AUD 20,000–30,000" → 20000
 *   "Varies"            → null
 *
 * No server dependencies (unlike lib/opportunities.ts) so client components
 * can import it — e.g. for client-side sort logic — without pulling
 * next/headers into the browser bundle.
 */
export function parseFundingText(text: string | null | undefined): number | null {
  if (!text) return null;
  // Strip currency codes and symbols so they don't interfere with number parsing
  const cleaned = text
    .replace(/\b(NZD|AUD|USD|GBP|EUR|CAD|SGD|HKD|JPY|CHF)\b/gi, "")
    .replace(/[$€£¥₹¢]/g, "");

  // Find all numeric tokens (handles commas and k/K suffix)
  const matches = cleaned.match(/[\d,]+(?:\.\d+)?k?/gi);
  if (!matches || matches.length === 0) return null;

  const values = matches.map((m) => {
    const isK = /k$/i.test(m);
    const num = parseFloat(m.replace(/,/g, "").replace(/k$/i, ""));
    return isK ? num * 1000 : num;
  }).filter((n) => !isNaN(n) && n > 0);

  if (values.length === 0) return null;
  // Use the lower bound (first / smallest value) to stay conservative
  return Math.min(...values);
}
