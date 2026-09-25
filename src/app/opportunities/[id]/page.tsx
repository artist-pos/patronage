import { Suspense, cache, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getOpportunityById, getSimilarOpenOpportunities } from "@/lib/opportunities";
import { getOpportunitySource, sourceKeyForUrl } from "@/lib/opportunity-sources";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { AdminEditOpportunityModal } from "@/components/opportunities/AdminEditOpportunityModalDynamic";
import { AdminRejectButton } from "@/components/opportunities/AdminRejectButton";
import { SaveButton } from "@/components/opportunities/SaveButton";
import { ViewTracker } from "@/components/opportunities/ViewTracker";
import { ApplyButton } from "@/components/opportunities/ApplyButton";
import { ExternalApplyCTASection } from "@/components/opportunities/ExternalApplyCTASection";
import { OpportunityHeroImage } from "@/components/opportunities/OpportunityHeroImage";
import { StructuredDescription } from "@/components/opportunities/DescriptionAccordion";
import { createClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackedNavLink } from "@/components/analytics/TrackedNavLink";
import { OpportunityShareMenu } from "@/components/opportunities/OpportunityShareMenu";
import { OpportunitySignupBanner } from "@/components/opportunities/OpportunitySignupBanner";
import {
  ClosedOpportunityRecovery,
  type RecoverySuggestion,
} from "@/components/opportunities/ClosedOpportunityRecovery";
import { buildOpportunitySharePayload } from "@/lib/opportunity-share";
import type { Opportunity, RecurrencePattern } from "@/types/database";

type RelatedOpp = Pick<Opportunity,
  "id" | "slug" | "title" | "organiser" | "type" | "country" |
  "deadline" | "featured_image_url" | "caption" | "funding_range" | "sub_categories"
>;

function scoreRelated(c: RelatedOpp, opp: Opportunity): number {
  let s = 0;
  if (c.type === opp.type) s += 3;
  if (c.country === opp.country) s += 2;
  const overlap = (c.sub_categories ?? []).filter(
    (d) => (opp.sub_categories ?? []).includes(d)
  ).length;
  if (overlap > 0) s += 1;
  if (c.deadline) {
    const days = Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000);
    if (days > 0 && days <= 7) s += 1;
  }
  return s;
}


function isDeadlineUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  return (
    Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000) <= 14
  );
}

