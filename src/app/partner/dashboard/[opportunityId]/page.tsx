import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { OpportunityShell } from "@/components/partner/OpportunityShell";
import type { Metadata } from "next";
import type { CustomField, PipelineConfig, OpportunityCollaborator } from "@/types/database";
import { isAdmin } from "@/lib/admin";
import { loadPipelineApplications } from "@/lib/pipeline-applications";
import { readReviewConfig } from "@/lib/review-scoring";

interface Props {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const metadata: Metadata = { title: "Applications" };


export default async function PartnerOpportunityPage({ params, searchParams }: Props) {
  const [{ opportunityId }, { tab }] = await Promise.all([params, searchParams]);

  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [{ data: oppData }, adminUser] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .single(),
    isAdmin(),
  ]);

  if (!oppData) notFound();

  const isOwner = oppData.profile_id === user.id || !!adminUser;
  let canEdit = isOwner;

  if (!isOwner) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", opportunityId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab) notFound();
    canEdit = collab.role === "editor";
    // In a blind review the board would show names, so reviewers work in the queue instead.
    if (readReviewConfig(oppData.pipeline_config as PipelineConfig | null).blind) redirect(`/review/${opportunityId}`);
  }

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
    archived_at: (oppData.archived_at ?? null) as string | null,
  };

  // Parallel: applications, followups, collaborators
  const [enrichedApps, followupsResult, collaboratorsResult] = await Promise.all([
    loadPipelineApplications(supabase, opportunityId, opp, { withLog: true }),
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

  return (
    <div className="min-h-screen bg-background">
      <OpportunityShell
        opp={opp}
        apps={enrichedApps}
        followups={followups}
        collaborators={collaborators}
        isOwner={isOwner}
        canEdit={canEdit}
        opportunityId={opportunityId}
        initialTab={tab === "results" || tab === "settings" ? tab : "applications"}
      />
    </div>
  );
}
