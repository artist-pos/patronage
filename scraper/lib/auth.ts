/**
 * scraper/utils/auth.ts
 * 
 * Two things:
 * 1. Cookie injection for authenticated sites (opencallforartists.com, artinfoland.com)
 * 2. Better headers for government sites returning 403
 * 
 * SETUP (one-time, repeat when cookies expire every 2-4 weeks):
 * 
 *   1. Install the "EditThisCookie" or "Cookie-Editor" browser extension
 *   2. Log into opencallforartists.com with your Google account in Chrome
 *   3. Click the cookie extension → Export → Copy as JSON
 *   4. Paste into scraper/cookies/opencallforartists.json
 *   5. Repeat for artinfoland.com → scraper/cookies/artinfoland.json
 * 
 *   Or use the built-in cookie extractor below (run once):
 *   npx tsx scraper/utils/auth.ts extract opencallforartists.com
 * 
 * The government 403s don't need cookies — they just need realistic headers.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Page, BrowserContext } from "playwright";

// ============================================================
// TYPES
// ============================================================

interface CookieEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface SiteAuth {
  cookies: CookieEntry[];
  exportedAt: string;
  site: string;
}

// ============================================================
// COOKIE STORAGE
// ============================================================

const COOKIE_DIR = join(process.cwd(), "scraper", "cookies");

function ensureCookieDir() {
  if (!existsSync(COOKIE_DIR)) {
    mkdirSync(COOKIE_DIR, { recursive: true });
  }
}

function cookiePath(site: string): string {
  const safe = site.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return join(COOKIE_DIR, `${safe}.json`);
}

/**
 * Load saved cookies for a site.
 * Returns null if no cookies found or they're expired.
 */
export function loadCookies(site: string): CookieEntry[] | null {
  const path = cookiePath(site);
  if (!existsSync(path)) {
    console.log(`  ⚠ No cookies found for ${site} — run cookie export first`);
    return null;
  }

  try {
    const data: SiteAuth = JSON.parse(readFileSync(path, "utf-8"));
    
    // Check if cookies are older than 14 days
    const exportedAt = new Date(data.exportedAt).getTime();
    const daysSinceExport = (Date.now() - exportedAt) / (1000 * 60 * 60 * 24);
    
    if (daysSinceExport > 14) {
      console.log(`  ⚠ Cookies for ${site} are ${Math.round(daysSinceExport)} days old — may need refresh`);
    }

    return data.cookies;
  } catch {
    console.log(`  ⚠ Failed to parse cookies for ${site}`);
    return null;
  }
}

/**
 * Save cookies exported from a browser session.
 */
export function saveCookies(site: string, cookies: CookieEntry[]) {
  ensureCookieDir();
  const data: SiteAuth = {
    cookies,
    exportedAt: new Date().toISOString(),
    site,
  };
  writeFileSync(cookiePath(site), JSON.stringify(data, null, 2));
  console.log(`  ✓ Saved ${cookies.length} cookies for ${site}`);
}

// ============================================================
// PLAYWRIGHT COOKIE INJECTION
// ============================================================

/**
 * Inject saved cookies into a Playwright browser context.
 * Call this BEFORE navigating to the page.
 * 
 * Usage in your scraper's browser fetcher:
 *   const context = await browser.newContext();
 *   await injectCookies(context, 'opencallforartists.com');
 *   const page = await context.newPage();
 *   await page.goto(url);
 */
export async function injectCookies(context: BrowserContext, site: string): Promise<boolean> {
  const cookies = loadCookies(site);
  if (!cookies) return false;

  // Convert to Playwright cookie format
  const playwrightCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || "/",
    expires: c.expires || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: (c.sameSite || "Lax") as "Strict" | "Lax" | "None",
  }));

  await context.addCookies(playwrightCookies);
  return true;
}

// ============================================================
// AXIOS COOKIE INJECTION
// ============================================================

/**
 * Get a cookie header string for use with Axios/Cheerio requests.
 * 
 * Usage:
 *   const cookieHeader = getCookieHeader('artinfoland.com');
 *   const response = await axios.get(url, { 
 *     headers: { ...REALISTIC_HEADERS, Cookie: cookieHeader } 
 *   });
 */
