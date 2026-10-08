import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { HUB_CONTENT, HUB_TYPE_LABEL } from "@/lib/hub-content";
import { getCitiesForRegion, getRegionBySlug, regionFullName } from "@/lib/regions";
import {
  MIN_INDEXABLE_LISTINGS,
  cityNamesFor,
  formatDeadline,
  getRegionalHubCounts,
  getRegionalOpportunities,
  hubLinksForRegion,
  isRegionalHubType,
  type Faq,
} from "@/lib/regional-hubs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

async function loadHub(typeSlug: string, regionSlug: string) {
  if (!isRegionalHubType(typeSlug)) return null;
  const region = await getRegionBySlug(regionSlug);
  if (!region) return null;
  const cities = await getCitiesForRegion(region.id);
  const [opportunities, counts] = await Promise.all([
    getRegionalOpportunities(cityNamesFor(cities), typeSlug),
    getRegionalHubCounts(),
  ]);
  return { region, opportunities, counts };
}

export async function generateRegionalHubMetadata(
  typeSlug: string,
  regionSlug: string
): Promise<Metadata> {
  const hub = await loadHub(typeSlug, regionSlug);
  if (!hub) return { title: "Opportunities | Patronage" };

  const { region, opportunities } = hub;
  const label = HUB_TYPE_LABEL[typeSlug];
  const lower = label.toLowerCase();
  const fullName = regionFullName(region);
  const year = new Date().getFullYear();
  const next = opportunities.find((o) => o.deadline);

  const title = `${label} in ${region.name} ${year} | Patronage`;
  const description =
    opportunities.length > 0
      ? `${opportunities.length} live ${lower} for artists in ${fullName}${
          next?.deadline ? `, next closing ${formatDeadline(next.deadline)}` : ""
        }. Deadlines, funding and how to apply, updated weekly.`
      : `${label} for artists in ${fullName}. None are open right now: browse New Zealand-wide ${lower} or check back soon.`;
  const path = `/opportunities/${typeSlug}/${regionSlug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    // Too few listings to be worth a search result: stay reachable by link, but
    // out of the index until the page has something to show.
    ...(opportunities.length < MIN_INDEXABLE_LISTINGS && {
      robots: { index: false, follow: true },
    }),
    openGraph: { title, description, url: `${SITE_URL}${path}`, type: "website", siteName: "Patronage", locale: "en_NZ" },
  };
}

export async function RegionalHubPage({
  typeSlug,
  regionSlug,
}: {
  typeSlug: string;
  regionSlug: string;
}) {
  const hub = await loadHub(typeSlug, regionSlug);
  if (!hub || !isRegionalHubType(typeSlug)) notFound();

  const { region, opportunities, counts } = hub;
  const label = HUB_TYPE_LABEL[typeSlug];
  const lower = label.toLowerCase();
  const fullName = regionFullName(region);
  const path = `/opportunities/${typeSlug}/${regionSlug}`;
  const next = opportunities.find((o) => o.deadline) ?? null;
  const organisers = [...new Set(opportunities.map((o) => o.organiser).filter(Boolean))].slice(0, 8);
  const otherHubs = hubLinksForRegion(counts, regionSlug).filter((l) => l.typeSlug !== typeSlug);

  const faqs: Faq[] = [
    {
      q: `What ${lower} are open in ${region.name} right now?`,
      a:
        opportunities.length > 0
          ? `${opportunities.length} ${lower} in ${fullName} ${opportunities.length === 1 ? "is" : "are"} open${
              next?.deadline ? `, and the next to close is ${next.title} on ${formatDeadline(next.deadline)}` : ""
            }. The list is updated weekly.`
          : `None are listed in ${fullName} right now. New Zealand-wide ${lower} are listed at ${SITE_URL}/opportunities/${typeSlug}/new-zealand, and any of them may suit you.`,
    },
    {
      q: `Do I have to live in ${region.name} to apply?`,
      a: `Check each listing's eligibility. Some are for ${region.name} artists only, and others are open across New Zealand or beyond. The listing shows who can apply.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}${path}`,
        url: `${SITE_URL}${path}`,
        name: `${label} in ${region.name}`,
        about: { "@type": "Place", name: fullName, containedInPlace: { "@type": "Country", name: "New Zealand" } },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Opportunities", item: `${SITE_URL}/opportunities` },
            { "@type": "ListItem", position: 2, name: label, item: `${SITE_URL}/opportunities/${typeSlug}` },
            { "@type": "ListItem", position: 3, name: region.name, item: `${SITE_URL}${path}` },
          ],
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: opportunities.length,
          itemListElement: opportunities.slice(0, 24).map((o, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/opportunities/${o.slug ?? o.id}`,
            name: o.title,
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <li><Link href="/opportunities" className="hover:text-foreground transition-colors">Opportunities</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/opportunities/${typeSlug}`} className="hover:text-foreground transition-colors">{label}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">{region.name}</li>
        </ol>
      </nav>

      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{label} in {region.name}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {opportunities.length > 0
            ? `${opportunities.length} ${lower} for artists in ${fullName} ${opportunities.length === 1 ? "is" : "are"} open right now${
                next?.deadline ? `. The next to close is ${next.title}, on ${formatDeadline(next.deadline)}` : ""
              }.`
            : `No ${lower} in ${fullName} are open right now. Check back soon, or browse the New Zealand-wide list below.`}
        </p>
        {organisers.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">From {organisers.join(", ")}.</p>
        )}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">
          <Link href={`/opportunities/${typeSlug}/new-zealand`} className="underline underline-offset-2">
            Browse {lower} across New Zealand
          </Link>
          {" "}or{" "}
          <Link href={`/artists/${regionSlug}`} className="underline underline-offset-2">
            see the artists working in {region.name}
          </Link>
          .
        </p>
      ) : (
        <MasonryGrid opportunities={opportunities} />
      )}

      <div className="border-t border-border" />

      <div className="max-w-3xl space-y-8">
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
            More in {region.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherHubs.map((l) => (
              <Link
                key={l.typeSlug}
                href={`/opportunities/${l.typeSlug}/${regionSlug}`}
                className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
              >
                {l.label} in {region.name} ({l.count})
              </Link>
            ))}
            <Link
              href={`/artists/${regionSlug}`}
              className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
            >
              Artists in {region.name}
            </Link>
            <Link
              href={`/opportunities/${typeSlug}/new-zealand`}
              className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
            >
              {label} across New Zealand
            </Link>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Questions
          </h2>
          {faqs.map((f) => (
            <div key={f.q} className="space-y-1">
              <h3 className="text-sm font-semibold">{f.q}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
          {HUB_CONTENT[typeSlug] && (
            <p className="text-sm leading-relaxed text-muted-foreground">{HUB_CONTENT[typeSlug].intro}</p>
          )}
        </section>
      </div>
    </div>
  );
}
