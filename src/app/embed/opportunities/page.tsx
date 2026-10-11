import { getOpportunities } from "@/lib/opportunities";
import { opportunityUrl } from "@/lib/digest";
import type { Metadata } from "next";
import type { OpportunityFilters } from "@/types/database";

export const metadata: Metadata = {
  title: "Opportunities",
  robots: { index: false, follow: false },
};

// Embedded boards are hit by every visitor of the host site; the listing data
// only changes with the scrape, so a short cache keeps them cheap.
export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const MAX_LIMIT = 20;

interface Props {
  searchParams: Promise<{
    type?: string;
    country?: string;
    discipline?: string;
    limit?: string;
    theme?: string;
  }>;
}

function fmtDeadline(d: string | null): string {
  if (!d) return "Open call";
  return `Closes ${new Date(d + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}`;
}

/**
 * A live opportunities board for other sites: a school department, a gallery, an
 * art society. Open calls only (getOpportunities drops anything past its
 * deadline), filtered with ?type=&country=&discipline=&limit=.
 */
export default async function EmbedOpportunitiesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.limit ?? "8", 10) || 8));
  const dark = sp.theme === "dark";

  const all = await getOpportunities(
    {
      ...(sp.type && { type: sp.type as OpportunityFilters["type"] }),
      ...(sp.country && { country: sp.country as OpportunityFilters["country"] }),
      ...(sp.discipline && { discipline: sp.discipline }),
    },
    60
  );
  const opps = all.slice(0, limit);

  const ink = dark ? "#fafaf9" : "#0a0a0a";
  const muted = dark ? "#a8a29e" : "#6c6c6c";
  const rule = dark ? "#292524" : "#e7e5e4";

  return (
    <div
      style={{
        background: dark ? "#0c0a09" : "#FAFAF9",
        color: ink,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: 16,
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > header, body > footer { display: none !important; }
            body > main { padding: 0 !important; flex: none !important; }
          `,
        }}
      />

      {opps.length === 0 ? (
        <p style={{ fontSize: 14, color: muted }}>Nothing open right now.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {opps.map((o) => (
            <li key={o.id} style={{ padding: "12px 0", borderTop: `1px solid ${rule}` }}>
              <a
                href={opportunityUrl(o, SITE_URL, "embed")}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: ink, textDecoration: "none", fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}
              >
                {o.title}
              </a>
              <div style={{ fontSize: 13, color: muted, marginTop: 3 }}>
                {o.organiser} &middot; {fmtDeadline(o.deadline)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p
        style={{
          marginTop: 16,
          fontSize: 11,
          color: dark ? "#78716c" : "#a8a29e",
          textAlign: "right",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <a
          href={`${SITE_URL}/opportunities?ref=embed`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          Powered by Patronage
        </a>
      </p>
    </div>
  );
}
