import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getOpportunityById } from "@/lib/opportunities";
import { formatFunding } from "@/components/opportunities/OpportunityCard";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const opp = await getOpportunityById(id);
  if (!opp) return { title: "Opportunity not found — Patronage" };

  const description =
    opp.caption ?? opp.description ?? `${opp.type} opportunity by ${opp.organiser}.`;

  return {
    title: `${opp.title} | Art Funding | Patronage`,
    description,
    openGraph: {
      title: `${opp.title} | Art Funding | Patronage`,
      description,
      ...(opp.featured_image_url && {
        images: [
          {
            url: opp.featured_image_url,
            width: 1200,
            height: 630,
            alt: opp.title,
          },
        ],
      }),
    },
  };
}

export default async function OpportunityPage({ params }: Props) {
  const { id } = await params;
  const opp = await getOpportunityById(id);
  if (!opp) notFound();

  const fundingLabel =
    opp.funding_range?.trim() ||
    (opp.funding_amount != null ? formatFunding(opp.funding_amount) : null);

  const deadline = opp.deadline
    ? new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const location = opp.city ? `${opp.city}, ${opp.country}` : opp.country;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

      {/* Breadcrumb */}
      <Link
        href="/opportunities"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to opportunities
      </Link>

      {/* Featured image */}
      {opp.featured_image_url && (
        <div className="w-full border border-black bg-white overflow-hidden">
          <Image
            src={opp.featured_image_url}
            alt={opp.title}
            width={1200}
            height={630}
            unoptimized
            priority
            className="w-full h-auto max-h-[360px] object-contain"
          />
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.type}</span>
        <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.country}</span>
        {opp.grant_type && (
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.grant_type}</span>
        )}
        {opp.recipients_count != null && (
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
          </span>
        )}
        {(opp.sub_categories ?? []).map((cat) => (
          <span
            key={cat}
            className="text-xs border border-black/40 text-muted-foreground px-1.5 py-0.5 leading-none"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Title + organiser */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{opp.title}</h1>
        <p className="text-sm text-muted-foreground font-mono">{opp.organiser}</p>
      </div>

      {/* Vital stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-black p-5">
        {fundingLabel && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Funding</p>
            <p className="font-mono font-bold text-sm">{fundingLabel}</p>
          </div>
        )}
        {deadline && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Deadline</p>
            <p className="font-mono text-sm">{deadline}</p>
          </div>
        )}
        {location && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Location</p>
            <p className="font-mono text-sm">{location}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {(opp.full_description || opp.description) && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            About
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {opp.full_description ?? opp.description}
          </p>
        </div>
      )}

      {/* CTA */}
      {opp.url && (
        <a
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block border border-black px-6 py-3 text-sm font-semibold hover:bg-black hover:text-white transition-colors"
        >
          Visit grant website →
        </a>
      )}

      {/* Back link */}
      <div className="border-t border-border pt-6">
        <Link
          href="/opportunities"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to opportunities
        </Link>
      </div>
    </div>
  );
}
