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

/**
 * Set the exact membership list for a group. Selected IDs get group_id = groupId;
 * memberships previously in this group but not selected get group_id = null.
 * Memberships in other groups are untouched.
 */
export async function bulkAssignToGroup(
  groupId: string,
  selectedMembershipIds: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify group belongs to caller
  const { data: group } = await supabase
    .from("collection_groups")
    .select("id")
    .eq("id", groupId)
    .eq("holder_id", user.id)
    .maybeSingle();
  if (!group) return { error: "Group not found." };

  // Step 1: clear all current assignments for this group
  const clearResult = await supabase
    .from("collection_membership")
    .update({ group_id: null })
    .eq("group_id", groupId)
    .eq("holder_id", user.id);
  if (clearResult.error) return { error: clearResult.error.message };

  // Step 2: assign selected memberships to this group
  if (selectedMembershipIds.length > 0) {
    const assignResult = await supabase
      .from("collection_membership")
      .update({ group_id: groupId })
      .in("id", selectedMembershipIds)
      .eq("holder_id", user.id);
    if (assignResult.error) return { error: assignResult.error.message };
  }

  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}