// Deadline annotation for related-opportunity rows (per the v2 handoff:
// red "Xd left" when imminent, amber "Closing soon" inside ten days)
function relatedDeadline(deadline: string | null): { label: string; cls: string } | null {
  if (!deadline) return null;
  const days = Math.ceil(
    (new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000
  );
  if (days <= 0) return null;
  if (days <= 3) return { label: `${days}d left`, cls: "text-[color:var(--urgent)]" };
  if (days <= 10) return { label: "Closing soon", cls: "text-[color:var(--warning)]" };
  return null;
}

// Key-fact cell — label over value, vertical hairline between cells (no box)
// Mobile: a compact two-column spec list (label | value), one line per fact.
// sm and up: the facts sit in a row divided by hairlines. On mobile the
// wrapper is display:contents so label and value land in the parent grid.
function Fact({ label, value, urgent = false }: { label: string; value: ReactNode; urgent?: boolean }) {
  return (
    <div className="contents sm:mr-8 sm:block sm:border-r sm:border-border sm:pr-8 sm:last:mr-0 sm:last:border-r-0 sm:last:pr-0">
      <div className="pt-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)] sm:mb-[5px] sm:pt-0">
        {label}
      </div>
      <div className={`text-[14px] font-medium leading-snug sm:text-base sm:font-semibold ${urgent ? "text-[color:var(--urgent)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// Related-opportunity row — white surface on the feed-bg gap backdrop, tint hover
function RelatedRow({ r }: { r: RelatedOpp }) {
  const img = r.featured_image_url
    ? r.featured_image_url
    : null;
  const d = relatedDeadline(r.deadline);
  return (
    <Link
      href={`/opportunities/${r.slug ?? r.id}`}
      className="flex gap-3 bg-card p-3 transition-colors hover:bg-[color:var(--tint)]"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-white">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="px-1 text-center font-mono text-[8px] font-semibold uppercase text-[color:var(--fg-subtle)]">
            {r.type}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-[13px] font-semibold leading-[1.35]">
          {r.title}
          {d && <span className={`font-medium ${d.cls}`}> · {d.label}</span>}
        </div>
        <div className="truncate font-mono text-[11px] text-[color:var(--fg-subtle)]">
          {r.organiser}
        </div>
      </div>
    </Link>
  );
}

function schemaTypeForOpp(type: string): string {
  switch (type) {
    case "Grant":
    case "Commission":
    case "Prize":
    case "Public Art":
      return "MonetaryGrant";
    case "Residency":
      return "EducationalOccupationalProgram";
    case "Job / Employment":
      return "JobPosting";
    case "Studio / Space":
      return "Place";
    case "Open Call":
    case "Display":
    default:
      return "Event";
  }
}

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
  if (!opp) return { title: "Opportunity not found" };

  const rawDescription = opp.caption ?? opp.description ?? opp.full_description ?? null;
  const description = rawDescription
    ? rawDescription.length > 155
      ? rawDescription.slice(0, 152) + "…"
      : rawDescription
    : `${opp.type} offered by ${opp.organiser} on Patronage.`;

  // Share previews get the facts, not the prose. Someone glancing at a link in
  // a group chat decides on location, type, money and closing date, so those
  // lead — the descriptive copy is what search results want, not iMessage.
  const rawLocation = opp.city ? `${opp.city}, ${opp.country}` : opp.country;
  const shareDescription =
    [
      rawLocation === "Global" ? "Open to all" : rawLocation,
      opp.type,
      opp.funding_range?.trim() ||
        (opp.funding_amount != null
          ? `$${opp.funding_amount.toLocaleString("en-NZ")}`
          : null),
      opp.deadline
        ? `Closes ${new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`
        : "Rolling deadline",
    ]
      .filter(Boolean)
      .join(" · ") || description;

  const title = `${opp.title}, ${opp.organiser}`;
  const shareTitle = `${title} | Patronage`;
  const canonicalPath = `/opportunities/${opp.slug ?? opp.id}`;

  // og:image is intentionally left to the route's opengraph-image.tsx, which
  // composes the listing image into a 1200x630 branded card. Naming images
  // here would override it and re-introduce undersized logo previews.
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      url: canonicalPath,
      type: "website",
      siteName: "Patronage",
      locale: "en_NZ",
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
    },
  };
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

// Secondary actions (Save, Share) share one look so the action bar lines up
// with the 44px apply button beside it.
const ACTION_BTN =
  "inline-flex h-[44px] items-center gap-2 border border-border px-4 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground aria-pressed:border-foreground aria-pressed:text-foreground";

function SaveButtonSkeleton() {
  return <div className="h-[44px] w-[84px] bg-muted animate-pulse" aria-hidden="true" />;
}

function CTASkeleton() {
  return <div className="h-12 w-48 bg-muted animate-pulse" aria-hidden="true" />;
}

// ─── Viewer state ─────────────────────────────────────────────────────────────
// Save, admin and apply islands each render in more than one place, so the
// per-viewer lookups run once per request here and are shared (React.cache).
// Calls cookies() — only ever awaited inside <Suspense> islands.

const getViewerState = cache(async (opportunityId: string) => {
  const { supabase, user } = await getServerUser();
  if (!user) return { user: null, role: null as string | null, isSaved: false, hasApplied: false };

  const [savedResult, profileResult, appResult] = await Promise.all([
    supabase
      .from("user_saved_opportunities")
      .select("id")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("opportunity_applications")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .eq("artist_id", user.id)
      .maybeSingle(),
  ]);
  return {
    user,
    role: (profileResult.data?.role ?? null) as string | null,
    isSaved: !!savedResult.data,
    hasApplied: !!appResult.data,
  };
});

// ─── Island 1a: Admin controls (breadcrumb row) ───────────────────────────────

async function AdminActions({ opp }: { opp: Opportunity }) {
  const { role } = await getViewerState(opp.id);
  if (role !== "admin" && role !== "owner") return null;
  return (
    <>
      <AdminRejectButton id={opp.id} />
      <AdminEditOpportunityModal opp={opp} />
    </>
  );
}

// ─── Island 1b: Save (action bar) ─────────────────────────────────────────────

async function SaveAction({ opp }: { opp: Opportunity }) {
  const { user, isSaved } = await getViewerState(opp.id);
  return (
    <SaveButton
      opportunityId={opp.id}
      initialSaved={isSaved}
      isAuthenticated={!!user}
      variant="button"
      className={ACTION_BTN}
    />
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
        <span className="bg-foreground px-1.5 py-0.5 font-mono text-[10px] leading-none text-background">
          Trending
        </span>
      )}
      <p className="font-mono text-[11.5px] text-[color:var(--fg-subtle)]">
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
  const { user, role: userRole, hasApplied } = await getViewerState(opportunityId);

  if (!user) {
    const returnTo = `/opportunities/${opp.slug ?? opp.id}`;
    return (
      <TrackedNavLink
        href={`/auth/signup?role=artist&next=${encodeURIComponent(returnTo)}`}
        event="opportunity_apply_click"
        props={{ opportunity_id: opp.id, route: "patronage", signed_in: "false" }}
        className="inline-flex items-center gap-2 bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
      >
        Apply through Patronage →
      </TrackedNavLink>
    );
  }

  const isJobOpportunity = opp.type === "Job / Employment";

  // Just enough to decide which state to show — the apply page
  // (/opportunities/[id]/apply) does its own full fetch server-side.
  const isArtist = userRole === "artist" || userRole === "owner";
  const canApply = isArtist || (userRole === "patron" && isJobOpportunity);

  if (hasApplied) {
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
    return <ApplyButton opportunityId={opp.id} opportunitySlug={opp.slug} />;
  }

  return null;
}

// ─── Island 4: Signup banner ──────────────────────────────────────────────────
// Signed-in readers already get notifications, so the banner is theirs to not
// see. Auth needs cookies(), hence its own Suspense boundary — the rest of the
// page stays statically pre-rendered.

async function SignupBannerIsland({
  opp,
  placement,
}: {
  opp: Opportunity;
  placement: "detail" | "closed_recovery";
}) {
  const { user } = await getServerUser();
  if (user) return null;

  return (
    <OpportunitySignupBanner
      opportunityId={opp.id}
      returnTo={`/opportunities/${opp.slug ?? opp.id}`}
      disciplines={opp.sub_categories}
      city={opp.city}
      country={opp.country}
      placement={placement}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OpportunityPage({ params }: Props) {
  const { id } = await params;

  // getOpportunityById uses createPublicClient() — no cookies() call.
  // This keeps the page shell fully static for PPR pre-rendering.
  let opp = await getOpportunityById(id);
  let isAdminPreview = false;

  if (!opp) {
    // Fallback: check if this is an admin previewing a pending/draft opp.
    // Admin client is cookie-free; auth check happens inside the Suspense island.
    const adminDb2 = createAdminClient();
    const isUuidFallback = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const { data: unpublished } = await adminDb2
      .from("opportunities")
      .select("*")
      .eq(isUuidFallback ? "id" : "slug", id)
      .single();

    if (!unpublished) notFound();

    // Auth check — verify the requester is admin before serving the unpublished opp.
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) notFound();
    const { data: prof } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single();
    if (prof?.role !== "admin" && prof?.role !== "owner") notFound();

    opp = unpublished as NonNullable<typeof opp>;
    isAdminPreview = true;
  }

  // All null paths above call notFound() which throws — opp is always set here
  if (!opp) notFound();

  // A listing is closed once its deadline is behind us, or once it has been
  // deactivated. Either way the reader needs somewhere to go next, so the
  // suggestion query joins the batch below rather than waterfalling after it.
  const todayStr = new Date().toISOString().split("T")[0];
  const isClosed = (!!opp.deadline && opp.deadline < todayStr) || !opp.is_active;

  // Fetch related opportunities + claimed partner profile in parallel — admin client avoids cookies() so PPR stays intact.
  const adminDb = createAdminClient();
  const RELATED_SELECT = "id, slug, title, organiser, type, country, deadline, featured_image_url, caption, funding_range, sub_categories";
  const [allOpenRes, partnerProfileRes, similarOpen] = await Promise.all([
    adminDb.from("opportunities").select(RELATED_SELECT)
      .eq("is_active", true).eq("status", "published")
      .neq("id", opp.id)
      .order("deadline", { ascending: true, nullsFirst: false }).limit(300),
    // The explicitly linked organiser wins; otherwise fall back to whoever posted it.
    (opp.organiser_profile_id ?? opp.profile_id)
      ? adminDb.from("profiles").select("username, full_name, avatar_url, role").eq("id", (opp.organiser_profile_id ?? opp.profile_id)!).single()
      : Promise.resolve({ data: null }),
    isClosed ? getSimilarOpenOpportunities(opp, 6) : Promise.resolve([]),
  ]);
  // Only link to the profile if it belongs to a dedicated partner account.
  // Admins, owners, and artists who submitted on behalf of an org should
  // not have their personal profile linked as the organiser.
  const rawPartner = partnerProfileRes.data as { username: string; full_name: string | null; avatar_url: string | null; role: string } | null;
  const partnerProfile = rawPartner && rawPartner.role === "partner" ? rawPartner : null;
  // Best matches from every other open listing. Ties keep soonest-deadline
  // order (the query is sorted by deadline and Array.sort is stable).
  const allOpen = (allOpenRes.data ?? []) as RelatedOpp[];
  const totalOpen = allOpen.length + 1;
  const related = allOpen
    .map((r) => ({ ...r, _score: scoreRelated(r, opp) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  // Redirect UUID-based URLs to the canonical slug URL.
  // Prevents Google from indexing the same page at two different URLs.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid && opp.slug) redirect(`/opportunities/${opp.slug}`);

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
  const deadlineUrgent = isDeadlineUrgent(opp.deadline);

  const rawLocation = opp.city ? `${opp.city}, ${opp.country}` : opp.country;
  const location = rawLocation === "Global" ? "Open to all countries" : rawLocation;

  // Only the fields the recovery cards render cross the client boundary.
  const recoverySuggestions: RecoverySuggestion[] = similarOpen.map((s) => {
    const loc = s.city ? `${s.city}, ${s.country}` : s.country;
    return {
      id: s.id,
      href: `/opportunities/${s.slug ?? s.id}`,
      title: s.title,
      organiser: s.organiser,
      type: s.type,
      location: loc === "Global" ? "Open to all" : loc,
      value:
        s.funding_range?.trim() ||
        (s.funding_amount != null ? formatFunding(s.funding_amount) : null),
      deadline: s.deadline
        ? new Date(s.deadline + "T00:00:00").toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : null,
      imageUrl: s.featured_image_url,
    };
  });

  const isPipeline = opp.routing_type === "pipeline";
  // Only needed for the external-apply retention prompt below — React.cache'd,
  // so this dedupes with the other getServerUser() calls on this page.
  const { user: viewerUser } = await getServerUser();

  // Labelled apply links → one button each. Falls back to the legacy single
  // `url` for scraped/older listings that have no application_links.
  const applyLinks = (
    opp.application_links?.length
      ? opp.application_links
      : opp.url
      ? [{ label: "Apply on Official Site", url: opp.url }]
      : []
  ).filter((l) => l.url?.trim());

  const canonicalUrl = `${SITE_URL}/opportunities/${opp.slug ?? opp.id}`;

  // Attribution for listings taken off another board. Deep-link to the listing
  // on their site where we have it, so the reader can check it at the source;
  // otherwise fall back to the board's homepage.
  const sourceInfo = getOpportunitySource(opp.source);
  const sourceLinkUrl =
    sourceInfo && sourceKeyForUrl(opp.source_url) === sourceInfo.key
      ? (opp.source_url as string)
      : sourceInfo?.url;
  const sharePayload = buildOpportunitySharePayload(opp, canonicalUrl);
  const schemaType = schemaTypeForOpp(opp.type);
  const oppDescription = opp.full_description ?? opp.caption ?? opp.description ?? null;
  const orgNode = {
    "@type": "Organization",
    name: opp.organiser,
    ...(partnerProfile && {
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/${partnerProfile.username}`,
    }),
  };
  const locationNode = (opp.city || opp.country) ? {
    "@type": "Place",
    name: opp.city ? `${opp.city}, ${opp.country}` : opp.country,
    address: {
      "@type": "PostalAddress",
      ...(opp.city && { addressLocality: opp.city }),
      addressCountry: opp.country,
    },
  } : undefined;

  const typeFields: Record<string, unknown> =
    schemaType === "Event" ? {
      startDate: opp.opens_at ?? opp.deadline,
      ...(opp.deadline && { endDate: opp.deadline }),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      organizer: orgNode,
      offers: {
        "@type": "Offer",
        url: opp.url ?? canonicalUrl,
        price: opp.entry_fee ?? "0",
        priceCurrency: opp.entry_fee_currency ?? "NZD",
        availability: "https://schema.org/InStock",
        ...(opp.deadline && { validThrough: opp.deadline }),
      },
    }
    : schemaType === "MonetaryGrant" ? {
      funder: orgNode,
      ...(opp.deadline && { applicationDeadline: opp.deadline }),
      ...(opp.funding_amount != null && {
        amount: { "@type": "MonetaryAmount", value: opp.funding_amount },
      }),
      ...(locationNode && { locationCreated: locationNode }),
    }
    : schemaType === "EducationalOccupationalProgram" ? {
      provider: orgNode,
      ...(opp.opens_at && { startDate: opp.opens_at }),
      ...(opp.deadline && { applicationDeadline: opp.deadline }),
      ...(locationNode && { location: locationNode }),
      educationalProgramMode: "https://schema.org/OnlineOrOffline",
    }
    : schemaType === "JobPosting" ? {
      hiringOrganization: orgNode,
      datePosted: opp.created_at.slice(0, 10),
      ...(opp.deadline && { validThrough: opp.deadline }),
      ...(locationNode && { jobLocation: locationNode }),
      employmentType: "CONTRACT",
      directApply: false,
    }
    : {};

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": schemaType,
        "@id": canonicalUrl,
        name: opp.title,
        url: opp.url ?? canonicalUrl,
        ...(oppDescription && { description: oppDescription }),
        ...(opp.featured_image_url && { image: opp.featured_image_url }),
        ...typeFields,
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

  // The apply action, rendered twice: in the action bar under the key facts,
  // and again once the reader reaches the end of the description.
  const renderApply = () =>
    isPipeline ? (
      <Suspense fallback={<CTASkeleton />}>
        <UserCTA opportunityId={opp.id} opp={opp} />
      </Suspense>
    ) : applyLinks.length > 0 ? (
      <ExternalApplyCTASection
        applyLinks={applyLinks}
        opportunityId={opp.id}
        title={opp.title}
        organiser={opp.organiser}
        isAuthenticated={!!viewerUser}
      />
    ) : opp.contact_email ? (
      <a
        href={`mailto:${opp.contact_email}`}
        className="inline-flex items-center gap-2 bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
      >
        Apply via email →
      </a>
    ) : null;

  return (
    <div className="max-w-[1600px] mx-auto px-6 pb-16 pt-[18px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ViewTracker fires client-side after idle — does not affect pre-render */}
      <ViewTracker opportunityId={opp.id} />

      {/* Admin preview banner — only shown when accessing a non-published opp */}
      {isAdminPreview && (
        <div className="mb-6 bg-amber-50 border border-amber-300 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
          <span className="font-semibold">Admin preview</span>
          <span>·</span>
          <span>This opportunity has status <strong>{opp.status}</strong> and is not yet visible to the public.</span>
        </div>
      )}

      {/* ── Breadcrumb + actions row — full width, above the split ──────── */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-[color:var(--fg-subtle)]">
            <li className="hidden sm:block shrink-0">
              <Link href="/opportunities" className="hover:text-foreground transition-colors">
                Opportunities
              </Link>
            </li>
            <li aria-hidden="true" className="hidden sm:block shrink-0">/</li>
            <li className="shrink-0 text-[color:var(--fg-muted)]">
              <Link
                href={`/opportunities?type=${encodeURIComponent(opp.type)}`}
                className="hover:text-foreground transition-colors"
              >
                {opp.type}
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0">/</li>
            <li className="text-foreground truncate min-w-0">{opp.title}</li>
          </ol>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <Suspense fallback={null}>
            <AdminActions opp={opp} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[2.1fr_1fr] items-start">
      <div className="min-w-0">

      {/* ── Featured image — STATIC, borderless per v2 ──────────────────── */}
      {opp.featured_image_url ? (
        <OpportunityHeroImage
          title={opp.title}
          featuredImageUrl={opp.featured_image_url}
          secondaryImageUrl={opp.secondary_image_url}
        />
      ) : (
        /* No image: gradient hero with type + organiser overlay (per handoff) */
        <div
          className="relative mb-6 w-full overflow-hidden aspect-[16/8]"
          style={{ background: "linear-gradient(135deg,#1a3540,#2d5560,#173038)" }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-1 text-2xl italic tracking-[-0.01em] text-white/90 line-clamp-2">
              {opp.title}
            </div>
            <div className="text-[40px] font-bold uppercase leading-none tracking-[-0.02em] text-white sm:text-[52px]">
              {opp.type}
            </div>
          </div>
          <div className="absolute bottom-4 left-6">
            <span className="font-mono text-[10px] uppercase text-white/60">{opp.organiser}</span>
          </div>
        </div>
      )}

      {/* ── Tags — solid brand pill for the type, outlined for the rest ─── */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="bg-brand px-2.5 py-1 font-mono text-[11px] text-white">{opp.type}</span>
        <span className="border border-border px-2.5 py-1 font-mono text-[11px] text-[color:var(--fg-muted)]">{opp.country}</span>
        {opp.grant_type && (
          <span className="border border-border px-2.5 py-1 font-mono text-[11px] text-[color:var(--fg-muted)]">{opp.grant_type}</span>
        )}
        {opp.recipients_count != null && (
          <span className="border border-border px-2.5 py-1 font-mono text-[11px] text-[color:var(--fg-muted)]">
            {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
          </span>
        )}
        {opp.is_recurring && (
          <span className="border border-border px-2.5 py-1 font-mono text-[11px] text-[color:var(--fg-muted)]">
            {opp.recurrence_pattern ? RECURRENCE_LABELS[opp.recurrence_pattern] : "Recurring"}
          </span>
        )}
        {(opp.sub_categories ?? []).map((cat) => (
          <span
            key={cat}
            className="border border-border px-2.5 py-1 font-mono text-[11px] text-[color:var(--fg-muted)]"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* ── Title + organiser — STATIC ──────────────────────────────────── */}
      <h1 className="mb-1.5 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em]">{opp.title}</h1>
      {partnerProfile ? (
        <Link
          href={`/${partnerProfile.username}`}
          className="mb-6 inline-flex items-center gap-2 text-[14.5px] text-[color:var(--fg-muted)] hover:text-foreground transition-colors"
        >
          {partnerProfile.avatar_url && (
            <div className="relative w-5 h-5 shrink-0 overflow-hidden">
              <Image
                src={partnerProfile.avatar_url}
                alt={opp.organiser}
                fill
                className="object-cover"
                sizes="20px"
              />
            </div>
          )}
          {opp.organiser}
        </Link>
      ) : (
        <p className="mb-6 text-[14.5px] text-[color:var(--fg-muted)]">{opp.organiser}</p>
      )}

      {/* ── Key facts — no box, vertical hairlines only (per handoff) ───── */}
      <div className="mb-5 grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-y border-border py-3.5 sm:flex sm:flex-wrap sm:gap-y-4 sm:border-0 sm:py-0">
        {fundingLabel && <Fact label="Funding" value={fundingLabel} />}
        {opp.opens_at && (
          <Fact
            label="Opens"
            value={new Date(opp.opens_at + "T00:00:00").toLocaleDateString("en-NZ", {
              day: "numeric", month: "long", year: "numeric",
            })}
          />
        )}
        {deadline && <Fact label="Deadline" value={deadline} urgent={deadlineUrgent} />}
        {location && <Fact label="Location" value={location} />}
        {opp.entry_fee !== null && opp.entry_fee !== undefined && (
          <Fact
            label="Entry Fee"
            value={
              opp.entry_fee === 0
                ? "Free"
                : opp.entry_fee_currency && opp.entry_fee_local != null
                  ? `NZD ~${Math.round(opp.entry_fee)} (${opp.entry_fee_currency} ${opp.entry_fee_local})`
                  : `NZD ${opp.entry_fee}`
            }
          />
        )}
        {opp.artist_payment_type && <Fact label="Artist Payment" value={opp.artist_payment_type} />}
        {opp.travel_support !== null && opp.travel_support !== undefined && (
          <Fact
            label="Travel Support"
            value={`${opp.travel_support ? "Yes" : "No"}${
              opp.travel_support && opp.travel_support_details ? `: ${opp.travel_support_details}` : ""
            }`}
          />
        )}
        {opp.is_recurring && opp.recurrence_pattern && (
          <Fact
            label="Schedule"
            value={`${RECURRENCE_LABELS[opp.recurrence_pattern]}${
              opp.recurrence_open_day && opp.recurrence_close_day
                ? ` · opens ${opp.recurrence_open_day}, closes ${opp.recurrence_close_day}`
                : ""
            }`}
          />
        )}
      </div>

      {/* ── Social proof — DYNAMIC (save count + trending badge) ────────── */}
      {/* fallback=null: this line is decorative; no layout shift risk */}
      <div className="mb-5">
        <Suspense fallback={null}>
          <SocialProof opportunityId={opp.id} viewCount={opp.view_count} />
        </Suspense>
      </div>

      {/* ── Action bar — apply, save, share, above the fold ────────────── */}
      <div className="mb-9">
        <div className="flex flex-wrap items-start gap-2">
          {renderApply()}
          <Suspense fallback={<SaveButtonSkeleton />}>
            <SaveAction opp={opp} />
          </Suspense>
          <OpportunityShareMenu
            opportunityId={opp.id}
            title={opp.title}
            url={canonicalUrl}
            location={location}
            type={opp.type}
            value={fundingLabel}
            deadline={deadline}
            payload={sharePayload}
            className={ACTION_BTN}
          />
        </div>
        {/* What applying involves, stated plainly: the profile is reused, the
            opportunity-specific material is still the artist’s to write. */}
        {isPipeline && (
          <div className="mt-5 max-w-[560px] border-l-2 border-border pl-4">
            <p className="text-[13.5px] font-medium">Build your application record</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--fg-muted)]">
              Add your bio, CV and work to your profile once, and use it across opportunities on
              Patronage. For each application, choose the material relevant to that opportunity and
              add anything specific it asks for.
            </p>
          </div>
        )}
      </div>

      {/* ── Description — STATIC ────────────────────────────────────────── */}
      {(opp.caption || opp.full_description || opp.description) && (
        <div className="mb-8 space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            About
          </h2>
          {/* Lead paragraph: short summary only. When there's no caption/description,
              full_description is rendered structured below (bold/italic/bullets). */}
          {(opp.caption ?? opp.description) && (
            <p className="text-[14.5px] leading-[1.7] whitespace-pre-wrap">
              {opp.caption ?? opp.description}
            </p>
          )}
          {opp.full_description && opp.full_description !== (opp.caption ?? opp.description) && (
            <StructuredDescription text={opp.full_description} />
          )}
        </div>
      )}

      {/* ── Apply again at the end of the description ─────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {renderApply()}
        {isPipeline && opp.pipeline_config?.terms_pdf_url && (
          <a
            href={opp.pipeline_config.terms_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-2 text-[color:var(--fg-muted)] hover:text-foreground transition-colors"
          >
            View documents →
          </a>
        )}
        {!isPipeline && applyLinks.length > 0 && opp.contact_email && (
          <a
            href={`mailto:${opp.contact_email}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {opp.contact_email}
          </a>
        )}
      </div>

      {/* ── Closed listing: live alternatives instead of a dead end ──────── */}
      {isClosed && recoverySuggestions.length > 0 && (
        <ClosedOpportunityRecovery
          opportunityId={opp.id}
          suggestions={recoverySuggestions}
        />
      )}

      {/* ── Signup prompt — signed-out readers only ──────────────────────── */}
      <Suspense fallback={null}>
        <SignupBannerIsland
          opp={opp}
          placement={isClosed && recoverySuggestions.length > 0 ? "closed_recovery" : "detail"}
        />
      </Suspense>

      {/* ── Back link + source attribution — STATIC ─────────────────────── */}
      <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-5">
        <Link
          href="/opportunities"
          className="text-[13px] text-[color:var(--fg-muted)] hover:text-foreground transition-colors"
        >
          ← Back to opportunities
        </Link>
        {sourceInfo && (
          <p className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
            Source:{" "}
            <a
              href={sourceLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              {sourceInfo.label}
            </a>
          </p>
        )}
      </div>
      </div>{/* end main column */}

      {/* ── Related opportunities sidebar — pin rows on a feed-bg gap
             backdrop, hairline left divider on desktop ─────────────────── */}
      {related.length > 0 && (
        <aside className="border-t border-border pt-6 lg:sticky lg:top-[72px] lg:self-start lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
          <p className="mb-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Related opportunities
          </p>
          <div className="flex flex-col gap-[2px] bg-feed-bg">
            {related.map((r) => (
              <RelatedRow key={r.id} r={r} />
            ))}
          </div>
          <Link
            href="/opportunities"
            className="mt-3.5 block bg-foreground px-4 py-2.5 text-center text-[13px] font-medium text-white transition-opacity hover:opacity-85"
          >
            View all {totalOpen} open opportunities →
          </Link>
        </aside>
      )}
      </div>{/* end grid */}
    </div>
  );
}
