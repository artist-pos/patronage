import { Suspense } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getOpportunityById } from "@/lib/opportunities";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { AdminEditOpportunityModal } from "@/components/opportunities/AdminEditOpportunityModalDynamic";
import { AdminRejectButton } from "@/components/opportunities/AdminRejectButton";
import { SaveButton } from "@/components/opportunities/SaveButton";
import { ViewTracker } from "@/components/opportunities/ViewTracker";
import { ApplyButton } from "@/components/opportunities/ApplyButton";
import { OpportunityCTALink } from "@/components/opportunities/OpportunityCTALink";
import { DescriptionAccordion } from "@/components/opportunities/DescriptionAccordion";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity, RecurrencePattern } from "@/types/database";

// Opt this route into Partial Pre-rendering.
// Everything outside <Suspense> is pre-rendered at build time (near-zero TTFB).
// User-specific islands stream in after the static shell is painted.
export const experimental_ppr = true;

const FUNDING_TYPES = new Set(["Grant", "Prize", "Commission"]);

const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  monthly:   "Monthly",
  bimonthly: "Every 2 months",
  quarterly: "Quarterly",
  biannual:  "Every 6 months",
  annual:    "Annual",
  custom:    "Custom schedule",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  params: Promise<{ id: string }>;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const opp = await getOpportunityById(id);
  if (!opp) return { title: "Opportunity not found — Patronage" };

  const rawDescription = opp.caption ?? opp.description ?? opp.full_description ?? null;
  const description = rawDescription
    ? rawDescription.length > 155
      ? rawDescription.slice(0, 152) + "…"
      : rawDescription
    : `${opp.type} offered by ${opp.organiser} on Patronage.`;

  const title = `${opp.title} — ${opp.organiser} | Patronage`;
  const canonicalPath = `/opportunities/${opp.slug ?? opp.id}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      ...(opp.featured_image_url && {
        images: [{ url: opp.featured_image_url, width: 1200, height: 630, alt: opp.title }],
      }),
    },
    twitter: {
      card: opp.featured_image_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(opp.featured_image_url && { images: [opp.featured_image_url] }),
    },
  };
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SaveButtonSkeleton() {
  return <div className="w-4 h-4 rounded bg-muted animate-pulse" aria-hidden="true" />;
}

function CTASkeleton() {
  return <div className="h-12 w-48 bg-muted animate-pulse" aria-hidden="true" />;
}

// ─── Island 1: Header actions (admin controls + save button) ──────────────────
// Calls cookies() via createClient() — lives inside a <Suspense> boundary.

async function HeaderActions({
  opportunityId,
  opp,
}: {
  opportunityId: string;
  opp: Opportunity;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isSaved = false;
  let adminUser = false;

  if (user) {
    const [savedResult, profileResult] = await Promise.all([
      supabase
        .from("user_saved_opportunities")
        .select("id")
        .eq("user_id", user.id)
        .eq("opportunity_id", opportunityId)
        .single(),
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),
    ]);
    isSaved = !!savedResult.data;
    adminUser =
      profileResult.data?.role === "admin" ||
      profileResult.data?.role === "owner";
  }

  return (
    <>
      {adminUser && <AdminRejectButton id={opp.id} />}
      {adminUser && <AdminEditOpportunityModal opp={opp} />}
      <SaveButton
        opportunityId={opp.id}
        initialSaved={isSaved}
        saveCount={0}
        showCount={false}
        isAuthenticated={!!user}
      />
    </>
  );
}

// ─── Island 2: Social proof (save count + view count + trending badge) ─────────
// Separate from HeaderActions so the count query isn't duplicated.

async function SocialProof({
  opportunityId,
  viewCount,
}: {
  opportunityId: string;
  viewCount: number;
}) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("user_saved_opportunities")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId);

  const saveCount = count ?? 0;
  const isTrending = saveCount >= 5;

  if (saveCount === 0 && viewCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isTrending && (
        <span className="text-xs border border-black bg-black text-white px-1.5 py-0.5 leading-none">
          Trending
        </span>
      )}
      <p className="text-xs text-muted-foreground">
        {saveCount > 0 && `Saved by ${saveCount} artist${saveCount !== 1 ? "s" : ""}`}
        {saveCount > 0 && viewCount > 0 && " · "}
        {viewCount > 0 && `Viewed ${viewCount} time${viewCount !== 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

// ─── Island 3: User CTA (apply button / already-applied state) ────────────────
// Only rendered for pipeline opportunities. External-URL CTAs are static.

async function UserCTA({
  opportunityId,
  opp,
}: {
  opportunityId: string;
  opp: Opportunity;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="inline-flex items-center gap-2 border border-black px-6 py-3 text-sm font-semibold hover:bg-black hover:text-white transition-colors"
      >
        Sign in to apply →
      </a>
    );
  }

  const isJobOpportunity = opp.type === "Job / Employment";

  const [appResult, profileResult] = await Promise.all([
    supabase
      .from("opportunity_applications")
      .select("id, status")
      .eq("opportunity_id", opportunityId)
      .eq("artist_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("id, role, professional_cv_url, full_name, username, bio, avatar_url, medium, exhibition_history, received_grants, is_patronage_supported")
      .eq("id", user.id)
      .single(),
  ]);

  const existingApplication = appResult.data ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pd = profileResult.data as any;
  const userRole = pd?.role ?? null;
  const isArtist = userRole === "artist" || userRole === "owner";
  const canApply = isArtist || (userRole === "patron" && isJobOpportunity);
  const professionalCvUrl = pd?.professional_cv_url ?? null;

  if (existingApplication) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          You have already applied to this opportunity.{" "}
          <Link href="/dashboard?tab=applications" className="underline">
            View in dashboard →
          </Link>
        </p>
      </div>
    );
  }

  if (canApply) {
    const serverProfile = pd
      ? {
          id: pd.id as string,
          full_name: pd.full_name as string | null,
          username: pd.username as string,
          bio: pd.bio as string | null,
          avatar_url: pd.avatar_url as string | null,
          medium: pd.medium as string[] | null,
          exhibition_history: (pd.exhibition_history ?? []) as Array<{
            type: "Solo" | "Group";
            title: string;
            venue: string;
            location: string;
            year: number;
          }>,
          received_grants: (pd.received_grants ?? []) as string[],
          is_patronage_supported: (pd.is_patronage_supported ?? false) as boolean,
        }
      : null;

    return (
      <ApplyButton
        opportunity={opp}
        isJobOpportunity={isJobOpportunity}
        professionalCvUrl={professionalCvUrl}
        serverProfile={serverProfile}
      />
    );
  }

  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OpportunityPage({ params }: Props) {
  const { id } = await params;

  // getOpportunityById uses createPublicClient() — no cookies() call.
  // This keeps the page shell fully static for PPR pre-rendering.
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

  const rawLocation = opp.city ? `${opp.city}, ${opp.country}` : opp.country;
  const location = rawLocation === "Global" ? "Open to all countries" : rawLocation;

  const isPipeline = opp.routing_type === "pipeline";

  const canonicalUrl = `${SITE_URL}/opportunities/${opp.slug ?? opp.id}`;
  const schemaType = FUNDING_TYPES.has(opp.type) ? "Grant" : "Event";
  const oppDescription = opp.full_description ?? opp.caption ?? opp.description ?? null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": schemaType,
        "@id": canonicalUrl,
        name: opp.title,
        url: canonicalUrl,
        organizer: { "@type": "Organization", name: opp.organiser },
        ...(opp.opens_at && { startDate: opp.opens_at }),
        ...(opp.deadline && { endDate: opp.deadline }),
        ...(schemaType === "Grant" && opp.deadline && { applicationDeadline: opp.deadline }),
        ...(oppDescription && { description: oppDescription }),
        ...(opp.featured_image_url && { image: opp.featured_image_url }),
        ...((opp.city || opp.country) && {
          location: {
            "@type": "Place",
            name: opp.city ? `${opp.city}, ${opp.country}` : opp.country,
            address: {
              "@type": "PostalAddress",
              ...(opp.city && { addressLocality: opp.city }),
              addressCountry: opp.country,
            },
          },
        }),
        ...(opp.funding_amount != null && {
          funder: { "@type": "Organization", name: opp.organiser },
          amount: { "@type": "MonetaryAmount", value: opp.funding_amount },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Opportunities", item: `${SITE_URL}/opportunities` },
          { "@type": "ListItem", position: 2, name: opp.title, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ViewTracker fires client-side after idle — does not affect pre-render */}
      <ViewTracker opportunityId={opp.id} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      {/* ✕ close is static. Admin controls + save button stream in. */}
      <div className="flex items-center justify-between">
        <Link
          href="/opportunities"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Opportunities
        </Link>
        <div className="flex items-center gap-3">
          <Suspense fallback={<SaveButtonSkeleton />}>
            <HeaderActions opportunityId={opp.id} opp={opp} />
          </Suspense>
          <Link
            href="/opportunities"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-none"
            aria-label="Close"
          >
            ✕
          </Link>
        </div>
      </div>

      {/* ── Featured image — STATIC ─────────────────────────────────────── */}
      {opp.featured_image_url ? (
        <div className="relative w-full border border-black overflow-hidden bg-white">
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-20"
            style={{ backgroundImage: `url(${opp.featured_image_url})` }}
          />
          <Image
            src={opp.featured_image_url}
            alt={opp.title}
            width={1200}
            height={630}
            unoptimized
            priority
            className="relative z-10 w-full h-auto max-h-[360px] object-contain"
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-[#E5E7EB] border border-black" />
      )}

      {/* ── Tags — STATIC ───────────────────────────────────────────────── */}
      {/* isTrending requires a save count query — it streams in via SocialProof below */}
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
        {opp.is_recurring && (
          <span className="text-xs border border-stone-700 bg-stone-800 text-white px-1.5 py-0.5 leading-none">
            {opp.recurrence_pattern ? RECURRENCE_LABELS[opp.recurrence_pattern] : "Recurring"}
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

      {/* ── Title + organiser — STATIC ──────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{opp.title}</h1>
        <p className="text-sm text-muted-foreground font-mono">{opp.organiser}</p>
      </div>

      {/* ── Vital stats — STATIC ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-black p-5">
        {fundingLabel && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Funding</p>
            <p className="font-mono font-bold text-sm">{fundingLabel}</p>
          </div>
        )}
        {opp.opens_at && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Opens</p>
            <p className="font-mono text-sm">
              {new Date(opp.opens_at + "T00:00:00").toLocaleDateString("en-NZ", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
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
        {opp.entry_fee !== null && opp.entry_fee !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Entry Fee</p>
            <p className="font-mono text-sm">{opp.entry_fee === 0 ? "Free" : `$${opp.entry_fee}`}</p>
          </div>
        )}
        {opp.artist_payment_type && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Artist Payment</p>
            <p className="font-mono text-sm">{opp.artist_payment_type}</p>
          </div>
        )}
        {opp.travel_support !== null && opp.travel_support !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Travel Support</p>
            <p className="font-mono text-sm">
              {opp.travel_support ? "Yes" : "No"}
              {opp.travel_support && opp.travel_support_details ? ` — ${opp.travel_support_details}` : ""}
            </p>
          </div>
        )}
        {opp.is_recurring && opp.recurrence_pattern && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Schedule</p>
            <p className="font-mono text-sm">
              {RECURRENCE_LABELS[opp.recurrence_pattern]}
              {opp.recurrence_open_day && opp.recurrence_close_day
                ? ` · opens ${opp.recurrence_open_day}, closes ${opp.recurrence_close_day}`
                : ""}
            </p>
          </div>
        )}
      </div>

      {/* ── Social proof — DYNAMIC (save count + trending badge) ────────── */}
      {/* fallback=null: this line is decorative; no layout shift risk */}
      <Suspense fallback={null}>
        <SocialProof opportunityId={opp.id} viewCount={opp.view_count} />
      </Suspense>

      {/* ── Description — STATIC ────────────────────────────────────────── */}
      {(opp.caption || opp.full_description || opp.description) && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            About
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {opp.caption ?? opp.description ?? opp.full_description}
          </p>
          {opp.full_description && opp.full_description !== (opp.caption ?? opp.description) && (
            <DescriptionAccordion
              fullDescription={opp.full_description}
              opportunityId={opp.id}
              title={opp.title}
              organiser={opp.organiser}
            />
          )}
        </div>
      )}

      {/* ── CTA section ─────────────────────────────────────────────────── */}
      {/* Pipeline: dynamic — shows apply / already-applied / sign-in prompt */}
      {/* External: static — plain link, no user data needed               */}
      {isPipeline ? (
        <Suspense fallback={<CTASkeleton />}>
          <UserCTA opportunityId={opp.id} opp={opp} />
        </Suspense>
      ) : opp.url ? (
        <OpportunityCTALink
          href={opp.url}
          opportunityId={opp.id}
          title={opp.title}
          organiser={opp.organiser}
          label="Apply on Official Site →"
          className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
        />
      ) : null}

      {/* ── Back link — STATIC ──────────────────────────────────────────── */}
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
