import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats, getMatchedOpportunities, getArtistScoreMap } from "@/lib/opportunities";
import { ForYouTeaser } from "@/components/opportunities/ForYouTeaser";
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

  // Determine active tab — default to "all"; "for-you" is opt-in
  const tab = params.tab === "for-you" ? "for-you" : "all";

  const hasManualFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry || search);

  // Fetch data — only what the active tab needs
  const [stats, matchedOpps, rawAllOpps, scoreMap] = await Promise.all([
    getMarketplaceStats(),
    (tab === "for-you" && isArtist && hasDisciplines) ? getMatchedOpportunities(user!.id) : Promise.resolve([]),
    (tab === "all" || !isArtist) ? getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage, search }) : Promise.resolve([]),
    (tab === "all" && isArtist && hasDisciplines) ? getArtistScoreMap(user!.id) : Promise.resolve(new Map<string, number>()),
    Promise.resolve([]),
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
    <div>
      {/* ══ Page header — title, stats, tabs, filters ══ */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6">
          {/* Page heading */}
          <div className="mb-5 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              Art Grants &amp; Opportunities
            </h1>
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

          {/* Stats bar — borderless, mono labels, hairline dividers */}
          <div className="mb-5 flex flex-wrap">
            <div className="mb-2 mr-6 border-r border-border py-3 pr-6">
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {tab === "for-you"
                  ? matchedOpps.length
                  : (hasManualFilters && allOpps.length < stats.count ? allOpps.length : stats.count)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {tab === "for-you"
                  ? "matched for you"
                  : (hasManualFilters && allOpps.length < stats.count ? "filtered results" : "active opportunities")}
              </p>
            </div>
            <div className="mb-2 mr-6 border-r border-border py-3 pr-6">
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--urgent)]">
                {stats.closingThisWeek}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">close this week</p>
            </div>
            <div className="mb-2 mr-6 border-r border-border py-3 pr-6">
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {stats.freeToEnter}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">free to enter</p>
            </div>
            <div className="mb-2 py-3">
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {stats.totalFunding > 0 ? formatFunding(stats.totalFunding) : "—"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">approx. funding tracked</p>
            </div>
          </div>

          {/* Tab switch — always visible */}
          <Suspense>
            <OpportunitiesTabSwitch activeTab={tab as "for-you" | "all"} matchCount={matchedOpps.length} />
          </Suspense>

          {/* Filters — inside the header block, per v2 */}
          {tab === "all" && (
            <Suspense>
              <OpportunityFilters />
            </Suspense>
          )}
        </div>
      </div>

      {/* ══ Content — pins on the feed surface ══ */}
      <div className="min-h-screen bg-feed-bg">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
          {/* For You tab content */}
          {tab === "for-you" && (
            <>
              {/* Unauthenticated — CTA */}
              {!user && <ForYouTeaser />}

              {/* Authenticated non-artist (patron/partner) */}
              {user && !isArtist && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Personalised matches are available for artist profiles.
                </p>
              )}

              {/* Artist states */}
              {user && isArtist && (
                <>
                  {!hasDisciplines ? (
                    <div className="space-y-3 bg-card p-8 text-center">
                      <p className="text-sm font-medium">Complete your profile to get personalised matches</p>
                      <p className="text-xs text-muted-foreground">Add your disciplines so we can surface the most relevant opportunities for your practice.</p>
                      <Link href="/profile/edit" className="inline-block bg-foreground px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-82">
                        Edit profile
                      </Link>
                    </div>
                  ) : matchedOpps.length === 0 ? (
                    <div className="space-y-2 bg-card p-8 text-center">
                      <p className="text-sm font-medium">Your matches are being calculated</p>
                      <p className="text-xs text-muted-foreground">
                        Scores are updated weekly after new opportunities are scraped.{" "}
                        <Link href="/opportunities?tab=all" className="underline underline-offset-2">Browse all opportunities</Link>{" "}
                        in the meantime.
                      </p>
                    </div>
                  ) : (
                    <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={true} />
                  )}
                </>
              )}
            </>
          )}

          {/* All Opportunities tab content */}
          {tab === "all" && (
            <>
              {featuredOpp && <FeaturedOpportunityHero opportunity={featuredOpp} />}

              {gridOpps.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No opportunities match those filters. New listings are added regularly.
                </p>
              ) : (
                <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={!!user} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
