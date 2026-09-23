import { notFound, redirect } from "next/navigation";
import { getOpportunityById } from "@/lib/opportunities";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getDraft } from "@/app/opportunities/[id]/actions";
import { getMissingFields } from "@/lib/profile-completion";
import { computeBadges } from "@/lib/badges";
import { ApplyForm } from "@/components/opportunities/ApplyForm";
import type { AvailableWork } from "@/components/opportunities/ApplyButton";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ApplyPage({ params }: Props) {
  const { id } = await params;
  const opp = await getOpportunityById(id);
  if (!opp) notFound();

  const backHref = `/opportunities/${opp.slug ?? opp.id}`;

  // External opportunities apply on the organiser's own site — nothing to do here.
  if (opp.routing_type !== "pipeline") redirect(backHref);

  const { supabase, user } = await getServerUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`${backHref}/apply`)}`);

  const isJobOpportunity = opp.type === "Job / Employment";

  const [appResult, profileResult] = await Promise.all([
    supabase
      .from("opportunity_applications")
      .select("id")
      .eq("opportunity_id", id)
      .eq("artist_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, role, professional_cv_url, full_name, username, bio, avatar_url, medium, disciplines, city, exhibition_history, press_bibliography, received_grants, is_patronage_supported, email_verified_at")
      .eq("id", user.id)
      .single(),
  ]);

  // Already applied — nothing left to do here either.
  if (appResult.data) redirect(backHref);

  const pd = profileResult.data;
  const userRole = pd?.role ?? null;
  const isArtist = userRole === "artist" || userRole === "owner";
  const canApply = isArtist || (userRole === "patron" && isJobOpportunity);
  if (!pd || !canApply) redirect(backHref);

  const wantsAvailableWorks =
    !isJobOpportunity && (opp.pipeline_config?.artist_documents ?? []).includes("available_works");

  const [worksResult, artworkBadgeResult, availableWorksResult, draft] = await Promise.all([
    isJobOpportunity
      ? Promise.resolve({ data: [] as AvailableWork[] })
      : supabase
          .from("artworks")
          .select("id, url, thumb_url, title, caption, price_cents, is_poa, price_currency, description, medium, dimensions")
          .eq("profile_id", user.id)
          .eq("creator_id", user.id)
          .eq("current_owner_id", user.id)
          .eq("hide_from_archive", false)
          .order("position", { ascending: true }),
    isJobOpportunity
      ? Promise.resolve({ data: [] as { current_owner_id: string; creator_id: string }[] })
      : supabase.from("artworks").select("current_owner_id, creator_id").eq("profile_id", user.id),
    wantsAvailableWorks
      ? supabase
          .from("artworks")
          .select("id, url, thumb_url, title, caption, price_cents, is_poa, price_currency, description, medium, dimensions")
          .eq("current_owner_id", user.id)
          .eq("is_available", true)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as AvailableWork[] }),
    getDraft(id),
  ]);

  const artistWorks = (worksResult.data ?? []) as AvailableWork[];
  const artworksBadge = (artworkBadgeResult.data ?? []) as { current_owner_id: string; creator_id: string }[];
  const availableWorks = (availableWorksResult.data ?? []) as AvailableWork[];

  const missingFields = getMissingFields({
    avatar_url: pd.avatar_url,
    full_name: pd.full_name,
    bio: pd.bio,
    disciplines: (pd.disciplines ?? []) as string[],
    city: pd.city ?? null,
  });
  if (!isJobOpportunity && artistWorks.length < 3) {
    missingFields.push({
      key: "works",
      label: `${3 - artistWorks.length} more work${3 - artistWorks.length !== 1 ? "s" : ""} in your portfolio`,
      href: `/${pd.username}?tab=work`,
    });
  }

  const collectedSet = artworksBadge.some((a) => a.current_owner_id !== a.creator_id);
  const badges = computeBadges(
    { ...pd, received_grants: pd.received_grants ?? [] },
    artistWorks.length,
    collectedSet
  );

  return (
    <ApplyForm
      opportunity={{
        id: opp.id,
        title: opp.title,
        organiser: opp.organiser,
        type: opp.type,
        routing_type: opp.routing_type,
        show_badges_in_submission: opp.show_badges_in_submission,
        pipeline_config: opp.pipeline_config,
        custom_fields: opp.custom_fields,
        country: opp.country,
        city: opp.city,
        caption: opp.caption,
        full_description: opp.full_description,
        funding_range: opp.funding_range,
        funding_amount: opp.funding_amount,
        deadline: opp.deadline,
        opens_at: opp.opens_at,
        entry_fee: opp.entry_fee,
        entry_fee_currency: opp.entry_fee_currency,
        artist_payment_type: opp.artist_payment_type,
        travel_support: opp.travel_support,
        travel_support_details: opp.travel_support_details,
        sub_categories: opp.sub_categories,
        featured_image_url: opp.featured_image_url,
      }}
      artistProfile={{
        id: pd.id,
        full_name: pd.full_name,
        username: pd.username,
        bio: pd.bio,
        avatar_url: pd.avatar_url,
        medium: pd.medium,
        city: pd.city ?? null,
        exhibition_history: pd.exhibition_history ?? [],
        press_bibliography: pd.press_bibliography ?? [],
      }}
      artistWorks={artistWorks}
      availableWorks={availableWorks}
      badges={badges}
      isJobOpportunity={isJobOpportunity}
      professionalCvUrl={pd.professional_cv_url ?? null}
      draft={draft}
      missingFields={missingFields}
      needsEmailVerification={!pd.email_verified_at}
      backHref={backHref}
    />
  );
}
