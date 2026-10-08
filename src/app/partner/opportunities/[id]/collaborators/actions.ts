"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendCollaboratorInvite } from "@/lib/email";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { slugify } from "@/lib/slugify";
import { rebalanceAssignments } from "@/lib/review-assignment";
import type { OpportunityCollaborator } from "@/types/database";

/** Fetch all collaborators for an opportunity (owner or admin only). */
export async function getCollaborators(
  opportunityId: string
): Promise<{ collaborators?: OpportunityCollaborator[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("opportunities").select("profile_id").eq("id", opportunityId).single(),
  ]);

  const isAdmin = profileData?.role === "admin" || profileData?.role === "owner";
  if (!opp) return { error: "Opportunity not found" };
  if (opp.profile_id !== user.id && !isAdmin) return { error: "Not authorised" };

  const { data, error } = await supabase
    .from("opportunity_collaborators")
    .select(`
      id, opportunity_id, profile_id, role, invited_by, invited_at,
      profile:profile_id ( id, username, full_name, avatar_url ),
      inviter:invited_by ( username, full_name )
    `)
    .eq("opportunity_id", opportunityId)
    .order("invited_at", { ascending: true });

  if (error) return { error: error.message };
  return { collaborators: (data ?? []) as unknown as OpportunityCollaborator[] };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A sign-in link that lands the reviewer on the review queue for this opportunity. */
async function reviewLinkFor(email: string, opportunityId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const next = encodeURIComponent(`/review/${opportunityId}`);
  return `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${next}`;
}

async function usernameFromEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string> {
  const base = slugify(email.split("@")[0]).slice(0, 24).replace(/-+$/, "") || "reviewer";
  let username = base;
  let suffix = 1;
  while (true) {
    const { data } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!data) return username;
    username = `${base}-${suffix++}`;
  }
}

/**
 * Invite someone to review by email. They do not need an account: if there is
 * none, a light "reviewer" account is created and the email carries a link that
 * signs them straight in.
 */
export async function inviteCollaborator(
  opportunityId: string,
  rawEmail: string,
  role: "viewer" | "editor"
): Promise<{ error?: string; created?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const [{ data: profileData }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, username").eq("id", user.id).single(),
    supabase.from("opportunities").select("profile_id, title").eq("id", opportunityId).single(),
  ]);

  const isAdmin = profileData?.role === "admin" || profileData?.role === "owner";
  if (!opp) return { error: "Opportunity not found" };
  if (opp.profile_id !== user.id && !isAdmin) return { error: "Not authorised" };

  const admin = createAdminClient();
  let inviteeId = await findAuthUserIdByEmail(admin, email);
  let created = false;

  if (inviteeId === opp.profile_id) return { error: "This person already owns this opportunity." };

  // Someone who has applied to this call can't also review it.
  if (inviteeId) {
    const { count } = await admin
      .from("opportunity_applications")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opportunityId)
      .eq("artist_id", inviteeId);
    if ((count ?? 0) > 0) {
      return { error: "This person has applied to this opportunity, so they can't also review it." };
    }
  }

  if (!inviteeId) {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { guest_reviewer: true },
    });
    if (authError || !authUser.user) return { error: authError?.message ?? "Could not set up the reviewer." };
    inviteeId = authUser.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      id: inviteeId,
      username: await usernameFromEmail(admin, email),
      role: "reviewer",
      email,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(inviteeId);
      return { error: profileError.message.includes("reviewer")
        ? "Reviewer accounts aren't enabled yet. Run migration 198 in Supabase."
        : profileError.message };
    }
    created = true;
  }

  const { error: insertError } = await admin
    .from("opportunity_collaborators")
    .upsert(
      { opportunity_id: opportunityId, profile_id: inviteeId, role, invited_by: user.id },
      { onConflict: "opportunity_id,profile_id" }
    );
  if (insertError) return { error: insertError.message };

  const link = await reviewLinkFor(email, opportunityId);
  const inviterName = profileData?.full_name ?? profileData?.username ?? "An organiser";
  if (!link) {
    return { error: "They've been added, but the sign-in link couldn't be made. Use Resend invite to try again.", created };
  }
  try {
    await sendCollaboratorInvite({ to: email, inviterName, opportunityTitle: opp.title as string, role, link });
  } catch (err) {
    console.error("[collaborators] invite email failed:", err);
    return { error: "They've been added, but the invitation email didn't send. Use Resend invite to try again.", created };
  }

  revalidatePath(`/partner/opportunities/${opportunityId}/manage`);
  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return { created };
}

