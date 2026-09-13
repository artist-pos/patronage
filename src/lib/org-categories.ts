/**
 * What an organisation *does*, as distinct from what it *is* legally.
 *
 * `profiles.organisation_type` answers the legal question (charity vs
 * business) and gates the donation CTA and admin verification. It is not a
 * functional taxonomy, which is why Creative Waikato has no honest value
 * there: a regional arts body that is also a registered charity would have to
 * be filed as one and misrepresented as the other.
 *
 * This field answers the functional question separately. The two are
 * orthogonal on purpose: a gallery can be a charity, a council cannot.
 */
export type OrgCategory =
  | "regional_arts_org"
  | "gallery"
  | "residency"
  | "council"
  | "developer"
  | "corporate";

/**
 * How an organisation relates to artists. This is the part that decides what
 * a category gets on a regional page, so it is modelled explicitly rather than
 * left to a switch statement somewhere in a component.
 *
 *  - `geographic`   the org serves a region. It does not claim anyone.
 *  - `representation` the org represents named artists, with their consent.
 *  - `commissioning`  the org creates opportunities and artists apply.
 *  - `participation`  artists have passed through it. A record of when, not a
 *                     claim on their work: "was here in 2024" rather than
 *                     "speaks for me".
 */
export type ArtistRelationship =
  | "geographic"
  | "representation"
  | "commissioning"
  | "participation";

export interface OrgCategoryDef {
  value: OrgCategory;
  label: string;
  /** Shown under the label in pickers. */
  hint: string;
  relationship: ArtistRelationship;
  /** Sits at the top of its regional page as the region's arts body. */
  anchorsRegion: boolean;
  /** May build a roster of represented artists, each of whom must accept. */
  representsArtists: boolean;
  /** May build a dated alumni list, each of whom must accept. Distinct from
   *  representation: it records a past association, not a current mandate. */
  hasAlumni: boolean;
  /** What one membership is called in the interface, singular. */
  rosterNoun: string | null;
}

export const ORG_CATEGORIES: OrgCategoryDef[] = [
  {
    value: "regional_arts_org",
    label: "Regional arts organisation",
    hint: "Regional arts bodies such as Creative Waikato or Creative Northland. Anchors your region's page.",
    relationship: "geographic",
    anchorsRegion: true,
    representsArtists: false,
    hasAlumni: false,
    rosterNoun: null,
  },
  {
    value: "gallery",
    label: "Gallery / Museum",
    hint: "Galleries, museums, and artist-run spaces that represent and show artists.",
    relationship: "representation",
    anchorsRegion: false,
    representsArtists: true,
    hasAlumni: false,
    rosterNoun: "represented artist",
  },
  {
    value: "residency",
    label: "Residency / Studio programme",
    hint: "Residency and studio programmes. You can list who has been through, with the years.",
    // Participation, not commissioning. A residency does select through an
    // application round, but what it has to show afterwards is who was there,
    // and that is a relationship the artist carries on their own CV.
    relationship: "participation",
    anchorsRegion: false,
    representsArtists: false,
    hasAlumni: true,
    rosterNoun: "participant",
  },
  {
    value: "council",
    label: "Council / Government",
    hint: "Councils and government bodies commissioning public art and running arts programmes.",
    relationship: "commissioning",
    anchorsRegion: false,
    representsArtists: false,
    hasAlumni: false,
    rosterNoun: null,
  },
  {
    value: "developer",
    label: "Property / Developer",
    hint: "Developers and asset managers commissioning work across a property portfolio.",
    relationship: "commissioning",
    anchorsRegion: false,
    representsArtists: false,
    hasAlumni: false,
    rosterNoun: null,
  },
  {
    value: "corporate",
    label: "Corporate / Brand",
    hint: "Brands commissioning or sponsoring work.",
    relationship: "commissioning",
    anchorsRegion: false,
    representsArtists: false,
    hasAlumni: false,
    rosterNoun: null,
  },
];

const BY_VALUE = new Map(ORG_CATEGORIES.map((c) => [c.value, c]));

export function orgCategory(value: string | null | undefined): OrgCategoryDef | null {
  return value ? BY_VALUE.get(value as OrgCategory) ?? null : null;
}

export function isOrgCategory(value: string | null | undefined): value is OrgCategory {
  return !!value && BY_VALUE.has(value as OrgCategory);
}

/** Organisations that may build a consented artist roster. */
export function canRepresentArtists(value: string | null | undefined): boolean {
  return orgCategory(value)?.representsArtists ?? false;
}

/** Organisations that may keep a dated list of artists who have been through. */
export function hasAlumni(value: string | null | undefined): boolean {
  return orgCategory(value)?.hasAlumni ?? false;
}

/**
 * Whether this category may keep any consented artist list at all, of either
 * kind. The interface question is usually this one rather than which kind.
 */
export function canKeepRoster(value: string | null | undefined): boolean {
  const c = orgCategory(value);
  return !!c && (c.representsArtists || c.hasAlumni);
}

/**
 * The relationship value a category's roster is allowed to carry. Mirrors the
 * WITH CHECK half of the RLS policy in migration 186, so the interface cannot
 * offer a claim the database will reject.
 */
export function defaultRelationship(
  value: string | null | undefined
): "represented" | "participant" | null {
  const c = orgCategory(value);
  if (!c) return null;
  if (c.representsArtists) return "represented";
  if (c.hasAlumni) return "participant";
  return null;
}

/** The single organisation featured at the top of a regional page. */
export function anchorsRegion(value: string | null | undefined): boolean {
  return orgCategory(value)?.anchorsRegion ?? false;
}

/**
 * The partners marketing page asks "what brings you here?" and, until now,
 * threw the answer away. These are its keys, mapped onto the stored category
 * so the choice survives into signup.
 */
export const PARTNER_PAGE_TYPE_TO_CATEGORY: Record<string, OrgCategory> = {
  arts: "regional_arts_org",
  residency: "residency",
  gallery: "gallery",
  council: "council",
  corporate: "corporate",
  assetmanager: "developer",
};
