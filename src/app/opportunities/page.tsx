import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats, getMatchedOpportunities, getArtistScoreMap } from "@/lib/opportunities";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { FoundOpportunityButton } from "@/components/opportunities/FoundOpportunityButton";
import { FeaturedOpportunityHero } from "@/components/opportunities/FeaturedOpportunityHero";
import { OpportunitiesTabSwitch } from "@/components/opportunities/OpportunitiesTabSwitch";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { createClient } from "@/lib/supabase/server";
import type { CountryEnum, OppTypeEnum } from "@/types/database";
import Link from "next/link";

export const metadata = {
  title: "Art Grants & Opportunities for NZ & Australian Artists",
  description:
    "Browse art grants, residencies, commissions, and open calls for New Zealand and Australian artists. Updated regularly with the latest arts funding opportunities.",
  alternates: {
    canonical: "https://patronage.nz/opportunities",
  },
  openGraph: {
    title: "Art Grants & Opportunities for NZ & Australian Artists | Patronage",
    description:
      "Browse art grants, residencies, commissions, and open calls for New Zealand and Australian artists. Updated regularly with the latest arts funding opportunities.",
  },
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    type?: string;
    country?: string;
    view?: string;
    discipline?: string;
    freeEntry?: string;
    eligibility?: string;
    careerStage?: string;
    search?: string;
  }>;
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type as OppTypeEnum | undefined;
  const country = params.country as CountryEnum | undefined;
  const discipline = params.discipline;
  const freeEntry = params.freeEntry === "1";
  const eligibility = params.eligibility;
  const careerStage = params.careerStage;
  const search = params.search?.trim() || undefined;
  const view = params.view === "list" ? "list" : "gallery";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if this is an artist with disciplines set
  let isArtist = false;
  let hasDisciplines = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, disciplines")
      .eq("id", user.id)
      .single();
    isArtist = profile?.role === "artist" || profile?.role === "owner";
    hasDisciplines = isArtist && Array.isArray(profile?.disciplines) && profile.disciplines.length > 0;
  }

  // Determine active tab
  const defaultTab = isArtist ? "for-you" : "all";
  const tab = params.tab === "all" ? "all" : params.tab === "for-you" ? "for-you" : defaultTab;

  const hasManualFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry || search);

  // Fetch data — only what the active tab needs
  const [stats, matchedOpps, rawAllOpps, scoreMap] = await Promise.all([
    getMarketplaceStats(),
    (tab === "for-you" && isArtist && hasDisciplines) ? getMatchedOpportunities(user!.id) : Promise.resolve([]),
    (tab === "all" || !isArtist) ? getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage, search }) : Promise.resolve([]),
    (tab === "all" && isArtist && hasDisciplines) ? getArtistScoreMap(user!.id) : Promise.resolve(new Map<string, number>()),
  ]);

  // Merge scores onto all-tab results (score only, no reason — reason is For You only)
  const allOpps = scoreMap.size > 0
    ? rawAllOpps.map((o) => scoreMap.has(o.id) ? { ...o, match_score: scoreMap.get(o.id) } : o)
    : rawAllOpps;

  const featuredOpp = (tab === "all" && !hasManualFilters)
    ? (allOpps.find((o) => o.is_featured) ?? null)
    : null;
  const gridOpps = tab === "for-you" ? matchedOpps : (featuredOpp ? allOpps.filter((o) => o.id !== featuredOpp.id) : allOpps);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Page heading */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Art Grants &amp; Opportunities</h1>
        <FoundOpportunityButton />
      </div>

      {/* AI-extractable description */}
      {tab === "all" && !hasManualFilters && (
        <p className="sr-only">
          Patronage lists arts grants, residencies, open calls, commissions, prizes, and jobs for New Zealand and Australian artists.
          Opportunities are sourced from Creative NZ, Creative Australia, NZ On Air, state and regional arts councils, galleries, and independent organisations.
          The directory covers visual art, music, writing, poetry, dance, film, photography, craft, and performance disciplines.
          All listings are reviewed before publishing and updated weekly.
        </p>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-black divide-x divide-y sm:divide-y-0 divide-black">
        <div className="px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums">
            {tab === "for-you"
              ? matchedOpps.length
              : (hasManualFilters && allOpps.length < stats.count ? allOpps.length : stats.count)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tab === "for-you"
              ? "matched for you"
              : (hasManualFilters && allOpps.length < stats.count ? "filtered results" : "active opportunities")}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums text-orange-600">{stats.closingThisWeek}</p>
          <p className="text-xs text-muted-foreground mt-0.5">close this week</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums">{stats.freeToEnter}</p>
          <p className="text-xs text-muted-foreground mt-0.5">free to enter</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums">
            {stats.totalFunding > 0 ? formatFunding(stats.totalFunding) : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">approx. funding tracked</p>
        </div>
      </div>

      {/* Tab switch — artists only */}
      {isArtist && (
        <Suspense>
          <OpportunitiesTabSwitch activeTab={tab as "for-you" | "all"} matchCount={matchedOpps.length} />
        </Suspense>
      )}

      {/* For You tab content */}
      {tab === "for-you" && isArtist && (
        <>
          {!hasDisciplines ? (
            <div className="border border-border p-8 text-center space-y-3">
              <p className="text-sm font-medium">Complete your profile to get personalised matches</p>
              <p className="text-xs text-muted-foreground">Add your disciplines so we can surface the most relevant opportunities for your practice.</p>
              <Link
                href="/profile/edit"
                className="inline-block text-xs font-medium px-4 py-2 bg-black text-white hover:opacity-80 transition-opacity"
              >
                Edit profile
              </Link>
            </div>
          ) : matchedOpps.length === 0 ? (
            <div className="border border-border p-8 text-center space-y-2">
              <p className="text-sm font-medium">Your matches are being calculated</p>
              <p className="text-xs text-muted-foreground">
                Scores are updated weekly after new opportunities are scraped.{" "}
                <Link href="/opportunities?tab=all" className="underline underline-offset-2">
                  Browse all opportunities
                </Link>{" "}
                in the meantime.
              </p>
            </div>
          ) : (
            <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={!!user} />
          )}
        </>
      )}

      {/* All Opportunities tab content */}
      {(tab === "all" || !isArtist) && (
        <>
          {featuredOpp && <FeaturedOpportunityHero opportunity={featuredOpp} />}

          <Suspense>
            <OpportunityFilters />
          </Suspense>

          {gridOpps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No opportunities match those filters. New listings are added regularly.
            </p>
          ) : (
            <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={!!user} />
          )}
        </>
      )}
    </div>
  );
}
