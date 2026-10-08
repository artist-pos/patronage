"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendPaymentConfirmed } from "@/lib/email";
import { transitionError } from "@/lib/decisions";
import type { PostSelectionConfig, PipelineConfig } from "@/types/database";

type ApplicationStatus =
  | "pending"
  | "shortlisted"
  | "selected"
  | "approved_pending_assets"
  | "production_ready"
  | "rejected";

// ── Authorisation ─────────────────────────────────────────────────────────────

/** Owner, admin, or an editor collaborator. Viewers are read-only. */
async function canEditOpportunity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  opportunityId: string,
  ownerId: string | null,
  isAdminUser: boolean,
): Promise<boolean> {
  if (isAdminUser || ownerId === userId) return true;
  const { data: collab } = await supabase
    .from("opportunity_collaborators")
    .select("role")
    .eq("opportunity_id", opportunityId)
    .eq("profile_id", userId)
    .maybeSingle();
  return collab?.role === "editor";
}

async function isAdminRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin" || data?.role === "owner";
}

async function getArtistContact(admin: ReturnType<typeof createAdminClient>, artistId: string) {
  const [{ data: authData }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(artistId),
    admin.from("profiles").select("full_name, username").eq("id", artistId).single(),
  ]);
  return {
    email: authData?.user?.email ?? null,
    name: profile?.full_name ?? profile?.username ?? "Artist",
  };
}

// ── Post-selection config ─────────────────────────────────────────────────────

