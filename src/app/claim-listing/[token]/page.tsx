import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TrackClaimOpen } from "./TrackClaimOpen";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import { StructuredDescription } from "@/components/opportunities/DescriptionAccordion";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimListingPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: opp } = await admin
    .from("opportunities")
    .select(`
      id, title, organiser, type, country, city,
      featured_image_url, slug,
      deadline, opens_at,
      funding_range, funding_amount,
      entry_fee, entry_fee_currency, entry_fee_local,
      description, caption, full_description,
      sub_categories, career_stage,
      artist_payment_type, travel_support, travel_support_details,
      grant_type, recipients_count,
      status, profile_id, claim_token_expires_at
    `)
    .eq("claim_token", token)
    .single();

  if (!opp) notFound();

  const isExpired = opp.claim_token_expires_at
    ? new Date(opp.claim_token_expires_at) < new Date()
    : false;

  if (isExpired) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-sm font-semibold">Link expired</p>
        <p className="text-sm text-muted-foreground">
          This claim link expired after 14 days. Please contact{" "}
          <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">
            hello@patronage.nz
          </a>{" "}
          to request a new one.
        </p>
      </div>
    );
  }

  if (opp.profile_id) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-sm font-semibold">Already claimed</p>
        <p className="text-sm text-muted-foreground">
          This listing has already been claimed by an organisation.
        </p>
        <Link href="/auth/login" className="text-sm underline underline-offset-2">
          Sign in →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "partner") {
      return (
        <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-sm font-semibold">Wrong account type</p>
          <p className="text-sm text-muted-foreground">
            This link is for partner organisations. Please contact{" "}
            <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">
              hello@patronage.nz
            </a>{" "}
            if you need help.
          </p>
        </div>
      );
    }

    redirect(`/claim-listing/${token}/complete`);
  }

  const claimPath = `/claim-listing/${token}`;
  const signupHref = `/auth/signup?role=partner&next=${encodeURIComponent(claimPath)}`;
  const signinHref = `/auth/login?next=${encodeURIComponent(claimPath)}`;

  // Derived display values
  const fundingLabel =
    opp.funding_range?.trim() ||
    (opp.funding_amount != null ? formatFunding(opp.funding_amount) : null);

  const deadline = opp.deadline
    ? new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const opensAt = opp.opens_at
    ? new Date(opp.opens_at + "T00:00:00").toLocaleDateString("en-NZ", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const rawLocation = opp.city ? `${opp.city}, ${opp.country}` : opp.country;
  const location = rawLocation === "Global" ? "Open to all countries" : rawLocation;

  const hasStats = !!(fundingLabel || deadline || opensAt || opp.entry_fee != null || opp.artist_payment_type || opp.travel_support != null);
  const bodyText = opp.caption ?? opp.description ?? opp.full_description ?? null;
  const hasExpandedDesc = opp.full_description && opp.full_description !== bodyText;

  const bannerHeading = `${opp.organiser || "Your organisation"}, this is your listing on Patronage. Claim it to edit details and track engagement.`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <TrackClaimOpen token={token} />

      {/* ── Claim banner ──────────────────────────────────────────────── */}
      <div className="bg-black text-white px-6 py-6 space-y-4">
        <p className="text-base font-semibold leading-snug">{bannerHeading}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={signupHref}
            className="inline-block bg-white text-black text-sm font-semibold px-5 py-2.5 text-center hover:bg-stone-100 transition-colors"
          >
            Claim listing →
          </Link>
          <Link
            href={signinHref}
            className="inline-block border border-white/40 text-white text-sm px-5 py-2.5 text-center hover:border-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* ── Featured image ────────────────────────────────────────────── */}
      {opp.featured_image_url && (
        <div className="border border-black overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={opp.featured_image_url}
            alt={opp.title}
            className="w-full max-h-64 object-contain"
          />
        </div>
      )}

      {/* ── Type / country / sub-category badges ─────────────────────── */}
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
        {(opp.sub_categories ?? []).map((cat: string) => (
          <span
            key={cat}
            className="text-xs border border-black/40 text-muted-foreground px-1.5 py-0.5 leading-none"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* ── Title + organiser ─────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{opp.title}</h1>
        {opp.organiser && (
          <p className="text-sm text-muted-foreground font-mono">{opp.organiser}</p>
        )}
      </div>

      {/* ── Vital stats grid ─────────────────────────────────────────── */}
      {hasStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-black p-5">
          {fundingLabel && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Funding</p>
              <p className="font-mono font-bold text-sm">{fundingLabel}</p>
            </div>
          )}
          {opensAt && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Opens</p>
              <p className="font-mono text-sm">{opensAt}</p>
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
          {opp.entry_fee != null && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Entry Fee</p>
              <p className="font-mono text-sm">
                {opp.entry_fee === 0
                  ? "Free"
                  : opp.entry_fee_currency && opp.entry_fee_local != null
                    ? `NZD ~${Math.round(opp.entry_fee)} (${opp.entry_fee_currency} ${opp.entry_fee_local})`
                    : `NZD ${opp.entry_fee}`}
              </p>
            </div>
          )}
          {opp.artist_payment_type && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Artist Payment</p>
              <p className="font-mono text-sm">{opp.artist_payment_type}</p>
            </div>
          )}
          {opp.travel_support != null && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Travel Support</p>
              <p className="font-mono text-sm">
                {opp.travel_support ? "Yes" : "No"}
                {opp.travel_support && opp.travel_support_details ? ` — ${opp.travel_support_details}` : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Description ──────────────────────────────────────────────── */}
      {bodyText && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</h2>
          <StructuredDescription text={bodyText} />
          {hasExpandedDesc && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:hidden">Read more ↓</span>
                <span className="hidden group-open:inline">Read less ↑</span>
              </summary>
              <div className="mt-3">
                <StructuredDescription text={opp.full_description!} />
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Bottom CTA (repeat) ───────────────────────────────────────── */}
      <div className="border-t border-border pt-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          Claim this listing to edit details, update the deadline, and see engagement data. The listing stays live either way.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={signupHref}
            className="inline-block bg-black text-white text-sm font-semibold px-5 py-2.5 text-center hover:bg-black/80 transition-colors"
          >
            Claim listing →
          </Link>
          <Link
            href={signinHref}
            className="inline-block border border-black text-sm px-5 py-2.5 text-center hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Questions?{" "}
          <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">
            hello@patronage.nz
          </a>
        </p>
      </div>
    </div>
  );
}
