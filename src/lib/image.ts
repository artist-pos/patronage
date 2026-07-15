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
 * Best `src` for a grid/feed tile, in priority order:
 *   1. the pre-generated thumbnail (a static CDN file, produced at upload time by
 *      our own compressor — free + fast),
 *   2. the stored original (already compressed to WebP on upload).
 *
 * We deliberately do NOT use Supabase's render/image transform endpoint: every
 * stored object is already resized + re-encoded by our own compressor
 * (`src/lib/image-processing.ts`, via `/api/upload/image`), so a second
 * transform pass is redundant. Our compressor is the single source of truth for
 * sizing and quality.
 */
export function gridImageSrc(
  fullUrl: string | null | undefined,
  thumbUrl: string | null | undefined
): string | undefined {
  return thumbUrl ?? fullUrl ?? undefined;
}
