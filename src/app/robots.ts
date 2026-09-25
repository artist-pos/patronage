import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

// Private, account and utility areas. Two things matter about how these are
// written:
//  - A crawler that has its own group below ignores the "*" group entirely, so
//    this list is repeated for every group rather than assumed to be inherited.
//  - Rules match on prefix, and profile URLs are bare usernames at the root.
//    "/studio" would hide an artist called studio_zalimcmahon, so the app's own
//    routes are written with a trailing slash or "$" where a username could
//    share the prefix.
const PRIVATE_PATHS = [
  "/admin",
  "/dashboard",
  "/inbox",
  "/api",
  "/auth/",
  "/onboarding/",
  "/messages/",
  "/notifications$",
  "/chat/",
  "/profile/",
  "/studio$",
  "/studio/",
  "/settings$",
  "/settings/",
  "/partner/",
  // Links that carry a secret token, sent by email.
  "/claim/",
  "/claim-account",
  "/claim-listing/",
  "/invite/",
  "/followup/",
  "/unsubscribe",
  // Post-purchase pages.
  "/sale/",
  "/resale/",
  // Development pages.
  "/dev/",
  "/design-system",
  // Draft, unlinked until rewritten.
  "/about",
];

const PUBLIC_API = ["/api/public/opportunities", "/api/public/artists"];

// Crawlers that feed AI search and assistants, named so the permission is
// explicit rather than implied by "*".
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", ...PUBLIC_API], disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: ["/", ...PUBLIC_API], disallow: PRIVATE_PATHS },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/sitemap-artists.xml`,
      `${BASE_URL}/sitemap-organisations.xml`,
      `${BASE_URL}/sitemap-opportunities.xml`,
      `${BASE_URL}/sitemap-blog.xml`,
    ],
  };
}