export function getCookieHeader(site: string): string | null {
  const cookies = loadCookies(site);
  if (!cookies) return null;
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

// ============================================================
// REALISTIC HEADERS — fixes government 403s
// ============================================================

/**
 * Headers that make requests look like a real browser.
 * Most government 403s are just blocking default axios/node-fetch user-agents.
 * 
 * Usage:
 *   import { REALISTIC_HEADERS } from './auth.js';
 *   const response = await axios.get(url, { headers: REALISTIC_HEADERS });
 */
export const REALISTIC_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-NZ,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/**
 * Headers for RSS feed requests.
 */
export const RSS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
  "Accept-Language": "en-NZ,en;q=0.9",
};

// ============================================================
// SITE-SPECIFIC CONFIG
// ============================================================

interface AuthenticatedSite {
  domain: string;
  needsCookies: boolean;
  needsBrowser: boolean;
  notes: string;
}

/**
 * Registry of sites that need special handling.
 * Check this in your fetcher to decide how to handle each source.
 */
export const AUTHENTICATED_SITES: AuthenticatedSite[] = [
  {
    domain: "opencallforartists.com",
    needsCookies: true,
    needsBrowser: true, // JS-heavy site
    notes: "Google auth. Export cookies after manual login.",
  },
  {
    domain: "artinfoland.com",
    needsCookies: true,
    needsBrowser: false, // Static enough for axios
    notes: "$5/mo subscription. Google auth. Export cookies after manual login.",
  },
  {
    domain: "artworkarchive.com",
    needsCookies: false,
    needsBrowser: false,
    notes: "No account needed. Just needs realistic headers to avoid 403.",
  },
];

/**
 * Sites that return 403 but just need realistic headers (no auth required).
 */
export const HEADER_FIX_DOMAINS: string[] = [
  // NZ Government & Council
  "arts.sa.gov.au",
  "arts.act.gov.au",
  "mch.govt.nz",
  "wellington.govt.nz",
  "nga.gov.au",
  "citygallery.org.nz",
  "sounz.org.nz",
  "dowse.org.nz",
  "otago.ac.nz",
  "bookcouncil.org.nz",
  // Australian
  "apraamcos.com.au",
  "artguide.com.au",
  // UK
  "a-n.co.uk",
];

/**
 * Check if a URL needs special header handling.
 */
export function needsRealisticHeaders(url: string): boolean {
  return HEADER_FIX_DOMAINS.some((domain) => url.includes(domain));
}

/**
 * Check if a URL needs cookie injection.
 */
export function needsCookieAuth(url: string): AuthenticatedSite | null {
  return AUTHENTICATED_SITES.find((site) => url.includes(site.domain)) ?? null;
}

/**
 * Get the appropriate headers for a URL.
 * Combines realistic headers with cookies if needed.
 */
export function getHeadersForUrl(url: string): Record<string, string> {
  const headers = { ...REALISTIC_HEADERS };
  
  const authSite = needsCookieAuth(url);
  if (authSite?.needsCookies) {
    const cookieHeader = getCookieHeader(authSite.domain);
    if (cookieHeader) {
      (headers as any)["Cookie"] = cookieHeader;
    }
  }

  return headers;
}

// ============================================================
// INTERACTIVE COOKIE EXTRACTOR
// ============================================================

/**
 * Opens a real browser window for you to log in manually.
 * After you log in, press Enter in the terminal and cookies are saved.
 * 
 * Usage: npx tsx scraper/utils/auth.ts extract opencallforartists.com
 */
async function extractCookiesInteractive(site: string) {
  const { chromium } = await import("playwright");
  
  console.log(`\n🔐 Cookie Extractor for ${site}`);
  console.log(`   A browser window will open.`);
  console.log(`   Log in with your Google account (blakeaitkenwork@gmail.com).`);
  console.log(`   Once logged in, come back here and press Enter.\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the site
  const url = site.startsWith("http") ? site : `https://${site}`;
  await page.goto(url);
  
  // Wait for user to log in
  console.log(`   Browser opened at ${url}`);
  console.log(`   Press Enter after you've logged in...`);
  
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });
  
  // Extract cookies
  const cookies = await context.cookies();
  
  // Save
  saveCookies(site, cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite as any,
  })));
  
  await browser.close();
  console.log(`\n✓ Done. Cookies saved to ${cookiePath(site)}`);
  console.log(`  Re-run this in 2 weeks when cookies expire.\n`);
}

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);
if (args[0] === "extract" && args[1]) {
  extractCookiesInteractive(args[1]).catch(console.error);
}
