import { selectDigestOpportunities } from "@/lib/digest";
import { toDisciplineEnums } from "@/lib/signup-context";
import type { DisciplineEnum, Opportunity } from "@/types/database";

/**
 * Deterministic matching, for artists the LLM scorer has not reached yet.
 *
 * `opportunity_artist_matches` is filled by scraper/score-matches.ts on the
 * weekly GitHub Actions run, so a new account has no rows in it until the next
 * scrape completes. This module answers "what is open in your disciplines
 * right now" from data already in hand — no API calls, no waiting.
 *
 * It is deliberately weaker than the scored feed: an overlap test, not a
 * judgement about fit. Copy that describes it should say "open in your
 * disciplines", never "matched to your practice".
 */

/**
 * Which artist countries an opportunity's country value admits.
 *
 * Mirrors COUNTRY_MAP in scraper/score-matches.ts. The scraper is a separate
 * package with its own tsconfig and cannot import from src/, so the two copies
 * have to be changed together — this one is canonical.
 */
export const ELIGIBLE_ARTIST_COUNTRIES: Record<string, string[]> = {
  NZ: ["NZ"],
  AUS: ["AUS"],
  Global: ["NZ", "AUS", "Global", "UK", "US", "EU"],
};

const DEFAULT_ELIGIBLE = ["NZ", "AUS", "Global"];

/** An artist who has not said where they are is never filtered out — a blank
 *  field is missing information, not a declaration of ineligibility. */
export function isCountryEligible(
  oppCountry: string | null | undefined,
  artistCountry: string | null | undefined
): boolean {
  if (!artistCountry) return true;
  const eligible = ELIGIBLE_ARTIST_COUNTRIES[oppCountry ?? ""] ?? DEFAULT_ELIGIBLE;
  return eligible.includes(artistCountry);
}

/** The opportunity's own categories, read in the profile's vocabulary.
 *  Empty means the listing named no discipline we recognise — it is open to
 *  everyone rather than to nobody. */
function disciplinesOf(opp: Opportunity): DisciplineEnum[] {
  return toDisciplineEnums(opp.sub_categories);
}

export interface InstantMatchProfile {
  disciplines: DisciplineEnum[] | null;
  country: string | null;
}

/**
 * Picks up to `limit` open opportunities for one artist, from a pool already
 * fetched for the page. Pure — no query of its own.
 *
 * Listings tagged with one of the artist's disciplines come first. Untagged
 * listings top up the rest: a grant that names no discipline is usually one of
 * the large open funds, and dropping it would hide the best of them. Both
 * tiers run through the digest's selector, so ordering and geographic spread
 * match what the artist will later receive by email.
 */
export function selectInstantMatches(
  pool: Opportunity[],
  profile: InstantMatchProfile,
  limit = 5
): Opportunity[] {
  const artistDisciplines = profile.disciplines ?? [];
  if (artistDisciplines.length === 0) return [];

  const wanted = new Set<DisciplineEnum>(artistDisciplines);
  const eligible = pool.filter((o) => isCountryEligible(o.country, profile.country));

  const tagged: Opportunity[] = [];
  const untagged: Opportunity[] = [];
  for (const opp of eligible) {
    const oppDisciplines = disciplinesOf(opp);
    if (oppDisciplines.length === 0) untagged.push(opp);
    else if (oppDisciplines.some((d) => wanted.has(d))) tagged.push(opp);
  }

  const picked = selectDigestOpportunities(tagged, limit);
  if (picked.length >= limit) return picked;

  return [...picked, ...selectDigestOpportunities(untagged, limit - picked.length)];
}
