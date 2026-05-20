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
  async rewrites() {
    return [
      { source: "/works", destination: "/feed?tab=works" },
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
