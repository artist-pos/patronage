import Image from "next/image";
import type { Opportunity } from "@/types/database";

export function formatFunding(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M+`;
  if (amount >= 100_000) return `$${Math.round(amount / 1_000)}k+`;
  if (amount >= 10_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount.toLocaleString("en-NZ")}`;
}

function daysLeft(deadline: string | null): string {
  if (!deadline) return "Open";
  const d = Math.ceil(
    (new Date(deadline + "T00:00:00").getTime() - Date.now()) / 86_400_000
  );
  if (d <= 0) return "Closing today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

function isClosingSoon(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = Math.ceil(
    (new Date(deadline + "T00:00:00").getTime() - Date.now()) / 86_400_000
  );
  return d <= 7;
}

interface Props {
  opp: Opportunity;
  isPreview?: boolean;
}

export function OpportunityCard({ opp, isPreview = false }: Props) {
  const closing = isClosingSoon(opp.deadline);
  const days = daysLeft(opp.deadline);

  const inner = (
    <article className="border border-black overflow-hidden flex flex-col h-full">
      {/* Featured image / placeholder */}
      <div className="relative aspect-[16/9] overflow-hidden bg-muted shrink-0">
        {opp.featured_image_url ? (
          <Image
            src={opp.featured_image_url}
            alt={opp.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              {opp.type}
            </span>
          </div>
        )}

        {/* $ Value — top-right overlay */}
        {opp.funding_amount != null && (
          <div className="absolute top-0 right-0 bg-black text-white font-mono font-bold text-sm px-3 py-1.5 leading-none">
            {formatFunding(opp.funding_amount)}
          </div>
        )}

        {/* Closing soon — top-left overlay */}
        {closing && (
          <div className="absolute top-0 left-0 bg-black text-white font-mono text-xs px-2 py-1 leading-none">
            Closing soon
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.type}
          </span>
          <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
            {opp.country}
          </span>
          {opp.grant_type && (
            <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
              {opp.grant_type}
            </span>
          )}
          {opp.recipients_count != null && (
            <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
              {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold leading-snug">{opp.title}</h2>

        {/* Organiser + days (mono) */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs truncate">{opp.organiser}</span>
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {days}
          </span>
        </div>

        {/* Description */}
        {opp.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
            {opp.description}
          </p>
        )}

        {/* CTA */}
        {opp.url && !isPreview && (
          <span className="text-xs underline underline-offset-2 mt-auto">
            View opportunity →
          </span>
        )}
      </div>
    </article>
  );

  if (isPreview || !opp.url) return <div className="h-full">{inner}</div>;

  return (
    <a
      href={opp.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full"
    >
      {inner}
    </a>
  );
}
