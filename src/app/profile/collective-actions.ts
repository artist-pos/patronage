"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CollectiveMemberRow = {
  id: string;
  user_id: string;
  role: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

export async function getCollectiveMembers(collectiveId: string): Promise<{
  members?: Array<{ id: string; user_id: string; role: string; username: string; full_name: string | null; avatar_url: string | null }>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("collective_members")
    .select("id, user_id, role, profiles!collective_members_user_id_fkey(username, full_name, avatar_url)")
    .eq("collective_id", collectiveId);

  if (error) return { error: error.message };

  return {
    members: ((data ?? []) as unknown as CollectiveMemberRow[]).map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
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

  const { data: membership } = await supabase
    .from("collective_members")
    .select("role")
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") return { error: "Only admins can add members." };

  const { error } = await supabase.from("collective_members").insert({
    collective_id: collectiveId,
    user_id: memberId,
    role: "member",
  });

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
  return {};
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
  revalidatePath("/profile/edit");
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

  // Add creator as admin member
  await supabase.from("collective_members").insert({
    collective_id: collective.id,
    user_id: user.id,
    role: "admin",
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
