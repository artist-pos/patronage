import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { HUB_CONTENT } from "@/lib/hub-content";
import {
  DISCIPLINE_HUBS,
  HUB_TYPE_LABEL,
  MIN_INDEXABLE_LISTINGS,
  getDisciplineHubCounts,
  getDisciplineOpportunities,
  isDisciplineSlug,
} from "@/lib/discipline-hubs";
import { formatDeadline, isRegionalHubType, type Faq } from "@/lib/regional-hubs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

async function loadHub(typeSlug: string, disciplineSlug: string) {
  if (!isRegionalHubType(typeSlug) || !isDisciplineSlug(disciplineSlug)) return null;
  const discipline = DISCIPLINE_HUBS[disciplineSlug];
  const [opportunities, counts] = await Promise.all([
    getDisciplineOpportunities(typeSlug, discipline),
    getDisciplineHubCounts(),
  ]);
  return { discipline, opportunities, counts };
}

export async function generateDisciplineHubMetadata(
  typeSlug: string,
  disciplineSlug: string
): Promise<Metadata> {
  const hub = await loadHub(typeSlug, disciplineSlug);
  if (!hub) return { title: "Opportunities | Patronage" };

  const { discipline, opportunities } = hub;
  const label = HUB_TYPE_LABEL[typeSlug];
  const lower = label.toLowerCase();
  const year = new Date().getFullYear();
  const next = opportunities.find((o) => o.deadline);

  const title = `${discipline} ${lower} for NZ and Australian artists ${year} | Patronage`;
  const description =
    opportunities.length > 0
      ? `${opportunities.length} live ${discipline.toLowerCase()} ${lower}${
          next?.deadline ? `, next closing ${formatDeadline(next.deadline)}` : ""
        }. Deadlines, funding and how to apply, updated weekly.`
      : `${discipline} ${lower} for New Zealand and Australian artists. None are open right now: check back soon.`;
  const path = `/opportunities/${typeSlug}/${disciplineSlug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    ...(opportunities.length < MIN_INDEXABLE_LISTINGS && { robots: { index: false, follow: true } }),
    openGraph: { title, description, url: `${SITE_URL}${path}`, type: "website", siteName: "Patronage", locale: "en_NZ" },
  };
}

export async function DisciplineHubPage({
  typeSlug,
  disciplineSlug,
}: {
  typeSlug: string;
  disciplineSlug: string;
}) {
  const hub = await loadHub(typeSlug, disciplineSlug);
  if (!hub || !isRegionalHubType(typeSlug)) notFound();

  const { discipline, opportunities, counts } = hub;
  const label = HUB_TYPE_LABEL[typeSlug];
  const lower = label.toLowerCase();
  const path = `/opportunities/${typeSlug}/${disciplineSlug}`;
  const next = opportunities.find((o) => o.deadline) ?? null;
  const organisers = [...new Set(opportunities.map((o) => o.organiser).filter(Boolean))].slice(0, 8);

  const otherDisciplines = Object.entries(DISCIPLINE_HUBS)
    .filter(([slug]) => slug !== disciplineSlug && (counts[typeSlug]?.[slug] ?? 0) >= MIN_INDEXABLE_LISTINGS)
    .map(([slug, name]) => ({ slug, name, count: counts[typeSlug][slug] }));

  const faqs: Faq[] = [
    {
      q: `What ${discipline.toLowerCase()} ${lower} are open right now?`,
      a:
        opportunities.length > 0
          ? `${opportunities.length} ${discipline.toLowerCase()} ${lower} ${opportunities.length === 1 ? "is" : "are"} open for New Zealand and Australian artists${
              next?.deadline ? `, and the next to close is ${next.title} on ${formatDeadline(next.deadline)}` : ""
            }. The list is updated weekly.`
          : `None are listed right now. Browse all ${lower} at ${SITE_URL}/opportunities/${typeSlug}, or check back soon.`,
    },
    {
      q: `Can I apply if I'm not in New Zealand or Australia?`,
      a: `Some listings are open internationally and some are for residents only. Each listing states who can apply.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}${path}`,
        url: `${SITE_URL}${path}`,
        name: `${discipline} ${lower}`,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Opportunities", item: `${SITE_URL}/opportunities` },
            { "@type": "ListItem", position: 2, name: label, item: `${SITE_URL}/opportunities/${typeSlug}` },
            { "@type": "ListItem", position: 3, name: discipline, item: `${SITE_URL}${path}` },
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
          <li className="text-foreground">{discipline}</li>
        </ol>
      </nav>

      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{discipline} {lower}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {opportunities.length > 0
            ? `${opportunities.length} ${discipline.toLowerCase()} ${lower} for New Zealand and Australian artists ${opportunities.length === 1 ? "is" : "are"} open right now${
                next?.deadline ? `. The next to close is ${next.title}, on ${formatDeadline(next.deadline)}` : ""
              }.`
            : `No ${discipline.toLowerCase()} ${lower} are open right now. Check back soon.`}
        </p>
        {organisers.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">From {organisers.join(", ")}.</p>
        )}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">
          <Link href={`/opportunities/${typeSlug}`} className="underline underline-offset-2">
            Browse all {lower}
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
            More {lower}
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherDisciplines.map((d) => (
              <Link
                key={d.slug}
                href={`/opportunities/${typeSlug}/${d.slug}`}
                className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
              >
                {d.name} {lower} ({d.count})
              </Link>
            ))}
            <Link
              href={`/opportunities/${typeSlug}/new-zealand`}
              className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
            >
              {label} in New Zealand
            </Link>
            <Link
              href={`/opportunities/${typeSlug}/australia`}
              className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs hover:bg-stone-200 transition-colors"
            >
              {label} in Australia
            </Link>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Questions</h2>
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
