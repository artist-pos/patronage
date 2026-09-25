import Link from "next/link";
import type { Opportunity } from "@/types/database";
import { formatFunding } from "./OpportunityCard";

const TAG_CLS =
  "border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)] whitespace-nowrap";

/* Mirrors OpportunityPin's deadlineBits in ExplorePinCards.tsx — same urgency
   colour scale, so a featured listing reads consistently with the pin grid. */
function deadlineBits(deadline: string | null): { label: string; cls: string } {
  if (!deadline) return { label: "Open", cls: "text-[color:var(--fg-muted)]" };
  const days = Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { label: "Closes today", cls: "text-[color:var(--urgent)]" };
  if (days <= 2) return { label: `${days} day${days === 1 ? "" : "s"} left`, cls: "text-[color:var(--urgent)]" };
  if (days <= 14) return { label: `${days} days left`, cls: "text-[color:var(--warning)]" };
  if (days > 21) return { label: `${Math.round(days / 7)} weeks left`, cls: "text-[color:var(--fg-muted)]" };
  return { label: `${days} days left`, cls: "text-[color:var(--fg-muted)]" };
}

interface Props {
  opportunity: Opportunity;
  /** Below sm: a short row (small image beside title, funding and deadline;
   *  no blurb, tags or footer link) so the regular list starts on screen one.
   *  sm and up are unchanged. */
  compact?: boolean;
}

export function FeaturedOpportunityHero({ opportunity: o, compact = false }: Props) {
  // Mobile-only overrides; every one is reset from sm up.
  const c = (full: string, small: string) => (compact ? small : full);
  const d = deadlineBits(o.deadline);
  const funding = o.funding_amount ? formatFunding(o.funding_amount) : o.funding_range ?? null;
  const displayedTags = (o.sub_categories ?? []).slice(0, 4);
  const href = `/opportunities/${o.slug ?? o.id}`;

  return (
    <section className="space-y-3">
      <p className="t-section-label">Featured</p>

      <Link href={href} className={`pin group flex bg-card sm:flex-row ${c("flex-col", "flex-row")}`}>
        {/* Image — left, stretches to match content panel height on desktop */}
        <div className={`relative shrink-0 overflow-hidden bg-stone-100 sm:h-auto sm:min-h-72 sm:w-[45%] ${c("h-56", "w-28 self-stretch")}`}>
          {o.featured_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-pin-img
              src={o.featured_image_url}
              alt={o.title}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-end p-4 bg-stone-900">
              <span className="text-white/20 font-mono text-5xl font-bold uppercase leading-none">
                {o.type}
              </span>
            </div>
          )}
        </div>

        {/* Content — right */}
        <div className={`flex min-w-0 flex-1 flex-col sm:gap-4 sm:p-8 ${c("gap-4 p-6", "gap-2.5 p-4")}`}>
          <div>
            <div className={`t-kicker sm:mb-2.5 ${c("mb-2.5", "mb-1.5")}`}>{o.type}</div>
            <h2 className={`font-semibold leading-tight tracking-[-0.022em] sm:text-3xl ${c("text-2xl", "text-[17px]")}`}>
              {o.title}
            </h2>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">
              {o.organiser}
            </p>
          </div>

          {/* Funding + deadline row */}
          <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
            {funding ? (
              <span className="truncate font-mono text-base font-semibold">{funding}</span>
            ) : <span />}
            <span className={`shrink-0 font-mono text-[11px] ${d.cls}`}>{d.label}</span>
          </div>

          {/* Blurb */}
          {(o.caption || o.description) && (
            <p className={`line-clamp-3 text-sm leading-[1.65] text-muted-foreground ${c("", "max-sm:hidden")}`}>
              {o.caption ?? o.description}
            </p>
          )}

          {/* Tags */}
          <div className={`flex flex-wrap gap-1 ${c("", "max-sm:hidden")}`}>
            {o.country && <span className={TAG_CLS}>{o.country}</span>}
            {o.entry_fee === 0 && <span className={TAG_CLS}>free</span>}
            {displayedTags.map((t) => (
              <span key={t} className={TAG_CLS}>{t}</span>
            ))}
          </div>

          {/* CTA */}
          <div className={`mt-auto border-t border-border pt-4 ${c("", "max-sm:hidden")} font-mono text-[11px] text-muted-foreground transition-colors group-hover:text-foreground`}>
            View opportunity →
          </div>
        </div>
      </Link>
    </section>
  );
}
