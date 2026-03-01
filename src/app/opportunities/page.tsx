import { Suspense } from "react";
import { getOpportunities, getMarketplaceStats } from "@/lib/opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import type { CountryEnum, OppTypeEnum } from "@/types/database";

export const metadata = {
  title: "Opportunities — Patronage",
  description:
    "Browse grants, residencies, commissions, and open calls for NZ and AUS artists.",
};

interface PageProps {
  searchParams: Promise<{ type?: string; country?: string }>;
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type as OppTypeEnum | undefined;
  const country = params.country as CountryEnum | undefined;

  const [opportunities, stats] = await Promise.all([
    getOpportunities({ type, country }),
    getMarketplaceStats(),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">

      {/* Page heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          {opportunities.length} listing{opportunities.length !== 1 ? "s" : ""}
          {type || country
            ? ` · filtered by${type ? ` ${type}` : ""}${country ? ` · ${country}` : ""}`
            : ""}
        </p>
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

      {/* Grid */}
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No opportunities match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
