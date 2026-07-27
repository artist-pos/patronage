// Single source of truth for opportunity slug generation — was previously
// duplicated identically in admin/submissions/actions.ts and
// admin/opportunities/queue/actions.ts, which is how the two drifted (only one
// of them treated a "-7"-style bad slug as needing regeneration).

export function toSlug(title: string, organiser: string | null, deadline: string | null): string {
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const organiserPart = organiser ? slugify(organiser).slice(0, 40).replace(/-+$/, "") : "";
  const titlePart = slugify(title).slice(0, 60).replace(/-+$/, "");
  const year = deadline ? new Date(deadline).getFullYear() : null;
  const base = [organiserPart, titlePart].filter(Boolean).join("-");
  return year ? `${base}-${year}` : base;
}

/** A bad slug is null, empty, or starts with "-" — produced when title/organiser
 *  were blank at the time toSlug() ran (e.g. approved before Basics was filled in). */
export function isSlugBad(slug: string | null | undefined): boolean {
  return !slug || slug.startsWith("-");
}
