import Link from "next/link";
import { getAnalytics } from "@/lib/admin";

export const metadata = { title: "Admin Dashboard — Patronage" };

const TOOLS = [
  { href: "/admin/artists", label: "Manage Artists", description: "Activate, deactivate, mark as Patronage Supported, or delete." },
  { href: "/admin/opportunities", label: "Manage Opportunities", description: "Activate, deactivate, or delete listings." },
  { href: "/admin/upload", label: "CSV Upload", description: "Bulk-import opportunities from a CSV file." },
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
  const a = await getAnalytics();

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
