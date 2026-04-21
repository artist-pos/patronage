"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendCollectiveInvitation } from "@/lib/email";

type CollectiveMemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

export async function getCollectiveMembers(collectiveId: string): Promise<{
  members?: Array<{ id: string; user_id: string; role: string; status: string; username: string; full_name: string | null; avatar_url: string | null }>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("collective_members")
    .select("id, user_id, role, status, profiles!collective_members_user_id_fkey(username, full_name, avatar_url)")
    .eq("collective_id", collectiveId);

  if (error) return { error: error.message };

  return {
    members: ((data ?? []) as unknown as CollectiveMemberRow[]).map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      username: m.profiles?.username ?? "",
      full_name: m.profiles?.full_name ?? null,
      avatar_url: m.profiles?.avatar_url ?? null,
    })),
  };
}

export async function addCollectiveMember(collectiveId: string, memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify current user is an admin of this collective (regular client — RLS enforced)
  const { data: membership } = await supabase
    .from("collective_members")
    .select("role")
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") return { error: "Only admins can add members." };

  const admin = createAdminClient();

  // Fetch collective name + inviter name for the DM notification
  const [{ data: collective }, { data: inviterProfile }] = await Promise.all([
    admin.from("collectives").select("name").eq("id", collectiveId).single(),
    admin.from("profiles").select("full_name, username").eq("id", user.id).single(),
  ]);

  // Insert via admin client to bypass the self-insert RLS restriction
  const { error } = await admin.from("collective_members").insert({
    collective_id: collectiveId,
    user_id: memberId,
    role: "member",
    status: "pending",
  });

  if (error) return { error: error.message };

  // Send DM notification to the invited artist
  const collectiveName = collective?.name ?? "a collective";
  const inviterName = inviterProfile?.full_name ?? inviterProfile?.username ?? "Someone";

  const [a, b] = [user.id, memberId].sort();
  const { data: existingConv } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  let convId = existingConv?.id;
  if (!convId) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();
    convId = created?.id;
  }

  if (convId) {
    await admin.from("messages").insert({
      conversation_id: convId,
      sender_id: user.id,
      content: `${inviterName} has invited you to join "${collectiveName}". Visit your profile settings to accept or decline.`,
      is_read: false,
      message_type: "text",
      is_system_message: true,
    });
  }

  revalidatePath("/studio");
  return {};
}

export async function inviteCollectiveMemberByEmail(collectiveId: string, email: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("collective_members")
    .select("role")
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") return { error: "Only admins can invite members." };

  const admin = createAdminClient();

  const [{ data: collective }, { data: inviterProfile }] = await Promise.all([
    admin.from("collectives").select("name").eq("id", collectiveId).single(),
    admin.from("profiles").select("full_name, username").eq("id", user.id).single(),
  ]);

  const { data: invitation, error } = await admin
    .from("collective_email_invitations")
    .insert({
      collective_id: collectiveId,
      email: email.trim().toLowerCase(),
      invited_by: user.id,
    })
    .select("token")
    .single();

  if (error) return { error: error.message };

  sendCollectiveInvitation({
    email: email.trim().toLowerCase(),
    collectiveName: collective?.name ?? "a collective",
    inviterName: inviterProfile?.full_name ?? inviterProfile?.username ?? "An artist on Patronage",
    token: invitation.token,
  }).catch(console.error);

  return {};
}

export async function acceptCollectiveInvitation(collectiveId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("collective_members")
    .update({ status: "accepted" })
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/studio");
  return {};
}

export async function declineCollectiveInvitation(collectiveId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("collective_members")
    .delete()
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/studio");
  return {};
}

export async function claimEmailInvitation(token: string): Promise<{
  collectiveId?: string;
  collectiveName?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: invite, error: fetchErr } = await admin
    .from("collective_email_invitations")
    .select("id, collective_id, expires_at, claimed_by, collectives(name)")
    .eq("token", token)
    .single();

  if (fetchErr || !invite) return { error: "Invitation not found or has expired." };
  if (invite.claimed_by) return { error: "This invitation has already been claimed." };
  if (new Date(invite.expires_at) < new Date()) return { error: "This invitation has expired." };

  // Check not already a member
  const { data: existing } = await admin
    .from("collective_members")
    .select("id")
    .eq("collective_id", invite.collective_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Mark claimed even if already a member
    await admin.from("collective_email_invitations").update({ claimed_by: user.id }).eq("id", invite.id);
    return { collectiveId: invite.collective_id, collectiveName: (invite.collectives as unknown as { name: string } | null)?.name };
  }

  // Add to collective as accepted member
  const [{ error: insertErr }] = await Promise.all([
    admin.from("collective_members").insert({
      collective_id: invite.collective_id,
      user_id: user.id,
      role: "member",
      status: "accepted",
    }),
    admin.from("collective_email_invitations").update({ claimed_by: user.id }).eq("id", invite.id),
  ]);

  if (insertErr) return { error: insertErr.message };

  revalidatePath("/studio");
  return {
    collectiveId: invite.collective_id,
    collectiveName: (invite.collectives as unknown as { name: string } | null)?.name,
  };
}

export async function removeCollectiveMember(collectiveId: string, memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("collective_members")
    .select("role")
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return { error: "Not authorised." };
  if (membership.role !== "admin" && memberId !== user.id) return { error: "Only admins can remove other members." };

  const { error } = await supabase
    .from("collective_members")
    .delete()
    .eq("collective_id", collectiveId)
    .eq("user_id", memberId);

  if (error) return { error: error.message };
  revalidatePath("/studio");
  return {};
}

export async function createCollective(data: {
  name: string;
  description?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.name.trim()) return { error: "Name is required" };

  const { data: collective, error: insertErr } = await supabase
    .from("collectives")
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !collective) return { error: insertErr?.message ?? "Failed to create collective" };

  // Creator is added as admin — self-insert is allowed by existing RLS
  await supabase.from("collective_members").insert({
    collective_id: collective.id,
    user_id: user.id,
    role: "admin",
    status: "accepted",
  });

  revalidatePath("/profile");
  return { id: collective.id };
}

export async function leaveCollective(collectiveId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collective_members")
    .delete()
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return {};
}

export async function deleteCollective(collectiveId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collectives")
    .delete()
    .eq("id", collectiveId)
    .eq("created_by", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return {};
}
