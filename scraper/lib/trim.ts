import * as cheerio from "cheerio";

const MAX_CHARS = 30_000;

// Class/ID name patterns that reliably indicate boilerplate sections.
// NOTE: bare "widget" is a trap — Elementor wraps ALL page content in
// `elementor-widget-*` classes, so matching it deletes entire sites.
// Only match widget in explicitly peripheral compounds.
const BOILERPLATE_RE =
  /\b(cookie|gdpr|banner|sidebar|nav(bar)?|main.?menu|site.?menu|footer|header|social(.?(share|links|icons))?|sharing|comment|advert(isement)?|sponsored|popup|modal|overlay|breadcrumb|pagination|widget.?area|sidebar.?widget|footer.?widget|alert|notification|announcement|skip.?link|back.?to.?top)\b/i;

/**
 * Strips boilerplate from raw HTML and returns clean plain text suitable for
 * sending to the Claude API. Reduces token usage by ~70–80% on typical pages.
 */
export function trimHtml(rawHtml: string): string {
  // Untrimmed body text, kept as a fallback in case the class-based stripping
  // proves too aggressive on this page (framework-generated class names).
  const $full = cheerio.load(rawHtml);
  $full("script, style, noscript, iframe").remove();
  const fullText = $full("body").text().replace(/\s+/g, " ").trim();

  const $ = cheerio.load(rawHtml);

  // 1. Remove boilerplate by element tag
  $(
    "script, style, noscript, iframe, nav, footer, header, aside, figure > figcaption"
  ).remove();
  $(
    "[role='navigation'], [role='banner'], [role='complementary'], " +
    "[role='search'], [role='dialog'], [role='alertdialog']"
  ).remove();

  // 2. Remove hidden elements
  $('[aria-hidden="true"], [hidden]').remove();

  // 3. Remove elements whose class or id look like boilerplate
  //    (iterate [class] and [id] attributes separately — cheaper than $("*"))
  $("[class]").each((_, el) => {
    if (BOILERPLATE_RE.test($(el).attr("class") ?? "")) $(el).remove();
  });
  $("[id]").each((_, el) => {
    if (BOILERPLATE_RE.test($(el).attr("id") ?? "")) $(el).remove();
  });

  // 4. Prefer a main content region; fall back to <body>
  const main = $(
    "main, [role='main'], article, " +
      ".content, .main-content, .post-content, .entry-content, " +
      ".page-content, .article-body, .article-content, " +
      "#main, #content, #main-content"
  ).first();

  const root = main.length > 0 ? main : $("body");

  const trimmed = root.text().replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);

  // Over-trim guard: if stripping left almost nothing but the page clearly has
  // content, the boilerplate heuristics ate the page — serve the full text.
  if (trimmed.length < 300 && fullText.length > 600) {
    return fullText.slice(0, MAX_CHARS);
  }
  return trimmed;
}
