import type { ImageOrientation } from "@/types/database";

/**
 * Classify pixel dimensions into a display orientation bucket.
 * landscape → 16/9  |  portrait → 3/4  |  square → 1/1
 */
export function detectOrientation(width: number, height: number): ImageOrientation {
  const ratio = width / height;
  if (ratio >= 1.2) return "landscape";
  if (ratio <= 0.85) return "portrait";
  return "square";
}

/** Tailwind aspect-ratio class for a stored orientation (or square fallback). */
export function orientationClass(orientation: ImageOrientation | null | undefined): string {
  if (orientation === "landscape") return "aspect-video";
  if (orientation === "portrait") return "aspect-[3/4]";
  return "aspect-square";
}

/**
 * Converts a Supabase Storage object URL to its image render/transform URL.
 * Falls back to the original URL for non-Supabase URLs.
 *
 * Supabase transform endpoint:
 * /storage/v1/object/public/... → /storage/v1/render/image/public/...
 * with optional ?width= and ?quality= params.
 */
export function supabaseTransform(
  url: string | null | undefined,
  opts: { width?: number; quality?: number } = {}
): string | null {
  if (!url) return null;

  const transformed = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );

  // Not a Supabase object URL — return as-is
  if (transformed === url) return url;

  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.quality) params.set("quality", String(opts.quality));
  return params.size > 0 ? `${transformed}?${params}` : transformed;
}
