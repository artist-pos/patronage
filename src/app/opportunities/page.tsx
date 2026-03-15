import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats } from "@/lib/opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { RelevantFeed } from "@/components/opportunities/RelevantFeed";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { FoundOpportunityButton } from "@/components/opportunities/FoundOpportunityButton";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { createClient } from "@/lib/supabase/server";
import type { CareerStageEnum, CountryEnum, DisciplineEnum, Opportunity, OppTypeEnum } from "@/types/database";

export const metadata = {
  title: "Art Grants & Opportunities for NZ & Australian Artists",
  description:
    "Browse art grants, residencies, commissions, and open calls for New Zealand and Australian artists. Updated regularly with the latest arts funding opportunities.",
  openGraph: {
    title: "Art Grants & Opportunities for NZ & Australian Artists | Patronage",
    description:
      "Browse art grants, residencies, commissions, and open calls for New Zealand and Australian artists. Updated regularly with the latest arts funding opportunities.",
  },
};

// Expanded mapping: each discipline covers its specific scraped mediums.
// Opportunities tagged with any of these sub_category values count as a discipline match.
const DISCIPLINE_EXPANSION: Record<string, string[]> = {
  visual_art:  ["Visual Art", "Painting", "Sculpture", "Drawing", "Printmaking", "Installation", "Mixed Media", "Ceramics", "Digital", "Illustration"],
  craft:       ["Craft", "Ceramics", "Textile", "Jewellery", "Glass", "Woodwork", "Printmaking", "Mixed Media"],
  photography: ["Photography"],
  film:        ["Film", "Film & Video", "Moving Image", "Animation"],
  music:       ["Music", "Sound"],
  writing:     ["Writing", "Poetry"],   // poetry is a form of writing
  dance:       ["Dance", "Performance"],
  performance: ["Performance", "Live Art", "Dance"],
  poetry:      ["Poetry", "Writing"],
  other:       ["Other"],
};

// All medium/discipline tags (used to distinguish them from career-stage/focus tags)
const ALL_MEDIUM_TAGS = new Set(
  Object.values(DISCIPLINE_EXPANSION).flat()
);

// Career stage tags as they appear in sub_categories, mapped per CareerStageEnum
const CAREER_STAGE_TAG_MAP: Record<CareerStageEnum, string[]> = {
  Emerging:     ["Emerging", "Early Career"],
  "Mid-Career": ["Mid-Career"],
  Established:  ["Established"],
  Open:         [], // "Open" matches everything — no tags required
};
const ALL_CAREER_STAGE_TAGS = new Set(
  Object.values(CAREER_STAGE_TAG_MAP).flat()
);

function splitByRelevance(
  opportunities: Opportunity[],
  artistCountry: string | null,
  artistDisciplines: DisciplineEnum[],
  artistCareerStage: CareerStageEnum | null
): { matched: Opportunity[]; lessRelevant: Opportunity[] } {
  // Build the union of all medium tags relevant to this artist's disciplines
  const expandedMediums = new Set<string>();
  for (const d of artistDisciplines) {
    for (const tag of DISCIPLINE_EXPANSION[d] ?? []) expandedMediums.add(tag);
  }

  // Career stage tags this artist matches
  const matchedStageTags = new Set<string>(
    artistCareerStage ? (CAREER_STAGE_TAG_MAP[artistCareerStage] ?? []) : []
  );

  const matched: Opportunity[] = [];
  const lessRelevant: Opportunity[] = [];

  for (const opp of opportunities) {
    const tags = opp.sub_categories ?? [];

    // Country: null/Global = open to all; otherwise must match artist's country
    const countryRelevant =
      !opp.country ||
      opp.country === "Global" ||
      opp.country === artistCountry;

    // Discipline: if no medium tags present → open to all disciplines
    const mediumTags = tags.filter(t => ALL_MEDIUM_TAGS.has(t));
    const disciplineRelevant =
      mediumTags.length === 0 ||
      (expandedMediums.size > 0 && mediumTags.some(t => expandedMediums.has(t)));

    // Career stage: if no stage tags present → open to all; "Open" profile matches all
    const stageTags = tags.filter(t => ALL_CAREER_STAGE_TAGS.has(t));
    const careerRelevant =
      stageTags.length === 0 ||
      !artistCareerStage ||
      artistCareerStage === "Open" ||
      stageTags.some(t => matchedStageTags.has(t));

    if (countryRelevant && disciplineRelevant && careerRelevant) {
      matched.push(opp);
    } else {
      lessRelevant.push(opp);
    }
  }

  return { matched, lessRelevant };
}