/** Send a collaborator a fresh sign-in link. */
export async function resendCollaboratorInvite(opportunityId: string, collaboratorId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, username").eq("id", user.id).single(),
    supabase.from("opportunities").select("profile_id, title").eq("id", opportunityId).single(),
  ]);
  const isAdmin = profileData?.role === "admin" || profileData?.role === "owner";
  if (!opp) return { error: "Opportunity not found" };
  if (opp.profile_id !== user.id && !isAdmin) return { error: "Not authorised" };

  const admin = createAdminClient();
  const { data: collab } = await admin
    .from("opportunity_collaborators")
    .select("profile_id, role")
    .eq("id", collaboratorId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!collab) return { error: "Collaborator not found" };

  const { data: authData } = await admin.auth.admin.getUserById(collab.profile_id as string);
  const email = authData?.user?.email;
  if (!email) return { error: "No email address on file." };

  const link = await reviewLinkFor(email, opportunityId);
  if (!link) return { error: "The sign-in link couldn't be made." };
  try {
    await sendCollaboratorInvite({
      to: email,
      inviterName: profileData?.full_name ?? profileData?.username ?? "An organiser",
      opportunityTitle: opp.title as string,
      role: collab.role as "viewer" | "editor",
      link,
    });
  } catch {
    return { error: "The email didn't send. Try again in a moment." };
  }
  return {};
}

/**
 * For the sign-in page: email a fresh link to someone on the team. Always answers
 * the same way so it can't be used to find out who is a reviewer.
 */
export async function requestReviewerLink(opportunityId: string, rawEmail: string): Promise<{ ok: true }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: true };
  const ip = await getClientIp();
  if (!(await checkRateLimit(`review-link:${ip}`, 5, 600)) || !(await checkRateLimit(`review-link-email:${email}`, 3, 600))) {
    return { ok: true };
  }
  try {
    const admin = createAdminClient();
    const userId = await findAuthUserIdByEmail(admin, email);
    if (!userId) return { ok: true };
    const [{ data: opp }, { data: collab }] = await Promise.all([
      admin.from("opportunities").select("title, profile_id").eq("id", opportunityId).maybeSingle(),
      admin.from("opportunity_collaborators").select("role").eq("opportunity_id", opportunityId).eq("profile_id", userId).maybeSingle(),
    ]);
    if (!opp || (!collab && opp.profile_id !== userId)) return { ok: true };
    const link = await reviewLinkFor(email, opportunityId);
    if (!link) return { ok: true };
    await sendCollaboratorInvite({
      to: email,
      inviterName: "Your review team",
      opportunityTitle: opp.title as string,
      role: (collab?.role as "viewer" | "editor" | undefined) ?? "editor",
      link,
    });
  } catch (err) {
    console.error("[review] could not send sign-in link:", err);
  }
  return { ok: true };
}

/** Remove a collaborator. */
export async function removeCollaborator(
  opportunityId: string,
  collaboratorId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("opportunities").select("profile_id").eq("id", opportunityId).single(),
  ]);

  const isAdmin = profileData?.role === "admin" || profileData?.role === "owner";
  if (!opp) return { error: "Opportunity not found" };
  if (opp.profile_id !== user.id && !isAdmin) return { error: "Not authorised" };

  const { data: removed } = await supabase
    .from("opportunity_collaborators")
    .select("profile_id")
    .eq("id", collaboratorId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  const { error } = await supabase
    .from("opportunity_collaborators")
    .delete()
    .eq("id", collaboratorId)
    .eq("opportunity_id", opportunityId);

  if (error) return { error: error.message };

  // Their review work is handed back: drop their assignments and rebalance a split.
  if (removed?.profile_id) {
    const admin = createAdminClient();
    await admin.from("application_assignments").delete().eq("opportunity_id", opportunityId).eq("reviewer_id", removed.profile_id);
    await rebalanceAssignments(admin, opportunityId, user.id);
  }
  revalidatePath(`/partner/opportunities/${opportunityId}/edit`);
  return {};
}

/** Update a collaborator's role. */
export async function updateCollaboratorRole(
  opportunityId: string,
  collaboratorId: string,
  role: "viewer" | "editor"
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profileData }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("opportunities").select("profile_id").eq("id", opportunityId).single(),
  ]);

  const isAdmin = profileData?.role === "admin" || profileData?.role === "owner";
  if (!opp) return { error: "Opportunity not found" };
  if (opp.profile_id !== user.id && !isAdmin) return { error: "Not authorised" };

  const { error } = await supabase
    .from("opportunity_collaborators")
    .update({ role })
    .eq("id", collaboratorId)
    .eq("opportunity_id", opportunityId);

  if (error) return { error: error.message };
  revalidatePath(`/partner/opportunities/${opportunityId}/edit`);
  return {};
}
