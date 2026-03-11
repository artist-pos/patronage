import Image from "next/image";
import Link from "next/link";
import type { Opportunity } from "@/types/database";

// Tags hidden from cards — still used for filtering/matching, shown on detail page
const HIDDEN_CARD_TAGS = new Set([
  // Career stage
  "Emerging", "Early Career", "Mid-Career", "Established",
  // Eligibility / audience focus
  "Māori", "Pasifika", "Indigenous", "Youth", "International", "Travel", "Research",
]);

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
  /** Pass true for the first few above-fold cards to prioritise LCP. */
  priority?: boolean;
}

export function OpportunityCard({ opp, isPreview = false, view = "gallery", priority = false }: Props) {
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
              loading={priority ? undefined : "lazy"}
              priority={priority}
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
    <article className={`overflow-hidden flex flex-col h-full rounded-xl shadow-sm hover:shadow-md transition-shadow duration-150 ${opp.is_featured ? "border-[3px] border-black" : "border border-black"}`}>

      {/* ── Image / Logo — flexible height, object-contain so logos aren't cropped ── */}
      <div className="relative w-full overflow-hidden bg-white border-b border-black">
        <div className="relative" style={{ height: 160, overflow: "hidden", backgroundColor: "#f5f5f5" }}>
          {opp.featured_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={opp.featured_image_url}
              alt={opp.title}
              loading={priority ? "eager" : "lazy"}
              style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }}
            />
          )}

          {/* $ Range — top-right overlay */}
          {fundingLabel && (
            <div className="absolute top-0 right-0 bg-black text-white font-mono font-bold text-sm px-3 py-1.5 leading-none">
              {fundingLabel}
            </div>
          )}

          {/* Status badge — top-left overlay */}
          {preOpen ? (
            <div className="absolute top-2 left-2 z-10 bg-white text-black border border-black font-mono text-xs px-3 py-1 rounded-full leading-none">
              Not yet open
            </div>
          ) : closing && (
            <div className="absolute top-2 left-2 z-10 bg-black text-white font-mono text-xs px-3 py-1 rounded-full leading-none">
              Closing soon
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-4 flex flex-col gap-2">

        {/* ── Always-visible vital stats ── */}

        {/* Type / country / grant_type / recipients tags */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 leading-none">
            {opp.type}
          </span>
          <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 leading-none">
            {opp.country}
          </span>
          {opp.grant_type && (
            <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 leading-none">
              {opp.grant_type}
            </span>
          )}
          {opp.recipients_count != null && (
            <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 leading-none">
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

        {/* Medium / discipline tags — max 3 visible, career/eligibility tags hidden */}
        {(() => {
          const visible = (opp.sub_categories ?? []).filter(t => !HIDDEN_CARD_TAGS.has(t));
          const shown = visible.slice(0, 3);
          const overflow = visible.length - shown.length;
          if (shown.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1.5">
              {shown.map((cat) => (
                <span
                  key={cat}
                  className="text-xs bg-stone-50 text-stone-500 border border-stone-200 rounded-full px-3 py-1 leading-none"
                >
                  {cat}
                </span>
              ))}
              {overflow > 0 && (
                <span className="text-xs bg-stone-50 text-stone-500 border border-stone-200 rounded-full px-3 py-1 leading-none">
                  +{overflow} more
                </span>
              )}
            </div>
          );
        })()}
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
