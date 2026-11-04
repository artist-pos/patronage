// Single source of truth for opportunity slug generation — was previously
// duplicated identically in admin/submissions/actions.ts and
// admin/opportunities/queue/actions.ts, which is how the two drifted (only one
// of them treated a "-7"-style bad slug as needing regeneration).
//
// NOTE: scraper/lib/upsert.ts keeps its own copy (separate package) — keep the
// two in sync.

/** Lowercase, fold diacritics/macrons ("Pūkenga" -> "pukenga", not "p-kenga"),
 *  and collapse everything else to single hyphens. */
function slugifyPart(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "") // "Artist's" -> "artists", not "artist-s"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toSlug(title: string, organiser: string | null, deadline: string | null): string {
  const organiserPart = organiser ? slugifyPart(organiser).slice(0, 40).replace(/-+$/, "") : "";
  const titlePart = slugifyPart(title).slice(0, 60).replace(/-+$/, "");
  const year = deadline ? new Date(deadline).getFullYear() : null;
  const base = [organiserPart, titlePart].filter(Boolean).join("-");
  // Don't repeat the year when the title already ends with it ("...-award-2027-2027").
  if (!year || Number.isNaN(year) || base.endsWith(`-${year}`)) return base;
  return `${base}-${year}`;
}

/** A bad slug is null, empty, or starts with "-" — produced when title/organiser
 *  were blank at the time toSlug() ran (e.g. approved before Basics was filled in). */
export function isSlugBad(slug: string | null | undefined): boolean {
  return !slug || slug.startsWith("-");
}

/** True when the stored slug no longer matches what toSlug() would produce today
 *  (e.g. generated before macron folding). Allows a "-2" collision suffix. */
export function isSlugStale(
  slug: string | null | undefined,
  title: string,
  organiser: string | null,
  deadline: string | null,
): boolean {
  if (!slug) return false;
  const expected = toSlug(title ?? "", organiser, deadline);
  return !!expected && slug !== expected && !new RegExp(`^${expected}-\\d$`).test(slug);
}
