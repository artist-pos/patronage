import { createAdminClient } from "@/lib/supabase/admin";
import { getDigestPool } from "@/lib/digest-send";
import { selectInstantMatches } from "@/lib/opportunity-match";
import type { DisciplineEnum, Opportunity } from "@/types/database";

/**
 * Cohorts under an organisation (migration 206). Server only.
 *
 * A cohort is attribution and a group count. It never lists, names or links to
 * a member, and matching is done on the group's aggregate, so a partner learns
 * what is open for "our BFA year", not what is open for one student.
 */

/** Below this many members the aggregate could point at one person, so no
 *  matches are shown. */
export const COHORT_MATCH_MIN_MEMBERS = 5;

// No 0/O/1/I/L: codes get read aloud and typed from slides.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCohortCode(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export interface CohortRow {
  id: string;
  org_profile_id: string;
  name: string;
  year: number | null;
  code: string;
  is_active: boolean;
}

/** A cohort that belongs to this organisation and is still open to joiners.
 *  Cookies are not trusted: the id is re-checked before being written. */
export async function validCohortId(cohortId: string, orgId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("org_cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("org_profile_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export interface CohortSummary extends CohortRow {
  memberCount: number;
  /** Null until the cohort is big enough to match without singling anyone out. */
  matches: Opportunity[] | null;
  topDisciplines: DisciplineEnum[];
}

/**
 * Every cohort of one organisation with its member count and, once there are
 * enough members, what is open across the group's most common disciplines.
 */
export async function getCohortSummaries(orgId: string): Promise<CohortSummary[]> {
  const admin = createAdminClient();
  const { data: cohortRows } = await admin
    .from("org_cohorts")
    .select("id, org_profile_id, name, year, code, is_active")
    .eq("org_profile_id", orgId)
    .order("created_at", { ascending: false });

  const cohorts = (cohortRows ?? []) as CohortRow[];
  if (cohorts.length === 0) return [];

  // Minors are counted and contribute to the aggregate, and are never returned.
  const { data: memberRows } = await admin
    .from("profiles")
    .select("cohort_id, disciplines, country")
    .in("cohort_id", cohorts.map((c) => c.id))
    .eq("is_active", true);

  const byCohort = new Map<string, Array<{ disciplines: DisciplineEnum[] | null; country: string | null }>>();
  for (const m of (memberRows ?? []) as Array<{ cohort_id: string; disciplines: DisciplineEnum[] | null; country: string | null }>) {
    const list = byCohort.get(m.cohort_id) ?? [];
    list.push(m);
    byCohort.set(m.cohort_id, list);
  }

  const needsPool = cohorts.some((c) => (byCohort.get(c.id)?.length ?? 0) >= COHORT_MATCH_MIN_MEMBERS);
  const pool = needsPool ? await getDigestPool() : [];

  return cohorts.map((c) => {
    const members = byCohort.get(c.id) ?? [];
    if (members.length < COHORT_MATCH_MIN_MEMBERS) {
      return { ...c, memberCount: members.length, matches: null, topDisciplines: [] };
    }

    const discCounts = new Map<DisciplineEnum, number>();
    const countryCounts = new Map<string, number>();
    for (const m of members) {
      for (const d of m.disciplines ?? []) discCounts.set(d, (discCounts.get(d) ?? 0) + 1);
      if (m.country) countryCounts.set(m.country, (countryCounts.get(m.country) ?? 0) + 1);
    }
    const topDisciplines = [...discCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);
    const country = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const matches = selectInstantMatches(pool, { disciplines: topDisciplines, country }, 8);
    return { ...c, memberCount: members.length, matches, topDisciplines };
  });
}
