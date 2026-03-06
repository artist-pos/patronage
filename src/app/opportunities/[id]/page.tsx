import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getOpportunityById } from "@/lib/opportunities";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { isAdmin } from "@/lib/admin";
import { AdminEditOpportunityModal } from "@/components/opportunities/AdminEditOpportunityModalDynamic";
import { AdminRejectButton } from "@/components/opportunities/AdminRejectButton";
import { SaveButton } from "@/components/opportunities/SaveButton";
import { ViewTracker } from "@/components/opportunities/ViewTracker";
import { ApplyButton } from "@/components/opportunities/ApplyButton";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const opp = await getOpportunityById(id);
  if (!opp) return { title: "Opportunity not found — Patronage" };

  const description =
    opp.caption ??
    opp.description ??
    `${opp.type} open to ${opp.country} artists, offered by ${opp.organiser}.`;

  return {
    title: `${opp.title} — ${opp.type} | Patronage`,
    description,
    openGraph: {
      title: `${opp.title} — ${opp.type} | Patronage`,
      description,
      ...(opp.featured_image_url && {
        images: [{ url: opp.featured_image_url, width: 1200, height: 630, alt: opp.title }],
      }),
    },
  };
}

export default async function OpportunityPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [opp, adminUser, { data: { user } }] = await Promise.all([
    getOpportunityById(id),
    isAdmin(),
    supabase.auth.getUser(),
  ]);
  if (!opp) notFound();

  // Check if user saved this opportunity
  let isSaved = false;
  let saveCount = 0;
  let existingApplication: { id: string; status: string } | null = null;

  if (user) {
    const [savedResult, countResult, appResult] = await Promise.all([
      supabase
        .from("user_saved_opportunities")
        .select("id")
        .eq("user_id", user.id)
        .eq("opportunity_id", opp.id)
        .single(),
      supabase
        .from("user_saved_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("opportunity_id", opp.id),
      supabase
        .from("opportunity_applications")
        .select("id, status")
        .eq("opportunity_id", opp.id)
        .eq("artist_id", user.id)
        .single(),
    ]);
    isSaved = !!savedResult.data;
    saveCount = countResult.count ?? 0;
    existingApplication = appResult.data ?? null;
  } else {
    const { count } = await supabase
      .from("user_saved_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opp.id);
    saveCount = count ?? 0;
  }

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

  const location = opp.city ? `${opp.city}, ${opp.country}` : opp.country;

  const isTrending = saveCount >= 5;
  const isPipeline = opp.routing_type === "pipeline";

  // Get user profile to determine role and professional CV
  let userRole: string | null = null;
  let professionalCvUrl: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, professional_cv_url")
      .eq("id", user.id)
      .single();
    userRole = profile?.role ?? null;
    professionalCvUrl = (profile as { professional_cv_url?: string | null } | null)?.professional_cv_url ?? null;
  }
  const isArtist = userRole === "artist" || userRole === "owner";
  const isJobOpportunity = opp.type === "Job / Employment";
  const canApply = isPipeline && (isArtist || (userRole === "patron" && isJobOpportunity));

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <ViewTracker opportunityId={opp.id} />

      {/* Header: breadcrumb + admin edit + X close */}
      <div className="flex items-center justify-between">
        <Link
          href="/opportunities"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Opportunities
        </Link>
        <div className="flex items-center gap-3">
          {adminUser && <AdminRejectButton id={opp.id} />}
          {adminUser && <AdminEditOpportunityModal opp={opp} />}
          {user && (
            <SaveButton
              opportunityId={opp.id}
              initialSaved={isSaved}
              saveCount={saveCount}
              showCount
            />
          )}
          <Link
            href="/opportunities"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-none"
            aria-label="Close"
          >
            ✕
          </Link>
        </div>
      </div>

      {/* Featured image with backdrop-blur background */}
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

      {/* Tags */}
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
        {isTrending && (
          <span className="text-xs border border-black bg-black text-white px-1.5 py-0.5 leading-none">Trending</span>
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

      {/* Title + organiser */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{opp.title}</h1>
        <p className="text-sm text-muted-foreground font-mono">{opp.organiser}</p>
      </div>

      {/* Vital stats */}
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
      </div>

      {/* Social proof */}
      {(saveCount > 0 || opp.view_count > 0) && (
        <p className="text-xs text-muted-foreground">
          {saveCount > 0 && `Saved by ${saveCount} artist${saveCount !== 1 ? "s" : ""}`}
          {saveCount > 0 && opp.view_count > 0 && " · "}
          {opp.view_count > 0 && `Viewed ${opp.view_count} time${opp.view_count !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Description */}
      {(opp.caption || opp.full_description || opp.description) && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            About
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {opp.full_description ?? opp.description ?? opp.caption}
          </p>
        </div>
      )}

      {/* Apply CTA */}
      {existingApplication ? (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            You have already applied to this opportunity.{" "}
            <Link href="/dashboard?tab=applications" className="underline">
              View in dashboard →
            </Link>
          </p>
        </div>
      ) : canApply ? (
        <ApplyButton opportunity={opp} isJobOpportunity={isJobOpportunity} professionalCvUrl={professionalCvUrl} />
      ) : opp.url ? (
        <a
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
        >
          Apply on Official Site →
        </a>
      ) : null}

      {/* Back link */}
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
