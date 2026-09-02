import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOpportunities } from "@/lib/opportunities";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import {
  HUB_CONTENT,
  HUB_TYPE_MAP,
  HUB_COUNTRY_MAP,
  HUB_COUNTRY_LABEL,
  HUB_TYPE_LABEL,
} from "@/lib/hub-content";
import type { OppTypeEnum, CountryEnum } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  typeSlug: string;
  countrySlug?: string;
}

export function generateHubMetadata(typeSlug: string, countrySlug?: string): Metadata {
  const key = countrySlug ? `${typeSlug}/${countrySlug}` : typeSlug;
  const hub = HUB_CONTENT[key];
  if (!hub) return { title: "Opportunities | Patronage" };
  const canonicalPath = countrySlug
    ? `/opportunities/${typeSlug}/${countrySlug}`
    : `/opportunities/${typeSlug}`;
  return {
    // absolute: metaTitle already carries the brand, so skip the root layout's
    // "%s | Patronage" template — otherwise it renders "... | Patronage | Patronage".
    title: { absolute: hub.metaTitle },
    description: hub.metaDescription,
    alternates: { canonical: `${SITE_URL}${canonicalPath}` },
    openGraph: {
      title: hub.metaTitle,
      description: hub.metaDescription,
      url: `${SITE_URL}${canonicalPath}`,
      type: "website",
    },
  };
}

export async function HubPage({ typeSlug, countrySlug }: Props) {
  const oppType = HUB_TYPE_MAP[typeSlug];
  if (!oppType) notFound();
  if (countrySlug && !HUB_COUNTRY_MAP[countrySlug]) notFound();

  const key = countrySlug ? `${typeSlug}/${countrySlug}` : typeSlug;
  const hub = HUB_CONTENT[key];
  if (!hub) notFound();

  const country = countrySlug ? (HUB_COUNTRY_MAP[countrySlug] as CountryEnum) : undefined;
  const opportunities = await getOpportunities({
    type: oppType as OppTypeEnum,
    ...(country && { country }),
  });

  const typeLabel = HUB_TYPE_LABEL[typeSlug] ?? typeSlug;
  const countryLabel = countrySlug ? (HUB_COUNTRY_LABEL[countrySlug] ?? countrySlug) : undefined;

  // On the all-countries hub, link down to whichever country hubs actually
  // have editorial content — not every type has them.
  const countryHubs = countrySlug
    ? []
    : Object.keys(HUB_COUNTRY_MAP)
        .filter((slug) => HUB_CONTENT[`${typeSlug}/${slug}`])
        .map((slug) => ({ slug, label: HUB_COUNTRY_LABEL[slug] ?? slug }));

  const canonicalPath = countrySlug
    ? `/opportunities/${typeSlug}/${countrySlug}`
    : `/opportunities/${typeSlug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}${canonicalPath}`,
    name: hub.title,
    description: hub.metaDescription,
    url: `${SITE_URL}${canonicalPath}`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Opportunities", item: `${SITE_URL}/opportunities` },
        { "@type": "ListItem", position: 2, name: typeLabel, item: `${SITE_URL}/opportunities/${typeSlug}` },
        ...(countryLabel
          ? [{ "@type": "ListItem", position: 3, name: countryLabel, item: `${SITE_URL}${canonicalPath}` }]
          : []),
      ],
    },
  };

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <li><Link href="/opportunities" className="hover:text-foreground transition-colors">Opportunities</Link></li>
          <li aria-hidden="true">/</li>
          <li className={countryLabel ? "hover:text-foreground transition-colors" : "text-foreground"}>
            {countryLabel
              ? <Link href={`/opportunities/${typeSlug}`}>{typeLabel}</Link>
              : typeLabel}
          </li>
          {countryLabel && (
            <>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{countryLabel}</li>
            </>
          )}
        </ol>
      </nav>

      {/* Header — title, one-line intro, live count. Keep this short: the
          listings must be the first thing on screen. Long-form copy sits
          below the grid. */}
      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{hub.title}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{hub.intro}</p>
        <p className="text-xs text-muted-foreground pt-2">
          {opportunities.length} active {typeLabel.toLowerCase()}{countryLabel ? ` in ${countryLabel}` : ""}
        </p>
      </div>

      {countryHubs.length > 0 && (
        <nav className="flex flex-wrap items-center gap-2" aria-label={`${typeLabel} by country`}>
          {countryHubs.map(({ slug, label }) => (
            <Link
              key={slug}
              href={`/opportunities/${typeSlug}/${slug}`}
              className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
            >
              {typeLabel} in {label}
            </Link>
          ))}
        </nav>
      )}

      {/* Live opportunities grid */}
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No {typeLabel.toLowerCase()} listed right now. Check back soon or{" "}
          <Link href="/opportunities" className="underline underline-offset-2">browse all opportunities</Link>.
        </p>
      ) : (
        <MasonryGrid opportunities={opportunities} />
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Long-form guide — below the listings on purpose */}
      <div className="space-y-6 max-w-3xl">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
          About {typeLabel.toLowerCase()}{countryLabel ? ` in ${countryLabel}` : ""}
        </h2>
        <div
          className="text-sm leading-relaxed text-foreground space-y-4 [&_p]:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: hub.body.replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>") }}
        />
        <p className="text-sm">
          <Link href="/resources" className="underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
            Resources for artists →
          </Link>
        </p>
      </div>
    </div>
  );
}
