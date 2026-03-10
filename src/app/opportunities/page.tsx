import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats } from "@/lib/opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { RelevantFeed } from "@/components/opportunities/RelevantFeed";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { FoundOpportunityButton } from "@/components/opportunities/FoundOpportunityButton";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { createClient } from "@/lib/supabase/server";
import type { CountryEnum, DisciplineEnum, Opportunity, OppTypeEnum } from "@/types/database";

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

// Maps DisciplineEnum values to the display labels used in opportunity sub_categories
const DISCIPLINE_LABELS: Record<string, string> = {
  visual_art: "Visual Art",
  music: "Music",
  poetry: "Poetry",
  writing: "Writing",
  dance: "Dance",
  film: "Film",
  photography: "Photography",
  craft: "Craft",
  performance: "Performance",
  other: "Other",
};

// Discipline labels that appear in sub_categories (to distinguish from non-discipline tags)
const DISCIPLINE_LABEL_SET = new Set(Object.values(DISCIPLINE_LABELS));

function splitByRelevance(
  opportunities: Opportunity[],
  artistCountry: string | null,
  artistDisciplines: DisciplineEnum[]
): { matched: Opportunity[]; lessRelevant: Opportunity[] } {
  const artistLabels = artistDisciplines.map(d => DISCIPLINE_LABELS[d] ?? d);

  const matched: Opportunity[] = [];
  const lessRelevant: Opportunity[] = [];

  for (const opp of opportunities) {
    // Country relevance: Global = everyone; null/empty = everyone; otherwise must match
    const countryRelevant =
      !opp.country ||
      opp.country === "Global" ||
      opp.country === artistCountry;

    // Discipline relevance: if sub_categories has no discipline tags, it's open to all
    const disciplineTags = (opp.sub_categories ?? []).filter(tag => DISCIPLINE_LABEL_SET.has(tag));
    const disciplineRelevant =
      disciplineTags.length === 0 ||
      artistLabels.some(label => disciplineTags.includes(label));

    if (countryRelevant && disciplineRelevant) {
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
  const hasManualFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry);

  if (user && !hasManualFilters) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, country, disciplines")
      .eq("id", user.id)
      .single();

    if (profile && (profile.role === "artist" || profile.role === "owner")) {
      artistCountry = profile.country ?? null;
      artistDisciplines = (profile.disciplines ?? []) as DisciplineEnum[];
    }
  }

  const canScore = !hasManualFilters && (artistDisciplines.length > 0 || !!artistCountry);

  const [opportunities, stats] = await Promise.all([
    getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage }),
    getMarketplaceStats(),
  ]);

  // Split into matched / less relevant only when we have profile data and no manual filters
  const { matched, lessRelevant } = canScore
    ? splitByRelevance(opportunities, artistCountry, artistDisciplines)
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
          </p>
        </div>
        <FoundOpportunityButton />
      </div>

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
