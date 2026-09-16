import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { getOpportunities, getMarketplaceStats, getMatchedOpportunities, getArtistScoreMap } from "@/lib/opportunities";
import { sortOpportunities, type OppSort, OPP_SORTS } from "@/lib/opportunity-sort";
import { ForYouTeaser } from "@/components/opportunities/ForYouTeaser";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { OpportunityViewToggle } from "@/components/opportunities/OpportunityViewToggle";
import { FeaturedOpportunityHero } from "@/components/opportunities/FeaturedOpportunityHero";
import { OpportunitiesTabSwitch } from "@/components/opportunities/OpportunitiesTabSwitch";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { selectInstantMatches } from "@/lib/opportunity-match";
import type { CountryEnum, OppTypeEnum, Opportunity, Profile } from "@/types/database";
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

// ── Cached public browse data — identical for every visitor. Listings change
// via the weekly scrape + admin publishes, so a 5-minute revalidate is safe.
// Keyed by day so the deadline cutoff rolls over. Filtered/searched queries
// stay live (many key combos, each already a single indexed query).
const getCachedBrowseData = unstable_cache(
  async (_today: string) => {
    const [stats, opps] = await Promise.all([
      getMarketplaceStats(),
      getOpportunities({}),
    ]);
    return { stats, opps };
  },
  ["opportunities-browse-v1"],
  { revalidate: 300, tags: ["opportunities"] }
);

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    type?: string;
    country?: string;
    view?: string;
    sort?: string;
    discipline?: string;
    freeEntry?: string;
    eligibility?: string;
    careerStage?: string;
    search?: string;
    /** One-time, set by the onboarding profile step. The verification prompt
     *  is not here — it lives in the global banner, keyed on the profile, so
     *  it survives the trip into a listing and back. */
    welcome?: string;
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
  const sort: OppSort = (OPP_SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as OppSort)
    : "deadline";

  // Request-deduped auth + profile — shares the Header's round-trips.
  const { user } = await getServerUser();

  // Check if this is an artist with disciplines set
  let isArtist = false;
  let hasDisciplines = false;
  let profile: Profile | null = null;
  if (user) {
    profile = await getProfileById(user.id);
    isArtist = profile?.role === "artist" || profile?.role === "owner";
    hasDisciplines = isArtist && Array.isArray(profile?.disciplines) && profile.disciplines.length > 0;
  }

  // Determine active tab — default to "all"; "for-you" is opt-in
  const tab = params.tab === "for-you" ? "for-you" : "all";

  const hasManualFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry || search);

  // Fetch data — only what the active tab needs. The unfiltered browse view
  // (stats + full list) is served from the shared cache; only filtered
  // queries and per-user match data hit the database live.
  const today = new Date().toISOString().split("T")[0];
  const wantsAllList = tab === "all" || !isArtist;
  const [browse, filteredOpps, matchedOpps, scoreMap] = await Promise.all([
    getCachedBrowseData(today),
    (wantsAllList && hasManualFilters)
      ? getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage, search })
      : Promise.resolve(null),
    (tab === "for-you" && isArtist && hasDisciplines) ? getMatchedOpportunities(user!.id) : Promise.resolve([]),
    (tab === "all" && isArtist && hasDisciplines) ? getArtistScoreMap(user!.id) : Promise.resolve(new Map<string, number>()),
  ]);
  const stats = browse.stats;
  const rawAllOpps = wantsAllList ? (filteredOpps ?? browse.opps) : [];

  // The scorer fills opportunity_artist_matches on the weekly run, so an artist
  // who signed up since the last one has no scores at all. Fall back to a
  // deterministic discipline filter over the pool already fetched above — pure,
  // so it costs no extra round-trip. The count and label below say which of the
  // two is on screen: the filter is an overlap test, not a judgement of fit.
  const instantOpps =
    tab === "for-you" && isArtist && hasDisciplines && matchedOpps.length === 0 && profile
      ? selectInstantMatches(browse.opps, profile, 12)
      : [];
  const forYouOpps: Opportunity[] = matchedOpps.length > 0 ? matchedOpps : instantOpps;
  const matchMode: "scored" | "instant" = matchedOpps.length > 0 ? "scored" : "instant";

  // Merge scores onto all-tab results (score only, no reason — reason is For You only)
  const scoredAllOpps = scoreMap.size > 0
    ? rawAllOpps.map((o) => scoreMap.has(o.id) ? { ...o, match_score: scoreMap.get(o.id) } : o)
    : rawAllOpps;
  // The sort control only shows in Browse — "deadline" already matches the
  // query's own default order, so this only does real work for the other two.
  const allOpps = tab === "all" ? sortOpportunities(scoredAllOpps, sort) : scoredAllOpps;

  const featuredOpp = (tab === "all" && !hasManualFilters)
    ? (allOpps.find((o) => o.is_featured) ?? null)
    : null;
  const gridOpps = tab === "for-you" ? forYouOpps : (featuredOpp ? allOpps.filter((o) => o.id !== featuredOpp.id) : allOpps);

  return (
    <div>
      {/* ══ Page header — title, quiet stat line, mode switch. Filters and
          sort live in the sidebar below, not here — keeping this block to
          just "what page is this / what's the headline number" leaves the
          sidebar as the one place anyone looks for narrowing the list. ══ */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6 pb-5">
          <div className="mb-2 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              Art Grants &amp; Opportunities
            </h1>
            {/* Matches the header CTA used on /feed and /partner/dashboard —
                solid foreground, not the teal brand accent or the .btn-sm
                variant (undocumented in the design system, and not what any
                other page's header button actually uses). */}
            <Link
              href="/list-an-opportunity"
              className="shrink-0 bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              List opportunity
            </Link>
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

          {/* Stats — same stacked number-over-label pattern as the homepage
              hero. A 2-col grid on mobile (not a single stacked column —
              four full-width rows reads too tall) with its own gap for
              spacing; a flex row with border-r dividers from sm up, where
              they all fit on one line (a wrapped flex row would orphan the
              border-r on whichever stat wraps last). */}
          <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-row sm:flex-wrap sm:gap-0">
            <div className="sm:mr-6 sm:border-r sm:border-border sm:pr-6">
              <p className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                {tab === "for-you"
                  ? forYouOpps.length
                  : (hasManualFilters && allOpps.length < stats.count ? allOpps.length : stats.count)}
              </p>
              <p className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">
                {tab === "for-you"
                  ? (matchMode === "scored" ? "matched for you" : "open in your disciplines")
                  : (hasManualFilters && allOpps.length < stats.count ? "filtered results" : "active opportunities")}
              </p>
            </div>
            {tab === "all" && (
              <>
                <div className="sm:mr-6 sm:border-r sm:border-border sm:pr-6">
                  <p className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--urgent)]">
                    {stats.closingThisWeek}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">close this week</p>
                </div>
                <div className="sm:mr-6 sm:border-r sm:border-border sm:pr-6">
                  <p className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                    {stats.freeToEnter}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">free to enter</p>
                </div>
                <div>
                  <p className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                    {stats.totalFunding > 0 ? formatFunding(stats.totalFunding) : "–"}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">approx. funding tracked</p>
                </div>
              </>
            )}
          </div>

          {/* Mode switch — always visible */}
          <Suspense>
            <OpportunitiesTabSwitch activeTab={tab as "for-you" | "all"} matchCount={forYouOpps.length} />
          </Suspense>
        </div>
      </div>

      {/* ══ Content — sidebar (Browse only) + results, on the feed surface ══ */}
      <div className="min-h-screen bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          {params.welcome === "1" && isArtist && (
            <div className="mb-6 border border-black bg-black px-6 py-4 text-white">
              <p className="text-sm font-semibold">Your profile is set up.</p>
              <p className="text-sm opacity-80">
                {profile?.email_verified_at
                  ? "These are open in your disciplines right now. We’ll email you new ones every week."
                  : "These are open in your disciplines right now. Confirm your email and they’ll land in your inbox every week."}
              </p>
            </div>
          )}

          {/* For You tab content — no sidebar, this is already a curated list */}
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
                  ) : forYouOpps.length === 0 ? (
                    <div className="space-y-2 bg-card p-8 text-center">
                      <p className="text-sm font-medium">Nothing open in your disciplines right now</p>
                      <p className="text-xs text-muted-foreground">
                        New listings are added weekly, and you&rsquo;ll see them here first.{" "}
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

          {/* Browse tab content — sidebar + results */}
          {tab === "all" && (
            <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8 lg:items-start">
              {/* Sticky from lg up. Unscrolled, "Sort by" already lines up
                  with "Featured" — both sit inside the same py-6 content
                  wrapper, no extra offset needed there. But once stuck, the
                  sticky offset IS the only thing standing in for that py-6
                  gap — top-0 (or flush against the header) would yank the
                  sidebar hard against the header with no breathing room the
                  moment it caught up, unlike everything scrolling normally
                  beneath it. header height (52px) + that same py-6 (24px)
                  reproduces the gap it had before scrolling started. */}
              <aside className="mb-6 lg:sticky lg:top-[76px] lg:mb-0">
                <Suspense>
                  <OpportunityFilters />
                </Suspense>
              </aside>

              <div className="space-y-6">
                {featuredOpp && <FeaturedOpportunityHero opportunity={featuredOpp} />}

                {gridOpps.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No opportunities match those filters. New listings are added regularly.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-end">
                      <OpportunityViewToggle />
                    </div>
                    <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={!!user} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
