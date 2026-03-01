import Link from "next/link";
import { getAnalytics, getGrantPerformance, getMediumTrends } from "@/lib/admin";
import type { MediumTrend, GrantPerformance } from "@/lib/admin";

function BarChart({ data }: { data: MediumTrend[] }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No filter activity yet.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map(({ medium, count }) => (
        <div key={medium} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-24 shrink-0 text-right truncate">{medium}</span>
          <div className="flex-1 bg-muted h-3 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-black"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums w-6 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

export const metadata = { title: "Admin Dashboard — Patronage" };

const TOOLS = [
  { href: "/admin/artists", label: "Manage Artists", description: "Activate, deactivate, mark as Patronage Supported, or delete." },
  { href: "/admin/opportunities", label: "Manage Opportunities", description: "Activate, deactivate, or delete listings." },
  { href: "/admin/upload", label: "CSV Upload", description: "Bulk-import opportunities from a CSV file." },
  { href: "/admin/digest", label: "Weekly Digest", description: "Preview, export subscribers, and send the digest email." },
];

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border border-border p-4 space-y-1">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const [a, grants, mediums] = await Promise.all([
    getAnalytics(),
    getGrantPerformance(),
    getMediumTrends(),
  ]);

  const typeRows = Object.entries(a.byType).sort((x, y) => y[1] - x[1]);
  const countryRows = Object.entries(a.byCountry).sort((x, y) => y[1] - x[1]);

  return (
    <div className="space-y-12">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

      {/* ── Stats grid ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Active artists" value={a.profilesActive} />
          <Stat label="Inactive artists" value={a.profilesInactive} />
          <Stat
            label="New this week"
            value={a.profilesThisWeek}
            sub="artist signups"
          />
          <Stat label="Active listings" value={a.opportunitiesActive} />
          <Stat label="Inactive / expired" value={a.opportunitiesInactive} />
          <Stat
            label="Expiring this week"
            value={a.opportunitiesExpiringSoon}
            sub="live opportunities"
          />
        </div>
      </section>

      {/* ── Breakdowns ─────────────────────────────── */}
      <section className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Opportunities by type
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {typeRows.length === 0 && (
                <tr>
                  <td className="py-1 text-muted-foreground">No data</td>
                </tr>
              )}
              {typeRows.map(([type, count]) => (
                <tr key={type} className="border-b border-border">
                  <td className="py-2">{type}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Opportunities by country
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {countryRows.length === 0 && (
                <tr>
                  <td className="py-1 text-muted-foreground">No data</td>
                </tr>
              )}
              {countryRows.map(([country, count]) => (
                <tr key={country} className="border-b border-border">
                  <td className="py-2">{country}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Grant Performance (last 30 days) ───────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Grant Performance — Last 30 Days
          </h2>
          <Link
            href="/admin/opportunities"
            className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage →
          </Link>
        </div>
        {grants.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No engagement data yet. Events are tracked when visitors click &ldquo;Read More&rdquo; or &ldquo;View opportunity&rdquo;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Grant</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Read More</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground text-right">Click-throughs</th>
                  <th className="py-2 font-medium text-muted-foreground text-right">Report</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.opportunity_id} className="border-b border-border">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium truncate max-w-[200px]">{g.title}</p>
                      <p className="text-muted-foreground truncate">{g.organiser}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{g.engagements}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{g.clicks}</td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={`/admin/opportunities/${g.opportunity_id}/report`}
                        className="underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Report →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Medium Trends ───────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Medium Trends — Last 30 Days
        </h2>
        <BarChart data={mediums} />
      </section>

      {/* ── Tools ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Tools
        </h2>
        <ul className="divide-y divide-border border-t border-border">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="flex items-center justify-between py-4 group"
              >
                <div>
                  <p className="text-sm font-medium group-hover:underline underline-offset-2">
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <span className="text-muted-foreground text-sm">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
