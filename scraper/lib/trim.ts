import * as cheerio from "cheerio";

const MAX_CHARS = 30_000;

// Class/ID name patterns that reliably indicate boilerplate sections
const BOILERPLATE_RE =
  /\b(cookie|gdpr|banner|sidebar|nav(bar)?|main.?menu|site.?menu|footer|header|social(.?(share|links|icons))?|sharing|comment|advert(isement)?|sponsored|popup|modal|overlay|breadcrumb|pagination|widget|alert|notification|announcement|skip.?link|back.?to.?top)\b/i;

/**
 * Strips boilerplate from raw HTML and returns clean plain text suitable for
 * sending to the Claude API. Reduces token usage by ~70–80% on typical pages.
 */
export function trimHtml(rawHtml: string): string {
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

  return root.text().replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
}
