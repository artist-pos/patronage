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

// v2 match pill — mono/600, tinted bg, square (see globals .pill-match-*)
function matchBadgeCls(score: number): string {
  if (score >= 70) return "pill pill-match-strong";
  if (score >= 50) return "pill pill-match-partial";
  return "pill pill-match-weak";
}

// v2 square bordered mono tag
const TAG_CLS =
  "border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)] whitespace-nowrap";

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

  // Deadline urgency colour — urgent red, ≤7 days amber, otherwise muted
  const daysCls = urgent
    ? "text-[color:var(--urgent)]"
    : closing
      ? "text-[color:var(--warning)]"
      : "text-muted-foreground";

  /* ── List row ── */
  if (view === "list") {
    const row = (
      <div className={`group flex items-center gap-4 border-b bg-card px-3 py-3 transition-colors hover:bg-[color:var(--tint)] ${opp.is_featured ? "border-b-2 border-foreground" : "border-border"}`}>
        {/* Thumbnail */}
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-white">
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
            <span className="px-1 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {opp.type}
            </span>
          )}
        </div>

        {/* Title + organiser */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug group-hover:underline underline-offset-2">
            {opp.title}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{opp.organiser}</p>
        </div>

        {/* Type tag */}
        <span className={`hidden shrink-0 sm:block ${TAG_CLS}`}>{opp.type}</span>

        {/* Recurring badge */}
        {recurringLabel && (
          <span className="hidden shrink-0 whitespace-nowrap bg-foreground px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-white md:block">
            {recurringLabel}
          </span>
        )}

        {/* Funding */}
        {fundingLabel && (
          <span className="hidden shrink-0 whitespace-nowrap font-mono text-xs font-semibold md:block">
            {fundingLabel}
          </span>
        )}

        {/* Days left */}
        <span className={`shrink-0 whitespace-nowrap font-mono text-xs ${daysCls}`}>
          {days}
        </span>

        {/* Match score — list view */}
        {matchScore !== undefined && matchScore >= 30 && (
          <span className={`shrink-0 whitespace-nowrap ${matchBadgeCls(matchScore)}`}>
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

  /* ── Gallery card — v2 opportunity pin: white surface, teal tint reveal
     on hover. Featured adds a border-strong outline. No radius, no shadow,
     no lift. ── */
  const inner = (
    <article className={`flex h-full flex-row overflow-hidden bg-card transition-colors duration-150 hover:bg-[color:var(--tint)] md:flex-col ${opp.is_featured ? "border border-foreground" : ""}`}>

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

        {/* Tags — square bordered mono chips */}
        <div className="flex flex-wrap gap-1">
          {matchScore !== undefined && matchScore >= 30 && (
            <span className={matchBadgeCls(matchScore)}>{matchScore}%</span>
          )}
          <span className={TAG_CLS}>{opp.type}</span>
          <span className={TAG_CLS}>{opp.country}</span>
          {recurringLabel && (
            <span className="whitespace-nowrap bg-foreground px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-white">
              {recurringLabel}
            </span>
          )}
          {opp.entry_fee === 0 && <span className={TAG_CLS}>Free to enter</span>}
          {opp.grant_type && (
            <span className={`hidden md:inline-flex ${TAG_CLS}`}>{opp.grant_type}</span>
          )}
          {opp.recipients_count != null && (
            <span className={`hidden md:inline-flex ${TAG_CLS}`}>
              {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Funding label — mobile only (desktop uses image overlay) */}
        {fundingLabel && (
          <span className="font-mono text-xs font-semibold md:hidden">{fundingLabel}</span>
        )}

        {/* Title */}
        <h2 className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.015em]">
          {opp.title}
        </h2>

        {/* Organiser + days */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-muted-foreground">{opp.organiser}</span>
          <span className={`whitespace-nowrap font-mono text-[11px] ${daysCls}`}>
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
            <div className="hidden flex-wrap gap-1 md:flex">
              {shown.map((cat) => (
                <span key={cat} className={TAG_CLS}>
                  {cat}
                </span>
              ))}
              {overflow > 0 && <span className={TAG_CLS}>+{overflow} more</span>}
            </div>
          );
        })()}

        {/* Match reason — desktop only, shown in For You tab */}
        {matchReason && matchScore !== undefined && (
          <p className={`hidden text-xs leading-relaxed md:block ${matchScore >= 70 ? "text-[color:var(--success)]" : matchScore >= 50 ? "text-[color:var(--warning)]" : "text-muted-foreground"}`}>
            {matchReason}
          </p>
        )}

        {/* Caption — desktop only */}
        {!matchReason && (opp.caption || opp.description) && (
          <p className="hidden flex-1 text-[13px] leading-[1.55] text-muted-foreground md:line-clamp-2 md:block">
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
