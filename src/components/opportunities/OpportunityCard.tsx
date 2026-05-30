import Image from "next/image";
import Link from "next/link";
import type { Opportunity, RecurrencePattern, OpportunityWithMatch } from "@/types/database";
import { SaveButton } from "./SaveButton";
import { OpportunityImageArea } from "./OpportunityImageArea";

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
  opp: Opportunity | OpportunityWithMatch;
  isPreview?: boolean;
  view?: "gallery" | "list";
  /** Pass true for the first few above-fold cards to prioritise LCP. */
  priority?: boolean;
  isAuthenticated?: boolean;
  savedByUser?: boolean;
}

// Deterministic ±2 jitter so clustered scores (e.g. all 72%) look naturally varied
function jitterScore(score: number, oppId: string): number {
  const val = parseInt(oppId.slice(-1), 16); // last hex char → 0–15
  return Math.max(0, Math.min(100, score + (val % 5) - 2));
}

function matchBadgeCls(score: number): string {
  if (score >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-stone-500 bg-stone-50 border-stone-200";
}

export function OpportunityCard({ opp, isPreview = false, view = "gallery", priority = false, isAuthenticated = false, savedByUser = false }: Props) {
  const rawScore = "match_score" in opp ? opp.match_score : undefined;
  const matchScore = rawScore !== undefined ? jitterScore(rawScore, opp.id) : undefined;
  const fullReason = "match_reason" in opp ? opp.match_reason : undefined;
  // Truncate at sentence boundary or 80 chars
  const matchReason = fullReason
    ? (fullReason.length > 80 ? fullReason.slice(0, fullReason.indexOf(" ", 70) + 1 || 80).trimEnd() + "…" : fullReason)
    : undefined;
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

        {/* Match score — list view */}
        {matchScore !== undefined && matchScore >= 30 && (
          <span className={`text-xs font-medium border px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${matchBadgeCls(matchScore)}`}>
            {matchScore}%
          </span>
        )}
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
      <OpportunityImageArea
        imageUrl={opp.featured_image_url ?? null}
        alt={opp.title}
        type={opp.type}
        priority={priority}
        fundingLabel={fundingLabel}
        preOpen={preOpen}
        closing={closing}
        urgent={urgent}
        isPreview={isPreview}
        opportunityId={opp.id}
        initialSaved={savedByUser}
        isAuthenticated={isAuthenticated}
      />

      {/* ── Content ── */}
      <div className="p-3 md:p-5 flex flex-col gap-1.5 md:gap-2 flex-1 min-w-0">

        {/* Tags */}
        <div className="flex flex-wrap gap-1 md:gap-1.5">
          {matchScore !== undefined && matchScore >= 30 && (
            <span className={`text-xs font-medium border rounded-full px-2 md:px-3 py-1 leading-none ${matchBadgeCls(matchScore)}`}>
              {matchScore}%
            </span>
          )}
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

        {/* Match reason — desktop only, shown in For You tab */}
        {matchReason && matchScore !== undefined && (
          <p className={`hidden md:block text-xs leading-relaxed ${matchScore >= 70 ? "text-emerald-700" : matchScore >= 50 ? "text-amber-700" : "text-stone-500"}`}>
            {matchReason}
          </p>
        )}

        {/* Caption — desktop only */}
        {!matchReason && (opp.caption || opp.description) && (
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
