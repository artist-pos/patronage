"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  sendHighResRequest,
  sendCampaignSelectedNotification,
  sendShortlistNotification,
  sendRejectionNotification,
  buildShortlistEmailContent,
  buildRejectionEmailContent,
} from "@/lib/email";
import { createCampaignForSelection } from "@/lib/campaigns";
import { ensureLedgerId } from "@/lib/provenance";
import type { PostSelectionConfig, PipelineConfig } from "@/types/database";

export async function savePostSelectionConfig(
  opportunityId: string,
  postSelection: PostSelectionConfig
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("opportunities").select("id, profile_id, pipeline_config").eq("id", opportunityId).single(),
  ]);

  const isAdminUser = profileData?.role === "admin" || profileData?.role === "owner";
  if (!opp) return { error: "Opportunity not found" };
  if (opp.profile_id !== user.id && !isAdminUser) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", opportunityId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab || collab.role !== "editor") return { error: "Not authorised" };
  }

  const existing = (opp.pipeline_config ?? {}) as PipelineConfig;
  const updated: PipelineConfig = { ...existing, post_selection: postSelection };

  const { error } = await supabase
    .from("opportunities")
    .update({ pipeline_config: updated })
    .eq("id", opportunityId);

  if (error) return { error: error.message };

  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return {};
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "pending" | "shortlisted" | "selected" | "approved_pending_assets" | "production_ready" | "rejected",
  rejectionReason?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if admin/owner (parallel with app fetch)
  const [{ data: profileData }, { data: app }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("opportunity_applications")
      .select("id, status, artist_id, opportunity_id, selected_at, artwork_id")
      .eq("id", applicationId)
      .single(),
  ]);

  const isAdminUser = profileData?.role === "admin" || profileData?.role === "owner";
  if (!app) return { error: "Application not found" };

  const oldStatus = (app as { status: string }).status;

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, title, organiser, type, profile_id, pipeline_config")
    .eq("id", app.opportunity_id as string)
    .single();

  const opp = oppData as { id: string; title: string; organiser: string; type: string; profile_id: string | null; pipeline_config?: import("@/types/database").PipelineConfig | null } | null;
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
  if (status === "rejected" && rejectionReason) {
    updatePayload.rejection_reason = rejectionReason;
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

  // Shortlist/rejection notifications — queue or send based on pipeline_config.notification_defaults
  if (status === "shortlisted" || status === "rejected") {
    const notifDefaults = opp.pipeline_config?.notification_defaults as
      | { shortlisted?: "send" | "hold"; rejected?: "send" | "hold" }
      | undefined;
    const defaultForStatus = notifDefaults?.[status] ?? "send";
    const isPipelineOpp = !!opp.pipeline_config;

    void (async () => {
      const [{ data: authData }, { data: artistProfile }] = await Promise.all([
        admin.auth.admin.getUserById(app.artist_id as string),
        admin.from("profiles").select("full_name, username").eq("id", app.artist_id as string).single(),
      ]);
      const artistEmail = authData?.user?.email;
      if (!artistEmail) return;
      const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";

      if (isPipelineOpp && defaultForStatus === "hold") {
        const content = status === "shortlisted"
          ? buildShortlistEmailContent({ artistName, opportunityTitle: opp.title })
          : buildRejectionEmailContent({ artistName, opportunityTitle: opp.title, reason: rejectionReason });
        await supabase.from("notification_queue").insert({
          opportunity_id: opp.id,
          application_id: applicationId,
          recipient_id: app.artist_id,
          notification_type: status,
          email_subject: content.subject,
          email_body: content.html,
          status: "queued",
        });
      } else {
        if (status === "shortlisted") {
          sendShortlistNotification({ artistEmail, artistName, opportunityTitle: opp.title }).catch(console.error);
        } else {
          sendRejectionNotification({ artistEmail, artistName, opportunityTitle: opp.title, reason: rejectionReason }).catch(console.error);
        }
      }
    })().catch(console.error);
  }

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

    if (status === "selected") {
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

      // Write a 'selected' provenance entry if this application has an artwork attached
      const artworkId = (app as { artwork_id?: string | null }).artwork_id;
      if (artworkId) {
        void ensureLedgerId(artworkId).then((ledgerId) =>
          admin.from("artwork_provenance_ledger").insert({
            artwork_id: artworkId,
            ledger_id: ledgerId,
            entry_type: "selected",
            from_owner_id: null,
            to_owner_id: app.artist_id,
            transfer_method: "direct",
            source_opportunity_id: opp.id,
            notes: `Selected for ${opp.title} (${opp.type ?? ""})`,
          })
        ).catch(console.error);
      }

      // Auto-create campaign if opportunity requires it
      if (opp.pipeline_config?.post_selection?.requires_campaign) {
        void (async () => {
          const { data: artistProfile } = await admin
            .from("profiles")
            .select("username")
            .eq("id", app.artist_id as string)
            .single();
          if (artistProfile?.username) {
            createCampaignForSelection({
              artistProfileId: app.artist_id as string,
              artistUsername: artistProfile.username,
              opportunityId: opp.id,
              opportunityTitle: opp.title,
              opportunityType: opp.type,
              applicationId,
            }).catch(console.error);
          }
        })().catch(console.error);
      }

      // Notify the artist they've been selected — queue or send based on notification_defaults
      void (async () => {
        const [{ data: authData }, { data: artistProfile }] = await Promise.all([
          admin.auth.admin.getUserById(app.artist_id as string),
          admin.from("profiles").select("full_name, username").eq("id", app.artist_id as string).single(),
        ]);
        const artistEmail = authData?.user?.email;
        if (!artistEmail) return;
        const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";
        const notifDefaults = opp.pipeline_config?.notification_defaults as
          | { selected?: "send" | "hold" }
          | undefined;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

        if (opp.pipeline_config && notifDefaults?.selected === "hold") {
          const content = {
            subject: `You've been selected for ${opp.title}`,
            html: `<p>Congratulations ${artistName}, you've been selected for <strong>${opp.title}</strong>. <a href="${siteUrl}/studio?section=campaigns">Create your campaign page →</a></p>`,
          };
          await supabase.from("notification_queue").insert({
            opportunity_id: opp.id,
            application_id: applicationId,
            recipient_id: app.artist_id,
            notification_type: "selected",
            email_subject: content.subject,
            email_body: content.html,
            status: "queued",
          });
        } else {
          sendCampaignSelectedNotification({
            artistEmail,
            artistName,
            opportunityTitle: opp.title,
            studioUrl: `${siteUrl}/studio?section=campaigns`,
          }).catch(console.error);
        }
      })().catch(console.error);
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

export async function markInvoicePaid(applicationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: app }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("opportunity_applications")
      .select("id, artist_id, opportunity_id, invoice_amount")
      .eq("id", applicationId)
      .single(),
  ]);

  const isAdminUser = profileData?.role === "admin" || profileData?.role === "owner";
  if (!app) return { error: "Not found" };

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, title, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  if (!oppData || ((oppData.profile_id as string | null) !== user.id && !isAdminUser)) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", app.opportunity_id as string)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab || collab.role !== "editor") return { error: "Not authorised" };
  }

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ invoice_paid_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (error) return { error: error.message };

  // Notify artist — fire-and-forget
  const admin = createAdminClient();
  void (async () => {
    const { data: authData } = await admin.auth.admin.getUserById(app.artist_id as string);
    const artistEmail = authData?.user?.email;
    if (!artistEmail) return;
    const { data: artistProfile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", app.artist_id as string)
      .single();
    const { sendPaymentConfirmed } = await import("@/lib/email");
    sendPaymentConfirmed({
      artistEmail,
      artistName: artistProfile?.full_name ?? artistProfile?.username ?? "Artist",
      opportunityTitle: (oppData as { title: string }).title,
      amount: (app.invoice_amount as number | null) ?? 0,
    }).catch(console.error);
  })().catch(console.error);

  revalidatePath(`/partner/dashboard/${(oppData as { id: string }).id}`);
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

// ── Notification queue ────────────────────────────────────────────────────────

export async function queueNotification(
  opportunityId: string,
  applicationId: string,
  recipientId: string,
  notificationType: "shortlisted" | "rejected" | "selected" | "approved_pending_assets",
  emailSubject: string,
  emailBody: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("notification_queue")
    .insert({
      opportunity_id: opportunityId,
      application_id: applicationId,
      recipient_id: recipientId,
      notification_type: notificationType,
      email_subject: emailSubject,
      email_body: emailBody,
      status: "queued",
    });

  if (error) return { error: error.message };
  return {};
}

export async function getQueuedNotifications(opportunityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notification_queue")
    .select(`
      id, application_id, recipient_id, notification_type,
      email_subject, email_body, status, sent_at, created_at,
      profiles:recipient_id (full_name, username, avatar_url)
    `)
    .eq("opportunity_id", opportunityId)
    .eq("status", "queued")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function flushNotifications(
  ids: string[]
): Promise<{ error?: string; sent: number }> {
  if (ids.length === 0) return { sent: 0 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", sent: 0 };

  const { data: items } = await supabase
    .from("notification_queue")
    .select("id, recipient_id, email_subject, email_body")
    .in("id", ids)
    .eq("status", "queued");

  if (!items?.length) return { sent: 0 };

  const admin = createAdminClient();
  let sent = 0;

  for (const item of items) {
    try {
      const { data: authData } = await admin.auth.admin.getUserById(item.recipient_id as string);
      const email = authData?.user?.email;
      if (!email) continue;

      const { sendGenericEmail } = await import("@/lib/email");
      await sendGenericEmail({
        to: email,
        subject: item.email_subject as string,
        html: item.email_body as string,
      });

      await supabase
        .from("notification_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", item.id as string);
      sent++;
    } catch {
      // continue on individual failure
    }
  }

  return { sent };
}

export async function cancelNotification(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_queue")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}
