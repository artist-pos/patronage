import Link from "next/link";
import Image from "next/image";
import type { Opportunity } from "@/types/database";
import { formatFunding } from "./OpportunityCard";

function daysLeftLabel(deadline: string | null): string {
  if (!deadline) return "Open";
  const d = Math.ceil((new Date(deadline + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (d <= 0) return "Closing today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

interface Props {
  opportunity: Opportunity;
}

export function FeaturedOpportunityHero({ opportunity: o }: Props) {
  const deadlineLabel = daysLeftLabel(o.deadline);
  const isUrgent = o.deadline !== null && Math.ceil((new Date(o.deadline + "T00:00:00").getTime() - Date.now()) / 86_400_000) <= 7;
  const funding = o.funding_amount ? formatFunding(o.funding_amount) : o.funding_range ?? null;
  const displayedTags = (o.sub_categories ?? []).slice(0, 4);
  const href = `/opportunities/${o.slug ?? o.id}`;

  return (
    <Link href={href} className="group block border border-black hover:shadow-sm transition-shadow">
      <div className="flex flex-col sm:flex-row">
        {/* Image — left strip, fixed height, wide */}
        <div className="relative sm:w-[38%] shrink-0 h-48 sm:h-56 overflow-hidden bg-stone-100">
          {o.featured_image_url ? (
            <Image
              src={o.featured_image_url}
              alt={o.title}
              fill
              className="object-contain group-hover:scale-[1.02] transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, 38vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-end p-4 bg-stone-900">
              <span className="text-white/20 font-mono text-5xl font-bold uppercase leading-none">
                {o.type}
              </span>
            </div>
          )}
          {/* Featured pill — overlaid top-left */}
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-mono uppercase tracking-widest bg-white text-black px-2 py-0.5">
              Featured
            </span>
          </div>
        </div>

        {/* Content — right side */}
        <div className="flex-1 border-t border-black sm:border-t-0 sm:border-l border-black p-5 sm:p-6 flex flex-col gap-3">
          {/* Meta row: type + country + deadline */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-stone-600">{o.type}</span>
            <span className="text-stone-300">·</span>
            <span className="text-xs text-muted-foreground">{o.country}</span>
            <span className="text-stone-300">·</span>
            <span className={`text-xs font-medium ${isUrgent ? "text-orange-600" : "text-muted-foreground"}`}>
              {deadlineLabel}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-lg sm:text-xl font-semibold leading-snug group-hover:underline underline-offset-2 line-clamp-2">
            {o.title}
          </h2>

          {/* Org + funding */}
          <p className="text-sm text-muted-foreground">
            {o.organiser}
            {funding && <> · <span className="font-medium text-foreground">{funding}</span></>}
          </p>

          {/* Blurb */}
          {(o.caption || o.description) && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {o.caption ?? o.description}
            </p>
          )}

          {/* Tags */}
          {displayedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayedTags.map((t) => (
                <span key={t} className="text-xs bg-stone-100 text-stone-600 rounded-full px-2.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-1">
            <span className="text-sm font-medium group-hover:underline underline-offset-2">
              View opportunity →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
