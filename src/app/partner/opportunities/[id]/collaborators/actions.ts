"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
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

/** Invite a collaborator by email address. */
export async function inviteCollaborator(
  opportunityId: string,
  email: string,
  role: "viewer" | "editor"
): Promise<{ error?: string }> {
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

  // Look up the invitee by email using admin client
  const admin = createAdminClient();
  const { data: usersData } = await admin.auth.admin.listUsers();
  const inviteeAuthUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!inviteeAuthUser) {
    return { error: "No Patronage account found with this email address. They'll need to sign up first." };
  }

  // Make sure they're not already the owner
  if (inviteeAuthUser.id === opp.profile_id) {
    return { error: "This person already owns this opportunity." };
  }

  // Upsert collaborator record
  const { error: insertError } = await supabase
    .from("opportunity_collaborators")
    .upsert(
      { opportunity_id: opportunityId, profile_id: inviteeAuthUser.id, role, invited_by: user.id },
      { onConflict: "opportunity_id,profile_id" }
    );

  if (insertError) return { error: insertError.message };

  // Send invitation email (fire-and-forget)
  const { data: inviteeProfile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", inviteeAuthUser.id)
    .single();
  const inviteeName = inviteeProfile?.full_name ?? inviteeProfile?.username ?? email;
  const inviterName = profileData?.full_name ?? profileData?.username ?? "A partner";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

  fetch(`${siteUrl}/api/email/collaborator-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      inviteeName,
      inviterName,
      opportunityTitle: opp.title,
      opportunityId,
      role,
    }),
  }).catch(console.error);

  revalidatePath(`/partner/opportunities/${opportunityId}/edit`);
  return {};
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

  const { error } = await supabase
    .from("opportunity_collaborators")
    .delete()
    .eq("id", collaboratorId)
    .eq("opportunity_id", opportunityId);

  if (error) return { error: error.message };
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
