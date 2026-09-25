import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getOpportunities, getMarketplaceStats, getMatchedOpportunities, getArtistScoreMap } from "@/lib/opportunities";
import { sortOpportunities, type OppSort, OPP_SORTS } from "@/lib/opportunity-sort";
import { ForYouTeaser } from "@/components/opportunities/ForYouTeaser";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { OpportunityViewToggle } from "@/components/opportunities/OpportunityViewToggle";
import { TrackedNavLink } from "@/components/analytics/TrackedNavLink";
import { FeaturedOpportunityHero } from "@/components/opportunities/FeaturedOpportunityHero";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { selectInstantMatches } from "@/lib/opportunity-match";
import type { CountryEnum, OppTypeEnum, Opportunity, Profile } from "@/types/database";

// Hidden preview of a restructured /opportunities header: a real title with
// the stats folded into one line of links, one control bar (tabs, filters,
// view) directly above the results, and the organisation CTA demoted to a
// text link. Same data and components as /opportunities.
export const metadata: Metadata = {
  title: "Opportunities v2 (preview)",
  robots: { index: false, follow: false },
};

// Same cache as the live page (same key), so the preview costs nothing extra.
const getCachedBrowseData = unstable_cache(
  async (_today: string) => {
    const [stats, opps] = await Promise.all([getMarketplaceStats(), getOpportunities({})]);
    return { stats, opps };
  },
  ["opportunities-browse-v1"],
  { revalidate: 300, tags: ["opportunities"] }
);

const FILTER_KEYS = ["type", "country", "discipline", "freeEntry", "eligibility", "careerStage", "search", "closing"] as const;

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
    /** Preview-only: "week" narrows to listings closing in the next 7 days. */
    closing?: string;
    welcome?: string;
  }>;
}

