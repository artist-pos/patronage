import { createPublicClient } from "@/lib/supabase/public";

/**
 * An artist's organisational affiliations, as shown on their own profile.
 *
 * Two kinds, displayed in two places, because they are two different claims.
 * Representation is current and commercial, so it sits in the profile header
 * where any visitor sees it immediately. Participation is a dated credit, so it
 * belongs on the CV alongside exhibitions and grants, which is exactly how an
 * artist writes it themselves.
 *
 * Only accepted memberships of public rosters are returned. A pending
 * invitation is not a claim the organisation gets to publish.
 */

export interface Affiliation {
  /** The organisation's profile, so the credit can link back to it. */
  username: string;
  name: string;
  avatarUrl: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface ArtistAffiliations {
  /** "Represented by X Gallery." Ordered alphabetically on purpose: an artist
   *  with two galleries has no hierarchy between them, and ordering by when
   *  each was accepted would invent one. */
  representation: Affiliation[];
  /** Residencies and studio programmes, newest first: a timeline. */
  participation: Affiliation[];
}

const EMPTY: ArtistAffiliations = { representation: [], participation: [] };

export async function getArtistAffiliations(
  artistId: string
): Promise<ArtistAffiliations> {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("collective_members")
    .select(
      `start_year, end_year,
       collective:collectives!inner(
         relationship, is_public, org_profile_id,
         org:profiles!collectives_org_profile_id_fkey(username, full_name, avatar_url)
       )`
    )
    .eq("user_id", artistId)
    .eq("status", "accepted")
    .eq("collective.is_public", true)
    .not("collective.org_profile_id", "is", null);

  const rows = (data ?? []) as unknown as Array<{
    start_year: number | null;
    end_year: number | null;
    collective: {
      relationship: string;
      org: { username: string; full_name: string | null; avatar_url: string | null } | null;
    } | null;
  }>;

  if (rows.length === 0) return EMPTY;

  const representation: Affiliation[] = [];
  const participation: Affiliation[] = [];

  for (const row of rows) {
    const org = row.collective?.org;
    if (!org) continue;

    const entry: Affiliation = {
      username: org.username,
      name: org.full_name ?? org.username,
      avatarUrl: org.avatar_url,
      startYear: row.start_year,
      endYear: row.end_year,
    };

    const relationship = row.collective?.relationship;
    if (relationship === "represented" || relationship === "shows_with") {
      representation.push(entry);
    } else if (relationship === "participant") {
      participation.push(entry);
    }
  }

  representation.sort((a, b) => a.name.localeCompare(b.name));
  participation.sort(
    (a, b) => (b.startYear ?? 0) - (a.startYear ?? 0) || a.name.localeCompare(b.name)
  );

  return { representation, participation };
}

/** "2022 to 2023", "2024 to now", or null when no years were recorded. */
export function affiliationYears(a: {
  startYear: number | null;
  endYear: number | null;
}): string | null {
  if (a.startYear === null && a.endYear === null) return null;
  if (a.startYear !== null && a.endYear === null) return `${a.startYear} to now`;
  if (a.startYear === null) return `until ${a.endYear}`;
  return a.startYear === a.endYear ? `${a.startYear}` : `${a.startYear} to ${a.endYear}`;
}

/** One artist on an organisation's public roster. */
export interface RosterArtist {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  medium: string[] | null;
  startYear: number | null;
  endYear: number | null;
}

export interface OrgRoster {
  /** "represented" for a gallery, "participant" for a residency. */
  relationship: "represented" | "shows_with" | "participant" | null;
  artists: RosterArtist[];
}

/**
 * The artists an organisation may show on its own page.
 *
 * Accepted members of its public roster, and nothing else. A pending invitation
 * is not a claim the organisation gets to publish, which is enforced in the RLS
 * policy as well as here.
 *
 * A gallery's list has no order beyond the alphabet, deliberately. A residency's
 * is a timeline, newest first.
 */
export async function getOrgRoster(orgProfileId: string): Promise<OrgRoster> {
  const supabase = createPublicClient();

  const { data: rosterRow } = await supabase
    .from("collectives")
    .select("id, relationship")
    .eq("org_profile_id", orgProfileId)
    .eq("is_public", true)
    .limit(1)
    .maybeSingle();

  const roster = rosterRow as { id: string; relationship: string } | null;
  if (!roster) return { relationship: null, artists: [] };

  const { data } = await supabase
    .from("collective_members")
    .select(
      "start_year, end_year, profiles!collective_members_user_id_fkey(id, username, full_name, avatar_url, medium)"
    )
    .eq("collective_id", roster.id)
    .eq("status", "accepted");

  const rows = (data ?? []) as unknown as Array<{
    start_year: number | null;
    end_year: number | null;
    profiles: {
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
      medium: string[] | null;
    } | null;
  }>;

  const artists: RosterArtist[] = rows
    .filter((r) => r.profiles)
    .map((r) => ({
      ...r.profiles!,
      startYear: r.start_year,
      endYear: r.end_year,
    }));

  const isTimeline = roster.relationship === "participant";
  artists.sort((a, b) =>
    isTimeline
      ? (b.startYear ?? 0) - (a.startYear ?? 0) ||
        (a.full_name ?? a.username).localeCompare(b.full_name ?? b.username)
      : (a.full_name ?? a.username).localeCompare(b.full_name ?? b.username)
  );

  return {
    relationship: roster.relationship as OrgRoster["relationship"],
    artists,
  };
}

/** What the section on the organisation's page is called. */
export function rosterHeading(relationship: OrgRoster["relationship"]): string {
  return relationship === "participant" ? "Artists who have been here" : "Represented artists";
}
