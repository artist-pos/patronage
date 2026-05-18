import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats } from "@/lib/opportunities";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { FoundOpportunityButton } from "@/components/opportunities/FoundOpportunityButton";
import { FeaturedOpportunityHero } from "@/components/opportunities/FeaturedOpportunityHero";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { createClient } from "@/lib/supabase/server";
import type { CountryEnum, OppTypeEnum } from "@/types/database";

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
  searchParams: Promise<{ type?: string; country?: string; view?: string; discipline?: string; freeEntry?: string; eligibility?: string; careerStage?: string; search?: string }>;
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

  const hasManualFilters = !!(type || country || discipline || eligibility || careerStage || freeEntry || search);

  const [opportunities, stats] = await Promise.all([
    getOpportunities({ type, country, discipline, freeEntry, eligibility, careerStage, search }),
    getMarketplaceStats(),
  ]);

  const featuredOpp = !hasManualFilters ? (opportunities.find((o) => o.is_featured) ?? null) : null;
  const gridOpps = featuredOpp ? opportunities.filter((o) => o.id !== featuredOpp.id) : opportunities;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Page heading */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Art Grants &amp; Opportunities</h1>
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

      {/* Stats bar — 4 blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-black divide-x divide-y sm:divide-y-0 divide-black">
        <div className="px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums">
            {hasManualFilters && opportunities.length < stats.count ? opportunities.length : stats.count}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasManualFilters && opportunities.length < stats.count ? "filtered results" : "active opportunities"}
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

      {/* Featured opportunity hero */}
      {featuredOpp && <FeaturedOpportunityHero opportunity={featuredOpp} />}

      {/* Filters */}
      <Suspense>
        <OpportunityFilters />
      </Suspense>

      {/* Feed */}
      {gridOpps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No opportunities match those filters. New listings are added regularly.
        </p>
      ) : (
        <MasonryGrid opportunities={gridOpps} view={view} isAuthenticated={!!user} />
      )}
    </div>
  );
}