interface PageProps {
  searchParams: Promise<{ type?: string; country?: string; view?: string; discipline?: string; freeEntry?: string; eligibility?: string; careerStage?: string }>;
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type as OppTypeEnum | undefined;
  const country = params.country as CountryEnum | undefined;
  const discipline = params.discipline;
  const freeEntry = params.freeEntry === "1";
  const eligibility = params.eligibility;
  const careerStage = params.careerStage;
  const view = params.view === "list" ? "list" : "gallery";

  // Fetch user profile for relevance scoring (artists only)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let artistCountry: string | null = null;
  let artistDisciplines: DisciplineEnum[] = [];
  let artistCareerStage: CareerStageEnum | null = null;
  const hasManualFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry);

  if (user && !hasManualFilters) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, country, disciplines, career_stage")
      .eq("id", user.id)
      .single();

    if (profile && (profile.role === "artist" || profile.role === "owner")) {
      artistCountry = profile.country ?? null;
      artistDisciplines = (profile.disciplines ?? []) as DisciplineEnum[];
      artistCareerStage = (profile.career_stage ?? null) as CareerStageEnum | null;
    }
  }

  const canScore = !hasManualFilters && (artistDisciplines.length > 0 || !!artistCountry);

  const [opportunities, stats] = await Promise.all([
    getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage }),
    getMarketplaceStats(),
  ]);

  // Split into matched / less relevant only when we have profile data and no manual filters
  const { matched, lessRelevant } = canScore
    ? splitByRelevance(opportunities, artistCountry, artistDisciplines, artistCareerStage)
    : { matched: opportunities, lessRelevant: [] };

  const activeFilters = [
    type,
    country,
    discipline,
    eligibility,
    careerStage,
    freeEntry ? "Free Entry" : undefined,
  ].filter(Boolean);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">

      {/* Page heading */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Art Grants & Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            {canScore
              ? `${matched.length} matched · ${lessRelevant.length} less relevant`
              : `${opportunities.length} listing${opportunities.length !== 1 ? "s" : ""}`}
            {activeFilters.length > 0 ? ` · ${activeFilters.join(" · ")}` : ""}
            {opportunities.length === 48 ? " · Showing 48 results — use filters to narrow down." : ""}
          </p>
        </div>
        <FoundOpportunityButton />
      </div>

      {/* AI-extractable description — hidden visually but crawlable and screen-reader accessible */}
      {!hasManualFilters && (
        <p className="sr-only">
          Patronage lists arts grants, residencies, open calls, commissions, prizes, and jobs for New Zealand and Australian artists.
          Opportunities are sourced from Creative NZ, Creative Australia, NZ On Air, state and regional arts councils, galleries, and independent organisations.
          The directory covers visual art, music, writing, poetry, dance, film, photography, craft, and performance disciplines.
          All listings are reviewed before publishing and updated weekly.
        </p>
      )}

      {/* Marketplace Stats bar */}
      <div className="border border-black px-6 py-4 flex flex-wrap gap-x-8 gap-y-2 items-center">
        <span className="font-mono text-sm">
          <strong>{stats.count}</strong> Active Opportunities
        </span>
        {stats.totalFunding > 0 && (
          <>
            <span className="hidden sm:block w-px h-4 bg-black" />
            <span className="font-mono text-sm">
              <strong>{formatFunding(stats.totalFunding)}</strong> Total Funding Available
            </span>
          </>
        )}
      </div>

      {/* Filters */}
      <Suspense>
        <OpportunityFilters />
      </Suspense>

      {/* Feed */}
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No opportunities match the current filters.
        </p>
      ) : (
        <RelevantFeed matched={matched} lessRelevant={lessRelevant} view={view} />
      )}
    </div>
  );
}
