import Image from "next/image";
import Link from "next/link";
import type { Opportunity } from "@/types/database";

export function formatFunding(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M+`;
  if (amount >= 100_000) return `$${Math.round(amount / 1_000)}k+`;
  if (amount >= 10_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount.toLocaleString("en-NZ")}`;
}

function daysLeft(opensAt: string | null, deadline: string | null): string {
  const now = Date.now();
  if (opensAt) {
    const openMs = new Date(opensAt + "T00:00:00").getTime();
    if (openMs > now) {
      const d = Math.ceil((openMs - now) / 86_400_000);
      if (d === 1) return "Opens tomorrow";
      return `Opens in ${d} days`;
    }
  }
  if (!deadline) return "Open";
  const d = Math.ceil((new Date(deadline + "T00:00:00").getTime() - now) / 86_400_000);
  if (d <= 0) return "Closing today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

function isClosingSoon(opensAt: string | null, deadline: string | null): boolean {
  if (!deadline) return false;
  const now = Date.now();
  if (opensAt && new Date(opensAt + "T00:00:00").getTime() > now) return false;
  const d = Math.ceil((new Date(deadline + "T00:00:00").getTime() - now) / 86_400_000);
  return d <= 7;
}

function isPreOpen(opensAt: string | null): boolean {
  if (!opensAt) return false;
  return new Date(opensAt + "T00:00:00").getTime() > Date.now();
}

interface Props {
  opp: Opportunity;
  isPreview?: boolean;
  view?: "gallery" | "list";
}

export function OpportunityCard({ opp, isPreview = false, view = "gallery" }: Props) {
  const closing = isClosingSoon(opp.opens_at ?? null, opp.deadline);
  const preOpen = isPreOpen(opp.opens_at ?? null);
  const days = daysLeft(opp.opens_at ?? null, opp.deadline);
  const fundingLabel =
    opp.funding_range?.trim() ||
    (opp.funding_amount != null ? formatFunding(opp.funding_amount) : null);

  /* ── List row ── */
  if (view === "list") {
    const row = (
      <div className={`flex items-center gap-4 border-b py-3 px-2 hover:bg-muted/30 transition-colors group ${opp.is_featured ? "border-b-[3px] border-black" : "border-black"}`}>
        {/* Thumbnail */}
        <div className="relative w-14 h-14 shrink-0 overflow-hidden bg-white border border-black flex items-center justify-center">
          {opp.featured_image_url ? (
            <Image
              src={opp.featured_image_url}
              alt={opp.title}
              width={56}
              height={56}
              unoptimized
              className="w-full h-full object-contain"
              sizes="56px"
            />
          ) : (
            <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest text-center px-1">
              {opp.type}
            </span>
          )}
        </div>

        {/* Title + organiser */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate group-hover:underline underline-offset-2">
            {opp.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">{opp.organiser}</p>
        </div>

        {/* Type tag */}
        <span className="hidden sm:block text-xs border border-black px-1.5 py-0.5 leading-none whitespace-nowrap shrink-0">
          {opp.type}
        </span>

        {/* Funding */}
        {fundingLabel && (
          <span className="hidden md:block font-mono text-xs font-bold whitespace-nowrap shrink-0">
            {fundingLabel}
          </span>
        )}

        {/* Days left */}
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {days}
        </span>
      </div>
    );

    if (isPreview) return row;
    return (
      <Link href={`/opportunities/${opp.slug ?? opp.id}`}>
        {row}
      </Link>
    );
  }

  /* ── Gallery card ── */
  const inner = (
    <article className={`overflow-hidden flex flex-col h-full ${opp.is_featured ? "border-[3px] border-black" : "border border-black"}`}>

      {/* ── Image / Logo — flexible height, object-contain so logos aren't cropped ── */}
      <div className="relative w-full overflow-hidden bg-white border-b border-black">
        {opp.featured_image_url ? (
          <div className="relative">
            <Image
              src={opp.featured_image_url}
              alt={opp.title}
              width={800}
              height={450}
              unoptimized
              className="w-full h-auto max-h-[300px] object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />

            {/* $ Range — top-right overlay */}
            {fundingLabel && (
              <div className="absolute top-0 right-0 bg-black text-white font-mono font-bold text-sm px-3 py-1.5 leading-none">
                {fundingLabel}
              </div>
            )}

            {/* Status badge — top-left overlay */}
            {preOpen ? (
              <div className="absolute top-2 left-2 z-10 bg-white text-black border border-black font-mono text-xs px-2 py-1 leading-none">
                Not yet open
              </div>
            ) : closing && (
              <div className="absolute top-2 left-2 z-10 bg-black text-white font-mono text-xs px-2 py-1 leading-none">
                Closing soon
              </div>
            )}
          </div>
        ) : (
          /* No image: solid grey placeholder with overlaid badges */
          <div className="relative w-full h-40 bg-[#E5E7EB]">
            {fundingLabel && (
              <div className="absolute top-0 right-0 bg-black text-white font-mono font-bold text-sm px-3 py-1.5 leading-none">
                {fundingLabel}
              </div>
            )}
            {preOpen ? (
              <div className="absolute top-2 left-2 z-10 bg-white text-black border border-black font-mono text-xs px-2 py-1 leading-none">
                Not yet open
              </div>
            ) : closing && (
              <div className="absolute top-2 left-2 z-10 bg-black text-white font-mono text-xs px-2 py-1 leading-none">
                Closing soon
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-5 flex flex-col gap-2 flex-1">

        {/* ── Always-visible vital stats ── */}

        {/* Type / country / grant_type / recipients tags */}
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

        {/* Organiser + days */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs truncate">{opp.organiser}</span>
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {days}
          </span>
        </div>

        {/* Sub-category focus tags — always visible, above the fold */}
        {(opp.sub_categories ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(opp.sub_categories ?? []).map((cat) => (
              <span
                key={cat}
                className="text-xs border border-black/40 text-muted-foreground px-1.5 py-0.5 leading-none"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Caption */}
        {(opp.caption || opp.description) && (
          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
            {opp.caption ?? opp.description}
          </p>
        )}
      </div>
    </article>
  );

  if (isPreview) return <div className="h-full">{inner}</div>;
  return (
    <Link href={`/opportunities/${opp.slug ?? opp.id}`} className="block h-full">
      {inner}
    </Link>
  );
}