export default async function OpportunitiesV2({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type as OppTypeEnum | undefined;
  const country = params.country as CountryEnum | undefined;
  const discipline = params.discipline;
  const freeEntry = params.freeEntry === "1";
  const eligibility = params.eligibility;
  const careerStage = params.careerStage;
  const search = params.search?.trim() || undefined;
  const closingWeek = params.closing === "week";
  const view = params.view === "list" ? "list" : "gallery";
  const sort: OppSort = (OPP_SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as OppSort)
    : "deadline";

  const { user } = await getServerUser();
  let isArtist = false;
  let hasDisciplines = false;
  let profile: Profile | null = null;
  if (user) {
    profile = await getProfileById(user.id);
    isArtist = profile?.role === "artist" || profile?.role === "owner";
    hasDisciplines = isArtist && Array.isArray(profile?.disciplines) && profile.disciplines.length > 0;
  }

  const tab = params.tab === "for-you" ? "for-you" : "all";
  const hasQueryFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry || search);
  const hasManualFilters = hasQueryFilters || closingWeek;

  const today = new Date().toISOString().split("T")[0];
  const weekAhead = new Date(`${today}T00:00:00Z`);
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
  const weekFromNow = weekAhead.toISOString().split("T")[0];
  const wantsAllList = tab === "all" || !isArtist;
  const [browse, filteredOpps, matchedOpps, scoreMap] = await Promise.all([
    getCachedBrowseData(today),
    wantsAllList && hasQueryFilters
      ? getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage, search })
      : Promise.resolve(null),
    tab === "for-you" && isArtist && hasDisciplines ? getMatchedOpportunities(user!.id) : Promise.resolve([]),
    tab === "all" && isArtist && hasDisciplines ? getArtistScoreMap(user!.id) : Promise.resolve(new Map<string, number>()),
  ]);
  const stats = browse.stats;
  const baseAll = wantsAllList ? (filteredOpps ?? browse.opps) : [];
  // Same window as getMarketplaceStats().closingThisWeek, applied in memory.
  const rawAllOpps = closingWeek
    ? baseAll.filter((o) => !!o.deadline && o.deadline >= today && o.deadline <= weekFromNow)
    : baseAll;

  const instantOpps =
    tab === "for-you" && isArtist && hasDisciplines && matchedOpps.length === 0 && profile
      ? selectInstantMatches(browse.opps, profile, 12)
      : [];
  const forYouOpps: Opportunity[] = matchedOpps.length > 0 ? matchedOpps : instantOpps;

  const scoredAllOpps =
    scoreMap.size > 0 ? rawAllOpps.map((o) => (scoreMap.has(o.id) ? { ...o, match_score: scoreMap.get(o.id) } : o)) : rawAllOpps;
  const allOpps = tab === "all" ? sortOpportunities(scoredAllOpps, sort) : scoredAllOpps;

  const featuredOpp = tab === "all" && !hasManualFilters ? (allOpps.find((o) => o.is_featured) ?? null) : null;
  const gridOpps =
    tab === "for-you" ? forYouOpps : featuredOpp ? allOpps.filter((o) => o.id !== featuredOpp.id) : allOpps;

  // ── Links built on the server: tabs, stat shortcuts, clearing a chip ──
  const hrefWith = (changes: Record<string, string | null>, dropFilters = false) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v) q.set(k, v);
    q.delete("welcome");
    if (dropFilters) FILTER_KEYS.forEach((k) => q.delete(k));
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/opportunities-v2?${s}` : "/opportunities-v2";
  };
  const allHref = hrefWith({ tab: null });
  const forYouHref = hrefWith({ tab: "for-you" }, true);
  const closingHref = hrefWith({ tab: null, closing: "week" }, true);
  const freeHref = hrefWith({ tab: null, freeEntry: "1" }, true);

  const tabCls = (active: boolean) =>
    `relative flex h-12 items-center gap-1.5 text-[14px] font-medium tracking-[-0.01em] transition-colors ${
      active
        ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-foreground"
        : "text-[color:var(--fg-muted)] hover:text-foreground"
    }`;
  const statLink = "underline decoration-[color:var(--fg-subtle)] underline-offset-4 transition-colors hover:decoration-foreground";

  const shownCount = tab === "for-you" ? forYouOpps.length : allOpps.length;

  return (
    <div>
      {/* ══ Header — what this page is, then the numbers as shortcuts ══ */}
      <div className="mx-auto max-w-[1600px] px-4 pb-5 pt-7 sm:px-6 sm:pt-9">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <h1 className="t-display text-[32px] sm:text-[40px]">Opportunities</h1>
            <p className="mt-2 max-w-[560px] text-[14.5px] leading-[1.55] text-[color:var(--fg-muted)]">
              Grants, residencies, commissions and open calls for artists in Aotearoa and beyond.
            </p>
          </div>
          <TrackedNavLink
            href="/list-an-opportunity"
            event="list_opportunity_click"
            props={{ placement: "opportunities_header" }}
            className="text-[13px] text-[color:var(--fg-muted)] underline decoration-[color:var(--fg-subtle)] underline-offset-4 transition-colors hover:text-foreground max-sm:order-last"
          >
            Organisation? List an opportunity →
          </TrackedNavLink>
        </div>

        {/* Stats as one line of links: each one is also a way into the list. */}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-[color:var(--fg-muted)]">
          <TrackedNavLink href="/opportunities-v2" event="opportunities_shortcut_click" props={{ shortcut: "open" }} className={statLink}>
            <span className="font-semibold text-foreground">{stats.count}</span> open
          </TrackedNavLink>
          <span aria-hidden className="text-[color:var(--fg-subtle)]">·</span>
          <TrackedNavLink href={closingHref} event="opportunities_shortcut_click" props={{ shortcut: "closing_week" }} className={`${statLink} text-[color:var(--urgent)]`}>
            <span className="font-semibold">{stats.closingThisWeek}</span> close this week
          </TrackedNavLink>
          <span aria-hidden className="text-[color:var(--fg-subtle)]">·</span>
          <TrackedNavLink href={freeHref} event="opportunities_shortcut_click" props={{ shortcut: "free_entry" }} className={statLink}>
            <span className="font-semibold text-foreground">{stats.freeToEnter}</span> free to enter
          </TrackedNavLink>
        </p>
      </div>

      {/* ══ Control bar — mode tabs left, narrowing + view right. Sticks under
          the site header so filters stay in reach while scrolling. ══ */}
      <div className="sticky top-[53px] z-20 border-y border-border bg-[rgb(250_250_249/0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <nav aria-label="Opportunity lists" className="flex shrink-0 items-center gap-6 whitespace-nowrap">
            <TrackedNavLink href={allHref} event="opportunities_tab_click" props={{ tab: "all" }} className={tabCls(tab === "all")} aria-current={tab === "all" ? "page" : undefined}>
              All
            </TrackedNavLink>
            <TrackedNavLink href={forYouHref} event="opportunities_tab_click" props={{ tab: "for-you", signed_in: user ? "true" : "false" }} className={tabCls(tab === "for-you")} aria-current={tab === "for-you" ? "page" : undefined}>
              For you
              {user && isArtist && forYouOpps.length > 0 && (
                <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">{forYouOpps.length}</span>
              )}
            </TrackedNavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {tab === "all" && (
              <span className="hidden font-mono text-[11px] text-[color:var(--fg-subtle)] sm:inline">
                {shownCount} shown
              </span>
            )}
            {/* Mobile filter trigger; the sidebar carries the same panel from lg up. */}
            {tab === "all" && (
              <div className="lg:hidden">
                <Suspense>
                  <OpportunityFilters />
                </Suspense>
              </div>
            )}
            <Suspense>
              <OpportunityViewToggle />
            </Suspense>
          </div>
        </div>
      </div>

      {/* ══ Content ══ */}
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

          {tab === "for-you" && (
            <>
              {!user && <ForYouTeaser />}
              {user && !isArtist && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Personalised matches are available for artist profiles.
                </p>
              )}
              {user && isArtist && (
                <>
                  {!hasDisciplines ? (
                    <div className="space-y-3 bg-card p-8 text-center">
                      <p className="text-sm font-medium">Complete your profile to get personalised matches</p>
                      <p className="text-xs text-muted-foreground">
                        Add your disciplines so we can surface the most relevant opportunities for your practice.
                      </p>
                      <Link
                        href="/profile/edit"
                        className="inline-block bg-foreground px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-82"
                      >
                        Edit profile
                      </Link>
                    </div>
                  ) : forYouOpps.length === 0 ? (
                    <div className="space-y-2 bg-card p-8 text-center">
                      <p className="text-sm font-medium">Nothing open in your disciplines right now</p>
                      <p className="text-xs text-muted-foreground">
                        New listings are added weekly, and you&rsquo;ll see them here first.{" "}
                        <Link href={allHref} className="underline underline-offset-2">
                          Browse all opportunities
                        </Link>{" "}
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

          {tab === "all" && (
            <div className="lg:grid lg:grid-cols-[240px_1fr] lg:items-start lg:gap-8">
              {/* Header (53) + control bar (49) + the content's own 24px gap. */}
              {/* Scrolls on its own when taller than the space left under the
                  bar, so the last filters are never stranded off-screen. */}
              <aside className="hidden lg:sticky lg:top-[126px] lg:block lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto lg:pb-2 scrollbar-hide">
                <Suspense>
                  <OpportunityFilters />
                </Suspense>
              </aside>

              <div className="space-y-6">
                {/* Active shortcut filter, removable. The sidebar filters show
                    their own state; this one comes from the stat line. */}
                {closingWeek && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={hrefWith({ closing: null })}
                      className="inline-flex items-center gap-2 border border-foreground bg-card px-3 py-1.5 font-mono text-[11px] text-foreground"
                    >
                      Closing this week <span aria-hidden>×</span>
                      <span className="sr-only">(remove filter)</span>
                    </Link>
                    <span className="font-mono text-[11px] text-[color:var(--fg-muted)]">{allOpps.length} shown</span>
                  </div>
                )}
                {featuredOpp && <FeaturedOpportunityHero opportunity={featuredOpp} compact />}
                {gridOpps.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No opportunities match those filters. New listings are added regularly.
                  </p>
                ) : (
                  <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={!!user} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
