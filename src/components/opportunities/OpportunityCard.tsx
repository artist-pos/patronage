import Image from "next/image";
import Link from "next/link";
import type { Opportunity, RecurrencePattern } from "@/types/database";
import { SaveButton } from "./SaveButton";

const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  monthly:   "Monthly",
  bimonthly: "Every 2 months",
  quarterly: "Quarterly",
  biannual:  "Every 6 months",
  annual:    "Annual",
  custom:    "Recurring",
};

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

function isClosingToday(opensAt: string | null, deadline: string | null): boolean {
  if (!deadline) return false;
  const now = Date.now();
  if (opensAt && new Date(opensAt + "T00:00:00").getTime() > now) return false;
  const d = Math.ceil((new Date(deadline + "T00:00:00").getTime() - now) / 86_400_000);
  return d <= 1;
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
  isAuthenticated?: boolean;
  savedByUser?: boolean;
}

export function OpportunityCard({ opp, isPreview = false, view = "gallery", priority = false, isAuthenticated = false, savedByUser = false }: Props) {
  const closing = isClosingSoon(opp.opens_at ?? null, opp.deadline);
  const urgent = isClosingToday(opp.opens_at ?? null, opp.deadline);
  const preOpen = isPreOpen(opp.opens_at ?? null);
  const isRecurring = opp.is_recurring ?? false;
  const recurringLabel = isRecurring && opp.recurrence_pattern
    ? RECURRENCE_LABELS[opp.recurrence_pattern]
    : isRecurring ? "Recurring" : null;
  // For recurring opps with no deadline, show frequency instead of "Open"
  const days = (!opp.deadline && isRecurring && opp.recurrence_pattern && opp.recurrence_pattern !== "custom")
    ? RECURRENCE_LABELS[opp.recurrence_pattern]
    : daysLeft(opp.opens_at ?? null, opp.deadline);
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

        {/* Recurring badge */}
        {recurringLabel && (
          <span className="hidden md:block text-xs bg-stone-800 text-white px-1.5 py-0.5 leading-none whitespace-nowrap shrink-0">
            {recurringLabel}
          </span>
        )}

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
    <article className={`overflow-hidden flex flex-row md:flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-150 ${opp.is_featured ? "border-[3px] border-black" : "border border-black"}`}>

      {/* ── Image / Logo ── */}
      {/* Mobile: narrow left column; Desktop: full-width top section */}
      <div
        className="relative shrink-0 w-24 md:w-full md:h-[200px] overflow-hidden border-r border-black md:border-r-0 md:border-b"
        style={{ backgroundColor: "#f5f5f5" }}
      >
        {opp.featured_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opp.featured_image_url}
            alt={opp.title}
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "contain", objectPosition: "center", display: "block" }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-muted-foreground uppercase tracking-widest text-center px-1">
            {opp.type}
          </span>
        )}

        {/* Overlays — desktop only */}
        {fundingLabel && (
          <div className="hidden md:block absolute top-0 right-0 bg-black text-white font-mono font-bold text-sm px-3 py-1.5 leading-none">
            {fundingLabel}
          </div>
        )}
        {preOpen ? (
          <div className="hidden md:block absolute top-2 left-2 z-10 bg-white text-black border border-black font-mono text-xs px-3 py-1 leading-none">
            Not yet open
          </div>
        ) : closing && (
          <div className={`hidden md:block absolute top-2 left-2 z-10 font-mono text-xs px-3 py-1 leading-none ${urgent ? "bg-red-600 text-white" : "bg-black text-white"}`}>
            {urgent ? "Closes today" : "Closing soon"}
          </div>
        )}

        {/* Save button — top-right, visible on card hover */}
        {!isPreview && (
          <div className="hidden md:block absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1" onClick={(e) => e.preventDefault()}>
            <SaveButton
              opportunityId={opp.id}
              initialSaved={savedByUser}
              isAuthenticated={isAuthenticated}
            />
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-3 md:p-5 flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">

        {/* Tags */}
        <div className="flex flex-wrap gap-1 md:gap-1.5">
          <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 md:px-3 py-1 leading-none">
            {opp.type}
          </span>
          <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 md:px-3 py-1 leading-none">
            {opp.country}
          </span>
          {recurringLabel && (
            <span className="text-xs bg-stone-800 text-white rounded-full px-2 md:px-3 py-1 leading-none">
              {recurringLabel}
            </span>
          )}
          {opp.entry_fee === 0 && (
            <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 md:px-3 py-1 leading-none">
              Free to enter
            </span>
          )}
          {opp.grant_type && (
            <span className="hidden md:inline-block text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 leading-none">
              {opp.grant_type}
            </span>
          )}
          {opp.recipients_count != null && (
            <span className="hidden md:inline-block text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1 leading-none">
              {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Funding label — mobile only (desktop uses image overlay) */}
        {fundingLabel && (
          <span className="md:hidden font-mono text-xs font-bold">{fundingLabel}</span>
        )}

        {/* Title */}
        <h2 className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</h2>

        {/* Organiser + days */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs truncate">{opp.organiser}</span>
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {days}
          </span>
        </div>

        {/* Sub-category tags — desktop only */}
        {(() => {
          const visible = (opp.sub_categories ?? []).filter(t => !HIDDEN_CARD_TAGS.has(t));
          const shown = visible.slice(0, 2);
          const overflow = visible.length - shown.length;
          if (shown.length === 0) return null;
          return (
            <div className="hidden md:flex flex-wrap gap-1.5">
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

        {/* Caption — desktop only */}
        {(opp.caption || opp.description) && (
          <p className="hidden md:block text-xs text-muted-foreground leading-relaxed flex-1">
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
