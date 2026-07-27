import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpportunityShell } from "@/components/partner/OpportunityShell";
import type { Metadata } from "next";
import type { CustomField, PipelineConfig, OpportunityCollaborator } from "@/types/database";
import { isAdmin } from "@/lib/admin";

interface Props {
  params: Promise<{ opportunityId: string }>;
}

export const metadata: Metadata = { title: "Applications — Patronage" };

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  medium: string[] | null;
  career_stage: string | null;
  city: string | null;
  country: string | null;
  cv_url: string | null;
  exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null;
  received_grants: string[] | null;
  is_patronage_supported: boolean;
  year_of_birth: number | null;
  identity_tags: string[] | null;
}

export default async function PartnerOpportunityPage({ params }: Props) {
  const { opportunityId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: oppData }, adminUser] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, organiser, type, slug, profile_id, routing_type, status, custom_fields, show_badges_in_submission, pipeline_config, view_count, deadline, opens_at, country, city, funding_range, featured_image_url, caption, full_description, is_featured, pipeline_paid_at, is_active")
      .eq("id", opportunityId)
      .single(),
    isAdmin(),
  ]);

  if (!oppData) notFound();

  const isOwner = oppData.profile_id === user.id || !!adminUser;
  let collaboratorRole: string | null = null;

  if (!isOwner) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", opportunityId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab) notFound();
    collaboratorRole = collab.role;
  }

  void collaboratorRole;

  const opp = {
    id: oppData.id as string,
    title: oppData.title as string,
    organiser: (oppData.organiser ?? "") as string,
    type: oppData.type as string,
    slug: (oppData.slug ?? null) as string | null,
    profile_id: oppData.profile_id as string,
    routing_type: (oppData.routing_type ?? "external") as string,
    status: (oppData.status ?? "published") as string,
    custom_fields: (oppData.custom_fields ?? []) as CustomField[],
    show_badges_in_submission: (oppData.show_badges_in_submission ?? true) as boolean,
    pipeline_config: (oppData.pipeline_config ?? null) as PipelineConfig | null,
    view_count: (oppData.view_count ?? 0) as number,
    deadline: (oppData.deadline ?? null) as string | null,
    opens_at: (oppData.opens_at ?? null) as string | null,
    country: (oppData.country ?? null) as string | null,
    city: (oppData.city ?? null) as string | null,
    funding_range: (oppData.funding_range ?? null) as string | null,
    featured_image_url: (oppData.featured_image_url ?? null) as string | null,
    caption: (oppData.caption ?? null) as string | null,
    full_description: (oppData.full_description ?? null) as string | null,
    is_featured: (oppData.is_featured ?? false) as boolean,
    pipeline_paid_at: (oppData.pipeline_paid_at ?? null) as string | null,
    is_active: (oppData.is_active ?? true) as boolean,
  };

  // Parallel: apps, followups, collaborators
  const [appsResult, followupsResult, collaboratorsResult] = await Promise.all([
    supabase
      .from("opportunity_applications")
      .select("id, status, created_at, artwork_id, submitted_image_url, custom_answers, highres_asset_url, artist_id, documentation, invoice_requested_at, invoice_amount, invoice_paid_at, creative_work_id, creative_work_ids, artwork:artwork_id(id, url, caption)")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("artist_followups")
      .select("id, profile_id, followup_type, sent_at, completed_at, further_opportunities, exhibitions, press_coverage, income_from_practice, community_projects, testimonial, testimonial_consent, additional_notes")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunity_collaborators")
      .select("id, opportunity_id, profile_id, role, created_at, profiles:profile_id(username, full_name, avatar_url)")
      .eq("opportunity_id", opportunityId),
  ]);

  const apps = (appsResult.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    created_at: string;
    artwork_id: string | null;
    submitted_image_url: string | null;
    custom_answers: Record<string, string>;
    highres_asset_url: string | null;
    artist_id: string;
    documentation: Record<string, string> | null;
    invoice_requested_at: string | null;
    invoice_amount: number | null;
    invoice_paid_at: string | null;
    creative_work_id: string | null;
    creative_work_ids: string[] | null;
    artwork: { id: string; url: string; caption: string | null } | null;
  }>;

  const followups = (followupsResult.data ?? []) as Array<{
    id: string;
    profile_id: string;
    followup_type: string;
    sent_at: string | null;
    completed_at: string | null;
    further_opportunities: string | null;
    exhibitions: string | null;
    press_coverage: string | null;
    income_from_practice: string | null;
    community_projects: string | null;
    testimonial: string | null;
    testimonial_consent: boolean;
    additional_notes: string | null;
  }>;

  const collaborators = (collaboratorsResult.data ?? []) as unknown as OpportunityCollaborator[];

  // Fetch profiles for all applicants in parallel with email lookups
  const artistIds = [...new Set(apps.map((a) => a.artist_id))];
  const creativeWorkIds = [...new Set(apps.flatMap((a) => a.creative_work_ids ?? []))];

  const [profilesResult, emailResults, creativeWorksResult] = await Promise.all([
    artistIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, medium, career_stage, city, country, cv_url, exhibition_history, received_grants, is_patronage_supported, year_of_birth, identity_tags")
          .in("id", artistIds)
      : Promise.resolve({ data: [] }),
    artistIds.length > 0
      ? Promise.all(
          artistIds.map((id) => createAdminClient().auth.admin.getUserById(id))
        )
      : Promise.resolve([]),
    // creative_work_ids actually holds artworks.id values (the portfolio picker
    // sources from artworks, not the unused creative_works table — see
    // ApplyButton.tsx) — column name is legacy, kept as-is to avoid another migration.
    creativeWorkIds.length > 0
      ? supabase
          .from("artworks")
          .select("id, title, caption, url, thumb_url")
          .in("id", creativeWorkIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profilesResult.data ?? []) as unknown as ProfileRow[]) {
    profileMap.set(p.id, p);
  }

  const emailMap = new Map<string, string>();
  for (let i = 0; i < artistIds.length; i++) {
    const email = (emailResults as Array<{ data: { user: { email?: string } | null } }>)[i]?.data?.user?.email;
    if (email) emailMap.set(artistIds[i], email);
  }

  const creativeWorkMap = new Map<string, { id: string; title: string | null; caption: string | null; url: string; thumb_url: string | null }>();
  for (const w of (creativeWorksResult.data ?? []) as unknown as Array<{ id: string; title: string | null; caption: string | null; url: string; thumb_url: string | null }>) {
    creativeWorkMap.set(w.id, w);
  }

  // File-upload question ids — used to find the artist's actual submission
  // (e.g. a concept sketch) so cards show that instead of a portfolio pick.
  const fileQuestionIds = new Set([
    ...(opp.pipeline_config?.questions ?? []).filter((q) => q.type === "file_upload").map((q) => q.id),
    ...(opp.custom_fields ?? []).filter((f) => f.inputType === "file").map((f) => f.id),
  ]);
  const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|tiff?)($|\?)/i;
  function conceptImageFor(customAnswers: Record<string, string>): string | null {
    for (const qId of fileQuestionIds) {
      const raw = customAnswers?.[qId];
      if (!raw) continue;
      let urls: string[];
      try { const p = JSON.parse(raw); urls = Array.isArray(p) ? p : [raw]; }
      catch { urls = [raw]; }
      const image = urls.find((u) => IMAGE_RE.test(u));
      if (image) return image;
    }
    return null;
  }

  const enrichedApps = apps.map((app) => {
    const profile = profileMap.get(app.artist_id) ?? null;
    return {
      ...app,
      concept_image_url: conceptImageFor(app.custom_answers),
      creative_works: (app.creative_work_ids ?? [])
        .map((id) => creativeWorkMap.get(id))
        .filter((w): w is NonNullable<typeof w> => !!w),
      artist: profile
        ? {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            email: emailMap.get(app.artist_id) ?? null,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            medium: profile.medium,
            career_stage: profile.career_stage,
            city: profile.city,
            country: profile.country,
            cv_url: profile.cv_url,
            exhibition_history: profile.exhibition_history as Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null,
            received_grants: profile.received_grants,
            is_patronage_supported: profile.is_patronage_supported,
            year_of_birth: profile.year_of_birth,
            identity_tags: profile.identity_tags ?? [],
          }
        : null,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <OpportunityShell
        opp={opp}
        apps={enrichedApps}
        followups={followups}
        collaborators={collaborators}
        isOwner={isOwner}
        opportunityId={opportunityId}
      />
    </div>
  );
}
