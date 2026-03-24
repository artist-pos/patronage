import type { Metadata } from "next";
import { getPipelineReport } from "@/lib/admin";
import { PipelineExportButton } from "./PipelineExportButton";
import { AGE_BRACKETS } from "@/lib/constants/demographics";

export const metadata: Metadata = { title: "Pipeline Report — Patronage Admin" };

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

function BarRow({ label, count, max, pct }: { label: string; count: number; max: number; pct?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-36 shrink-0 truncate text-right">{label}</span>
      <div className="flex-1 bg-muted h-2 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-black" style={{ width: `${(count / max) * 100}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums w-20 text-right text-muted-foreground">
        {count}{pct !== undefined ? ` (${pct}%)` : ""}
      </span>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default async function PipelineReportPage() {
  const report = await getPipelineReport();
  const year = new Date().getFullYear();

  const careerStageRows = Object.entries(report.byCareerStage).sort((a, b) => b[1] - a[1]);
  const careerMax = Math.max(...careerStageRows.map(([, n]) => n), 1);

  const ageBracketOrder = AGE_BRACKETS.map((b) => b.label);
  const ageBracketRows = ageBracketOrder
    .map((label) => ({ label, count: report.byAgeBracket[label] ?? 0 }))
    .filter((r) => r.count > 0);
  const ageMax = Math.max(...ageBracketRows.map((r) => r.count), 1);

  const identityRows = Object.entries(report.byIdentityTag).sort((a, b) => b[1] - a[1]);
  const identityMax = Math.max(...identityRows.map(([, n]) => n), 1);

  const cityMax = Math.max(...report.byCity.map(([, n]) => n), 1);
  const disciplineMax = Math.max(...report.byDiscipline.map(([, n]) => n), 1);

  return (
    <div className="space-y-12 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Pipeline Report</h1>
          <p className="text-sm text-muted-foreground">
            Cross-round aggregate — all pipeline opportunities · {year} ·{" "}
            generated {new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <PipelineExportButton report={report} />
      </div>

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      <Section title="Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Pipeline opportunities"
            value={report.totalPipelineOpportunities}
            sub={`${report.totalPipelineOpportunitiesThisYear} this year`}
          />
          <Stat
            label="Total applications"
            value={report.totalApplications.toLocaleString()}
            sub={`${report.totalApplicationsThisYear} this year`}
          />
          <Stat
            label="Unique applicants"
            value={report.uniqueApplicants.toLocaleString()}
            sub="distinct artist profiles"
          />
          <Stat
            label="Artists funded"
            value={report.artistsFunded}
            sub="reached selected / approved"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Funding distributed"
            value={report.fundingDistributed > 0 ? fmt(report.fundingDistributed) : "—"}
            sub="sum of funded opportunity pools"
          />
          <Stat
            label="Avg applications per opportunity"
            value={report.avgAppsPerOpportunity}
          />
          <Stat
            label="Avg selection rate"
            value={`${report.avgConversionRate}%`}
            sub="applications → selected"
          />
        </div>
      </Section>

      {/* ── Engagement funnel ────────────────────────────────────────────── */}
      {report.totalViews > 0 && (
        <Section title="Engagement Funnel (all pipeline opportunities)">
          <div className="space-y-2">
            {[
              { label: "Total views", count: report.totalViews, pct: null },
              { label: "Applications", count: report.totalApplications, pct: report.viewToAppRate },
              { label: "Artists funded", count: report.artistsFunded, pct: report.totalApplications > 0 ? Math.round((report.artistsFunded / report.totalApplications) * 100) : 0 },
            ].map(({ label, count, pct }) => (
              <div key={label} className="flex items-center gap-3 min-w-0">
                <div className="w-24 shrink-0 text-right">
                  <span className="text-xl font-semibold tabular-nums">{count.toLocaleString()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    {pct !== null && pct !== undefined && (
                      <span className="text-xs text-muted-foreground">({pct}%)</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full"
                      style={{ width: `${pct === null ? 100 : Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Applications over time ───────────────────────────────────────── */}
      <Section title="Applications by Month (last 12 months)">
        {(() => {
          const maxMonth = Math.max(...report.applicationsByMonth.map((m) => m.count), 1);
          return (
            <div className="space-y-1.5">
              {report.applicationsByMonth.map(({ month, count }) => {
                const [y, m] = month.split("-");
                const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-NZ", { month: "short", year: "2-digit" });
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-12 shrink-0 text-right">{label}</span>
                    <div className="flex-1 bg-muted h-4 relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-black/70" style={{ width: `${(count / maxMonth) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono tabular-nums w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Section>

      {/* ── Demographics ─────────────────────────────────────────────────── */}
      <Section title="Applicant Demographics">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {/* Career stage */}
          {careerStageRows.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Career stage</p>
              <div className="space-y-1.5">
                {careerStageRows.map(([label, count]) => (
                  <BarRow key={label} label={label} count={count} max={careerMax} />
                ))}
              </div>
            </div>
          )}

          {/* Disciplines */}
          {report.byDiscipline.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Disciplines (top 10)</p>
              <div className="space-y-1.5">
                {report.byDiscipline.map(([label, count]) => (
                  <BarRow key={label} label={label} count={count} max={disciplineMax} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Age brackets */}
        {ageBracketRows.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-muted-foreground">Age bracket</p>
              <p className="text-xs text-muted-foreground">{report.appsWithAgeData} of {report.totalApplications} applicants provided age data</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ageBracketRows.map(({ label, count }) => {
                const pct = report.appsWithAgeData > 0 ? Math.round((count / report.appsWithAgeData) * 100) : 0;
                return (
                  <div key={label} className="border border-black/10 p-2 text-center">
                    <p className="text-lg font-semibold">{count}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Identity tags */}
        {identityRows.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-muted-foreground">Identity</p>
              <p className="text-xs text-muted-foreground">{report.appsWithIdentityData} of {report.totalApplications} applicants provided identity data</p>
            </div>
            <p className="text-xs text-muted-foreground">Percentages sum to more than 100% — applicants may select multiple.</p>
            <div className="space-y-1.5">
              {identityRows.map(([label, count]) => {
                const pct = report.totalApplications > 0 ? Math.round((count / report.totalApplications) * 100) : 0;
                return <BarRow key={label} label={label} count={count} max={identityMax} pct={pct} />;
              })}
            </div>
          </div>
        )}

        {/* Cities + countries */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 pt-4 border-t border-border">
          {report.byCity.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Top cities (by application volume)</p>
              <div className="space-y-1.5">
                {report.byCity.map(([label, count]) => (
                  <BarRow key={label} label={label} count={count} max={cityMax} />
                ))}
              </div>
            </div>
          )}
          {Object.keys(report.byCountry).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Country</p>
              <div className="space-y-1.5">
                {Object.entries(report.byCountry).sort((a, b) => b[1] - a[1]).map(([label, count]) => {
                  const max = Math.max(...Object.values(report.byCountry), 1);
                  return <BarRow key={label} label={label} count={count} max={max} />;
                })}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Follow-up outcomes ───────────────────────────────────────────── */}
      {report.followupsSent > 0 && (
        <Section title="Follow-up Outcomes (all pipeline rounds)">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Follow-ups sent" value={report.followupsSent} />
            <Stat label="Responses received" value={report.followupsCompleted} sub={report.followupsSent > 0 ? `${Math.round((report.followupsCompleted / report.followupsSent) * 100)}% response rate` : undefined} />
            <Stat label="Testimonials" value={report.testimonialCount} sub="with consent" />
            <Stat label="Artists funded" value={report.artistsFunded} />
          </div>

          {report.followupsCompleted > 0 && (
            <div className="border border-border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Outcomes reported</p>
              {report.furtherOppsCount > 0 && (
                <p className="text-sm">{report.furtherOppsCount} of {report.followupsCompleted} reported winning or being shortlisted for further opportunities.</p>
              )}
              {report.exhibitionsCount > 0 && (
                <p className="text-sm">{report.exhibitionsCount} of {report.followupsCompleted} reported exhibiting new work.</p>
              )}
              {report.pressCount > 0 && (
                <p className="text-sm">{report.pressCount} of {report.followupsCompleted} reported press or media coverage.</p>
              )}
              {report.communityCount > 0 && (
                <p className="text-sm">{report.communityCount} of {report.followupsCompleted} reported community project involvement.</p>
              )}
              {Object.keys(report.incomeBreakdown).length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">Income from practice:</p>
                  {Object.entries(report.incomeBreakdown).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                    <p key={label} className="text-sm text-muted-foreground pl-2">
                      {label}: {count} artist{count !== 1 ? "s" : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      {report.totalApplications === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">No pipeline applications yet.</p>
      )}
    </div>
  );
}
