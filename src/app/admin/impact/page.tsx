import type { Metadata } from "next";
import { getImpactMetrics } from "@/lib/admin";
import { ExportButtons } from "./ExportButtons";

export const metadata: Metadata = { title: "Impact Report — Patronage Admin" };

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-border p-4 space-y-1">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DistributionTable({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No data yet.</p>;
  const max = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <div className="space-y-2">
      {rows.map(([label, count]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-32 shrink-0 text-right truncate">{label}</span>
          <div className="flex-1 bg-muted h-2.5 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-black" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-xs font-mono tabular-nums w-12 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

function FundingDistTable({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No data yet.</p>;
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, amount]) => (
          <tr key={label} className="border-b border-border">
            <td className="py-2">{label}</td>
            <td className="py-2 text-right tabular-nums font-semibold">{fmt(amount)}</td>
            <td className="py-2 text-right tabular-nums text-muted-foreground text-xs w-12">
              {total > 0 ? `${Math.round((amount / total) * 100)}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ImpactPage() {
  const metrics = await getImpactMetrics();
  const year = new Date().getFullYear();

  const fundingByTypeSorted = Object.entries(metrics.fundingByType).sort((a, b) => b[1] - a[1]);
  const fundingByRegionSorted = Object.entries(metrics.fundingByRegion).sort((a, b) => b[1] - a[1]);
  const careerStageSorted = Object.entries(metrics.artistDemographics.byCareerStage).sort((a, b) => b[1] - a[1]);
  const countryDemoSorted = Object.entries(metrics.artistDemographics.byCountry).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-12 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">State of Arts Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide impact report — generated {new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <ExportButtons metrics={metrics} year={year} />
      </div>

      {/* ── Platform totals ─────────────────────────────────────────────── */}
      <Section title="Platform Overview">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Opportunities tracked" value={metrics.totalOpportunitiesTracked.toLocaleString()} />
          <Stat label="Applications processed" value={metrics.totalApplicationsProcessed.toLocaleString()} />
          <Stat label="Arts organisations" value={metrics.artsOrgsCount} sub="active on platform" />
          <Stat label="Countries served" value={metrics.activeCountries.length} sub={metrics.activeCountries.join(", ")} />
        </div>
      </Section>

      {/* ── Funding flow ────────────────────────────────────────────────── */}
      <Section title="Funding Facilitated">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Total funding facilitated"
            value={metrics.totalFundingFacilitated > 0 ? fmt(metrics.totalFundingFacilitated) : "—"}
            sub="sum of approved opportunity pools"
          />
          <Stat
            label="Artists funded"
            value={metrics.distinctArtistsFunded}
            sub="reached selected / approved status"
          />
          <Stat
            label="Avg funding per artist"
            value={metrics.avgFundingPerArtist > 0 ? fmt(metrics.avgFundingPerArtist) : "—"}
          />
          <Stat
            label="Funded via Patronage"
            value={metrics.artistsFundedThroughPatronage}
            sub="verified pipeline approvals"
          />
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 mt-2">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">By opportunity type</p>
            <FundingDistTable rows={fundingByTypeSorted} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">By region</p>
            <FundingDistTable rows={fundingByRegionSorted} />
          </div>
        </div>
      </Section>

      {/* ── Career trajectory ───────────────────────────────────────────── */}
      <Section title="Career Trajectory">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Artists with first opportunity via Patronage"
            value={metrics.artistsFundedThroughPatronage}
            sub="unique verified pipeline recipients"
          />
          <Stat
            label="Repeat success artists"
            value={metrics.repeatSuccessCount}
            sub="2 or more pipeline approvals"
          />
          <Stat
            label="Avg days to first opportunity"
            value={metrics.avgDaysToFirstOpportunity !== null ? metrics.avgDaysToFirstOpportunity : "—"}
            sub={metrics.avgDaysToFirstOpportunity !== null ? "from profile creation to first approval" : "not enough data yet"}
          />
        </div>
        {metrics.repeatSuccessCount > 0 && metrics.artistsFundedThroughPatronage > 0 && (
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              {Math.round((metrics.repeatSuccessCount / metrics.artistsFundedThroughPatronage) * 100)}%
            </strong>{" "}
            of funded artists have received multiple opportunities through Patronage.
          </p>
        )}
      </Section>

      {/* ── Economic multiplier ─────────────────────────────────────────── */}
      <Section title="Economic Multiplier">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Arts organisations" value={metrics.artsOrgsCount} sub="posting on Patronage" />
          <Stat label="Active regions" value={metrics.activeCountries.length} sub="countries with live listings" />
          <Stat label="Active cities" value={metrics.activeCities.length} />
        </div>

        {metrics.activeCities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Cities & regions with active listings</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {metrics.activeCities.slice(0, 30).join(" · ")}
              {metrics.activeCities.length > 30 && ` · +${metrics.activeCities.length - 30} more`}
            </p>
          </div>
        )}

        {metrics.crossBorderApps.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Cross-border applications (artist country → opportunity country)</p>
            <table className="w-full text-sm">
              <tbody>
                {metrics.crossBorderApps.map(({ artistCountry, oppCountry, count }) => (
                  <tr key={`${artistCountry}-${oppCountry}`} className="border-b border-border">
                    <td className="py-2">
                      {artistCountry} <span className="text-muted-foreground">→</span> {oppCountry}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Artist demographics ──────────────────────────────────────────── */}
      <Section title="Artist Demographics">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">By career stage</p>
            <DistributionTable rows={careerStageSorted} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">By country</p>
            <DistributionTable rows={countryDemoSorted} />
          </div>
        </div>
      </Section>

      {/* ── Print-only footer ───────────────────────────────────────────── */}
      <div className="hidden print:block pt-8 border-t border-border text-xs text-muted-foreground">
        <p>Patronage — connecting New Zealand and Australian artists with opportunities.</p>
        <p>patronage.nz · Report generated {new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
    </div>
  );
}
