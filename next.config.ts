import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

const securityHeaders = [
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// /embed/* routes are the embeddable iframe surface. Drop X-Frame-Options
// (so any host can frame the page) and use CSP frame-ancestors as a modern
// equivalent. Other security headers stay.
const embedHeaders = [
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy",   value: "frame-ancestors *" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Transforms `import { X } from 'lucide-react'` to direct module paths at
    // build time — avoids loading all 1,500+ icons on every cold start.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    remotePatterns: [
      ...(supabaseHostname ? [{ protocol: "https" as const, hostname: supabaseHostname }] : []),
      { protocol: "https", hostname: "*.cloudfront.net" },
      // Opportunity hero images come from 50+ scraped external domains — allow
      // all HTTPS origins so Next.js can convert to WebP/AVIF and cache them.
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      // Legacy/marketing URLs still hit by crawlers and cached links. Redirect
      // to the closest current page instead of falling through to the
      // [username] catch-all (which would render a misleading profile 404).
      { source: "/core-features", destination: "/", permanent: true },
      { source: "/market-opportunity", destination: "/opportunities", permanent: true },
      // /support was renamed /patrons; keeps old links and in-flight Stripe return URLs working.
      { source: "/support", destination: "/patrons", permanent: true },
      { source: "/support/:path*", destination: "/patrons/:path*", permanent: true },
      // The v2 previews became the real pages (Sept 2026); shared preview links land on them.
      { source: "/home-v2", destination: "/", permanent: true },
      { source: "/artists-v2", destination: "/artists", permanent: true },
      { source: "/partners-v2", destination: "/partners", permanent: true },
      { source: "/opportunities-v2", destination: "/opportunities", permanent: true },
      { source: "/feed-v2", destination: "/feed", permanent: true },
      // Explore’s old in-page works tab; For sale now lives at /works (query carried over).
      {
        source: "/feed",
        has: [{ type: "query", key: "tab", value: "works" }],
        destination: "/works",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // Negative-lookahead matcher so /embed routes don't inherit
      // X-Frame-Options: DENY from the catch-all.
      {
        source: "/((?!embed/).*)",
        headers: securityHeaders,
      },
      {
        source: "/embed/:path*",
        headers: embedHeaders,
      },
    ];
  },
};

export default nextConfig;
