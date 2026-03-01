import { Suspense } from "react";
import { getOpportunities } from "@/lib/opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
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

  const opportunities = await getOpportunities({ type, country });

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          {opportunities.length} active listing
          {opportunities.length !== 1 ? "s" : ""}
          {type || country
            ? ` · filtered by${type ? ` ${type}` : ""}${country ? ` · ${country}` : ""}`
            : ""}
        </p>
      </div>

      <Suspense>
        <OpportunityFilters />
      </Suspense>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No opportunities match the current filters.
        </p>
      ) : (
        <div>
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
