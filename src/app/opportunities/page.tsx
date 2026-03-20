import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats } from "@/lib/opportunities";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { FoundOpportunityButton } from "@/components/opportunities/FoundOpportunityButton";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { createClient } from "@/lib/supabase/server";
import type { CountryEnum, OppTypeEnum } from "@/types/database";

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

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">

      {/* Page heading */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Art Grants & Opportunities</h1>
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
          {hasManualFilters && opportunities.length < stats.count
            ? <><strong>Showing {opportunities.length}</strong> of <strong>{stats.count}</strong> Active Opportunities</>
            : <><strong>{stats.count}</strong> Active Opportunities</>
          }
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
          No opportunities match those filters. New listings are added regularly.
        </p>
      ) : (
        <MasonryGrid opportunities={opportunities} view={view} isAuthenticated={!!user} />
      )}
    </div>
  );
}
