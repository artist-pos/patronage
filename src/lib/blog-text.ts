/**
 * Plain-text view of a blog body, for card excerpts and meta descriptions.
 * Figure captions are dropped first — they read as noise spliced mid-sentence.
 */
export function stripBodyHtml(body: string | null): string {
  return (body ?? "")
    .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
