import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

const nextConfig: NextConfig = {
  experimental: {
    // Partial Pre-rendering: static shell served from CDN at near-zero TTFB;
    // user-specific Suspense islands stream in after. Opt individual routes in
    // with `export const experimental_ppr = true` at the route segment level.
    ppr: "incremental",
    // Transforms `import { X } from 'lucide-react'` to direct module paths at
    // build time — avoids loading all 1,500+ icons on every cold start.
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
};

export default nextConfig;
