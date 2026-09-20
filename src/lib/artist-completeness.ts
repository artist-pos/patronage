import type { ProfileWithImage } from "@/types/database";

type Completable = Pick<ProfileWithImage, "primary_image_url" | "avatar_url" | "full_name" | "bio">;

/** How finished a profile looks. Drives which artists are shown as cards and
 *  which are shown as bare handles, on the directory and the regional pages. */
export function artistCompleteness(a: Completable) {
  const hasImage = !!(a.primary_image_url || a.avatar_url);
  const hasName = !!a.full_name;
  const hasBio = !!a.bio;
  return {
    hasImage,
    hasName,
    hasBio,
    score: (hasImage ? 2 : 0) + (hasName ? 2 : 0) + (hasBio ? 1 : 0),
  };
}

/** A name or an image is enough to be shown as a card. */
export function isPresentable(a: Completable): boolean {
  const c = artistCompleteness(a);
  return c.hasName || c.hasImage;
}

export function byCompleteness(a: Completable, b: Completable): number {
  return artistCompleteness(b).score - artistCompleteness(a).score;
}