export async function savePostSelectionConfig(
  opportunityId: string,
  postSelection: PostSelectionConfig
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [isAdminUser, { data: opp }] = await Promise.all([
    isAdminRole(supabase, user.id),
    supabase.from("opportunities").select("id, profile_id, pipeline_config").eq("id", opportunityId).single(),
  ]);

  if (!opp) return { error: "Opportunity not found" };
  if (!(await canEditOpportunity(supabase, user.id, opportunityId, opp.profile_id, isAdminUser))) {
    return { error: "Not authorised" };
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

// ── Status changes ────────────────────────────────────────────────────────────

export interface StatusChangeResult {
  error?: string;
  /** The status was already this value: nothing changed and nothing was sent. */
  unchanged?: boolean;
  /** The status changed, but something around it (usually an email) did not. */
  warning?: string;
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  rejectionReason?: string,
  selectionMessage?: string
): Promise<StatusChangeResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const [isAdminUser, { data: app }] = await Promise.all([
    isAdminRole(supabase, user.id),
    // `status` here is what the artist has been told, not the working decision.
    admin.from("opportunity_applications").select("id, status, opportunity_id").eq("id", applicationId).single(),
  ]);
  if (!app) return { error: "Application not found" };

  const { data: opp } = await admin
    .from("opportunities")
    .select("id, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();
  if (!opp) return { error: "Not authorised" };

  if (!(await canEditOpportunity(supabase, user.id, opp.id as string, opp.profile_id as string | null, isAdminUser))) {
    return { error: "Not authorised" };
  }

  // A published result is final: it can only move forward through the delivery stages.
  const blocked = transitionError(app.status as string, status);
  if (blocked) return { error: blocked };

  const { data: current, error: readError } = await admin
    .from("application_decisions")
    .select("status")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (readError) {
    return {
      error: readError.code === "PGRST205"
        ? "Reviewing isn't set up yet. Run migration 199 in Supabase."
        : readError.message,
    };
  }

  const oldStatus = (current?.status as string | undefined) ?? "pending";
  // Nothing to do, and above all nothing that could be sent twice.
  if (oldStatus === status) return { unchanged: true };

  const payload = {
    status,
    rejection_reason: status === "rejected" ? (rejectionReason?.trim() || null) : null,
    ...(status === "selected" ? { selection_message: selectionMessage?.trim() || null } : {}),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (current) {
    // Conditional on the old status so two simultaneous requests can't both win.
    const { data: updated, error } = await admin
      .from("application_decisions")
      .update(payload)
      .eq("application_id", applicationId)
      .eq("status", oldStatus)
      .select("application_id");
    if (error) return { error: error.message };
    if (!updated || updated.length === 0) return { unchanged: true };
  } else {
    const { error } = await admin
      .from("application_decisions")
      .insert({ application_id: applicationId, opportunity_id: opp.id as string, ...payload });
    if (error) return error.code === "23505" ? { unchanged: true } : { error: error.message };
  }

  const { error: logError } = await admin.from("application_status_log").insert({
    application_id: applicationId,
    old_status: oldStatus,
    new_status: status,
    changed_by: user.id,
  });
  if (logError) console.error("[status] could not write status log:", logError.message);

  // Nothing here reaches the artist. The achievement, the studio post and every
  // email wait for the organiser to publish results (see results-actions.ts).
  revalidatePath(`/partner/dashboard/${opp.id}`);
  return {};
}

export async function markInvoicePaid(applicationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [isAdminUser, { data: app }] = await Promise.all([
    isAdminRole(supabase, user.id),
    supabase
      .from("opportunity_applications")
      .select("id, artist_id, opportunity_id, invoice_amount, invoice_paid_at")
      .eq("id", applicationId)
      .single(),
  ]);

  if (!app) return { error: "Not found" };
  if (app.invoice_paid_at) return {}; // already confirmed; don't email twice

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, title, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  if (!oppData || !(await canEditOpportunity(supabase, user.id, oppData.id as string, oppData.profile_id as string | null, isAdminUser))) {
    return { error: "Not authorised" };
  }

  const { data: updated, error } = await supabase
    .from("opportunity_applications")
    .update({ invoice_paid_at: new Date().toISOString() })
    .eq("id", applicationId)
    .is("invoice_paid_at", null)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return {};

  const admin = createAdminClient();
  after(async () => {
    try {
      const contact = await getArtistContact(admin, app.artist_id as string);
      if (!contact.email) return;
      await sendPaymentConfirmed({
        artistEmail: contact.email,
        artistName: contact.name,
        opportunityTitle: (oppData as { title: string }).title,
        amount: (app.invoice_amount as number | null) ?? 0,
      });
    } catch (err) {
      console.error("[invoice] confirmation email failed:", err);
    }
  });

  revalidatePath(`/partner/dashboard/${(oppData as { id: string }).id}`);
  return {};
}

export async function getSignedAssetUrl(applicationId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [isAdminUser, { data: app }] = await Promise.all([
    isAdminRole(supabase, user.id),
    supabase
      .from("opportunity_applications")
      .select("highres_asset_url, opportunity_id")
      .eq("id", applicationId)
      .single(),
  ]);

  if (!app) return { error: "Not found" };

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  if (!oppData || !(await canEditOpportunity(supabase, user.id, oppData.id as string, oppData.profile_id as string | null, isAdminUser))) {
    return { error: "Not authorised" };
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

// ── Applicant emails (loaded on demand, never with the page) ─────────────────

/** Map of application id → applicant email. Owners, admins and editors only. */
export async function getApplicantEmails(opportunityId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const [isAdminUser, { data: opp }] = await Promise.all([
    isAdminRole(supabase, user.id),
    supabase.from("opportunities").select("id, profile_id").eq("id", opportunityId).single(),
  ]);
  if (!opp || !(await canEditOpportunity(supabase, user.id, opportunityId, opp.profile_id, isAdminUser))) return {};

  const { data: apps } = await supabase
    .from("opportunity_applications")
    .select("id, artist_id")
    .eq("opportunity_id", opportunityId);

  const admin = createAdminClient();
  const entries = await Promise.all(
    (apps ?? []).map(async (a) => {
      const { data } = await admin.auth.admin.getUserById(a.artist_id as string);
      return [a.id as string, data?.user?.email ?? ""] as const;
    })
  );
  return Object.fromEntries(entries.filter(([, email]) => email));
}

// ── Opportunity lifecycle actions ─────────────────────────────────────────────

async function assertOpportunityOwner(opportunityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as string, supabase: null, user: null, opp: null };

  const [isAdminUser, { data: opp }] = await Promise.all([
    isAdminRole(supabase, user.id),
    supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .single(),
  ]);

  if (!opp) return { error: "Opportunity not found" as string, supabase: null, user: null, opp: null };
  if (opp.profile_id !== user.id && !isAdminUser) {
    return { error: "Not authorised" as string, supabase: null, user: null, opp: null };
  }

  return { error: null, supabase, user, opp };
}

function revalidateLifecycle(opportunityId: string) {
  revalidatePath(`/partner/dashboard/${opportunityId}`);
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
}

/** Stop taking applications. The deadline is left alone so the listing can be reopened. */
export async function closeOpportunity(
  opportunityId: string,
  _intent: "capacity" | "round_end"
): Promise<{ error?: string }> {
  const { error, supabase } = await assertOpportunityOwner(opportunityId);
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ is_active: false })
    .eq("id", opportunityId);

  if (updateError) return { error: updateError.message };
  revalidateLifecycle(opportunityId);
  return {};
}

/** Take applications again. Refuses if the deadline has already passed. */
export async function reopenOpportunity(opportunityId: string): Promise<{ error?: string }> {
  const { error, supabase, opp } = await assertOpportunityOwner(opportunityId);
  if (error || !supabase || !opp) return { error: error ?? "Unknown error" };

  if (opp.archived_at) return { error: "Restore this opportunity from the archive first." };
  if (opp.status !== "published") return { error: "Only published listings can take applications." };
  const today = new Date().toISOString().split("T")[0];
  if (opp.deadline && opp.deadline < today) {
    return { error: "The deadline has passed. Set a new deadline in Manage listing, then reopen." };
  }

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ is_active: true })
    .eq("id", opportunityId);

  if (updateError) return { error: updateError.message };
  revalidateLifecycle(opportunityId);
  return {};
}

