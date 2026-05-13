"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendHighResRequest } from "@/lib/email";
import { createCampaignForSelection } from "@/lib/campaigns";

export async function updateApplicationStatus(
  applicationId: string,
  status: "pending" | "shortlisted" | "selected" | "approved_pending_assets" | "production_ready" | "rejected"
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if admin/owner (parallel with app fetch)
  const [{ data: profileData }, { data: app }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("opportunity_applications")
      .select("id, status, artist_id, opportunity_id, selected_at")
      .eq("id", applicationId)
      .single(),
  ]);

  const isAdminUser = profileData?.role === "admin" || profileData?.role === "owner";
  if (!app) return { error: "Application not found" };

  const oldStatus = (app as { status: string }).status;

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, title, organiser, type, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  const opp = oppData as { id: string; title: string; organiser: string; type: string; profile_id: string | null } | null;
  if (!opp) return { error: "Not authorised" };

  if (opp.profile_id !== user.id && !isAdminUser) {
    // Check editor collaborator access
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", app.opportunity_id as string)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab || collab.role !== "editor") return { error: "Not authorised" };
  }

  const updatePayload: Record<string, unknown> = { status };
  // Record when an application is first selected so we can schedule follow-ups
  // Do NOT overwrite selected_at if it already exists (even if reverting status)
  if ((status === "selected" || status === "approved_pending_assets") && !(app as { selected_at?: string | null }).selected_at) {
    updatePayload.selected_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("opportunity_applications")
    .update(updatePayload)
    .eq("id", applicationId);

  if (error) return { error: error.message };

  const admin = createAdminClient();

  // Log status change for audit trail (fire-and-forget — table may not exist yet)
  void admin
    .from("application_status_log")
    .insert({
      application_id: applicationId,
      old_status: oldStatus,
      new_status: status,
      changed_by: user.id,
    });

  // Auto-create a verified profile achievement when selected or approved
  if (status === "selected" || status === "approved_pending_assets") {
    // Upsert achievement (idempotent — unique index on profile_id + opportunity_id)
    await admin
      .from("profile_achievements")
      .upsert(
        {
          profile_id: app.artist_id,
          opportunity_id: app.opportunity_id,
          opportunity_title: opp.title,
          organisation: opp.organiser ?? "",
          type: opp.type ?? "Grant",
          year: new Date().getFullYear(),
          verified: true,
        },
        { onConflict: "profile_id,opportunity_id" }
      );

    // Auto-create campaign + QR when first selected (fire-and-forget — idempotent)
    if (status === "selected") {
      const { data: artistProfile } = await admin
        .from("profiles")
        .select("username")
        .eq("id", app.artist_id as string)
        .single();
      if (artistProfile?.username) {
        createCampaignForSelection({
          artistProfileId: app.artist_id as string,
          artistUsername: artistProfile.username,
          opportunityId: app.opportunity_id as string,
          opportunityTitle: opp.title,
          opportunityType: opp.type ?? "other",
          applicationId: applicationId,
        }).catch(console.error);
      }

      // Upsert a project for this artist+opportunity — active only after migration 052
      // adds opportunity_id + artwork_id columns and the unique constraint.
      const { data: project } = await admin
        .from("projects")
        .upsert(
          { artist_id: app.artist_id, title: opp.title },
          { onConflict: "artist_id", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle();

      if (project?.id) {
        await admin.from("project_updates").insert({
          project_id: project.id,
          artist_id: app.artist_id,
          body: `Selected for ${opp.title} (${opp.type})`,
          content_type: "text",
        });
      }
    }

    // Email artist when approved (requesting high-res file)
    if (status === "approved_pending_assets") {
      const { data: authData } = await admin.auth.admin.getUserById(app.artist_id as string);
      const applicantUser = authData?.user ?? null;
      if (applicantUser?.email) {
        const { data: artistProfile } = await admin
          .from("profiles")
          .select("full_name, username")
          .eq("id", app.artist_id)
          .single();
        const applicantName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
        sendHighResRequest(
          applicantUser.email,
          applicantName,
          opp.title,
          `${siteUrl}/dashboard?tab=applications`
        ).catch(console.error);
      }
    }
  }

  revalidatePath(`/partner/dashboard/${opp.id}`);
  revalidatePath("/partner/dashboard");
  return {};
}

export async function getSignedAssetUrl(applicationId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: app }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("opportunity_applications")
      .select("highres_asset_url, opportunity_id")
      .eq("id", applicationId)
      .single(),
  ]);

  const isAdminUser = profileData?.role === "admin" || profileData?.role === "owner";
  if (!app) return { error: "Not found" };

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  const oppProfile = (oppData as { profile_id: string | null }).profile_id;
  if (!oppData || (oppProfile !== user.id && !isAdminUser)) {
    // Check collaborator access (editors can download)
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", app.opportunity_id as string)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab || collab.role !== "editor") return { error: "Not authorised" };
  }

  const assetPath = (app.highres_asset_url as string | null)
    ?.split("/production-assets/")
    .pop();

  if (!assetPath) return { error: "No asset uploaded" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("production-assets")
    .createSignedUrl(assetPath, 3600);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
