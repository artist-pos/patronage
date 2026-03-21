"use client";

import type { ImpactMetrics } from "@/lib/admin";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function ExportButtons({ metrics, year }: { metrics: ImpactMetrics; year: number }) {
  function downloadJSON() {
    const data = {
      report: "State of Arts Opportunities",
      generatedAt: new Date().toISOString(),
      period: `${year}`,
      funding: {
        totalFacilitated: metrics.totalFundingFacilitated,
        formattedTotal: fmt(metrics.totalFundingFacilitated),
        byType: metrics.fundingByType,
        byRegion: metrics.fundingByRegion,
        avgPerArtist: metrics.avgFundingPerArtist,
        distinctArtistsFunded: metrics.distinctArtistsFunded,
      },
      careerImpact: {
        artistsFundedThroughPatronage: metrics.artistsFundedThroughPatronage,
        repeatSuccessArtists: metrics.repeatSuccessCount,
        avgDaysToFirstOpportunity: metrics.avgDaysToFirstOpportunity,
      },
      platform: {
        totalOpportunitiesTracked: metrics.totalOpportunitiesTracked,
        totalApplicationsProcessed: metrics.totalApplicationsProcessed,
        artsOrganisationsServed: metrics.artsOrgsCount,
        countriesServed: metrics.activeCountries,
        citiesServed: metrics.activeCities,
        crossBorderApplications: metrics.crossBorderApps,
      },
      artistDemographics: metrics.artistDemographics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patronage-state-of-arts-${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-3 print:hidden">
      <button
        type="button"
        onClick={downloadJSON}
        className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
      >
        Download Data Pack (JSON) ↓
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