export async function delistOpportunity(opportunityId: string): Promise<{ error?: string }> {
  const { error, supabase, opp } = await assertOpportunityOwner(opportunityId);
  if (error || !supabase || !opp) return { error: error ?? "Unknown error" };
  if (opp.status !== "published") return { error: "Only live listings can be delisted." };

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ status: "unlisted" })
    .eq("id", opportunityId);

  if (updateError) return { error: updateError.message };
  revalidateLifecycle(opportunityId);
  return {};
}

export async function relistOpportunity(opportunityId: string): Promise<{ error?: string }> {
  const { error, supabase, opp } = await assertOpportunityOwner(opportunityId);
  if (error || !supabase || !opp) return { error: error ?? "Unknown error" };
  // Only a listing that was live and then delisted can come back. Pending,
  // rejected and draft listings go through review.
  if (opp.status !== "unlisted") return { error: "Only delisted listings can be re-published." };

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ status: "published" })
    .eq("id", opportunityId);

  if (updateError) return { error: updateError.message };
  revalidateLifecycle(opportunityId);
  return {};
}

/** Finish an opportunity without losing it: applications and the page are kept. */
export async function archiveOpportunity(opportunityId: string): Promise<{ error?: string }> {
  const { error, supabase, opp } = await assertOpportunityOwner(opportunityId);
  if (error || !supabase || !opp) return { error: error ?? "Unknown error" };

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", opportunityId);

  if (updateError) {
    return {
      error: updateError.message.includes("archived_at")
        ? "Archiving isn't available yet. Run migration 197 in Supabase."
        : updateError.message,
    };
  }
  revalidateLifecycle(opportunityId);
  return {};
}

export async function unarchiveOpportunity(opportunityId: string): Promise<{ error?: string }> {
  const { error, supabase } = await assertOpportunityOwner(opportunityId);
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ archived_at: null })
    .eq("id", opportunityId);

  if (updateError) return { error: updateError.message };
  revalidateLifecycle(opportunityId);
  return {};
}
