"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateHolderPublicSurfaces } from "@/lib/collection";

export async function createGroup(name: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Group name is required." };

  const { data: last } = await supabase
    .from("collection_groups")
    .select("position")
    .eq("holder_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = last ? last.position + 1 : 0;

  const { data, error } = await supabase
    .from("collection_groups")
    .insert({ holder_id: user.id, name: trimmed, position })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  return { id: data.id };
}

export async function updateGroup(id: string, name: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Group name is required." };

  const { error } = await supabase
    .from("collection_groups")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("holder_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  return {};
}

export async function deleteGroup(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Works assigned to this group become ungrouped (ON DELETE SET NULL in migration)
  const { error } = await supabase
    .from("collection_groups")
    .delete()
    .eq("id", id)
    .eq("holder_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  return {};
}

export async function assignToGroup(
  membershipId: string,
  groupId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("collection_membership")
    .update({ group_id: groupId })
    .eq("id", membershipId)
    .eq("holder_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}
