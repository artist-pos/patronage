"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateWorkPrivacy(
  workId: string,
  field: "hide_from_archive" | "hide_price" | "collection_visible",
  value: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch the work to verify ownership
  const { data: work } = await supabase
    .from("artworks")
    .select("id, creator_id, current_owner_id")
    .eq("id", workId)
    .maybeSingle();

  if (!work) return { error: "Work not found" };

  // collection_visible can be toggled by current_owner; artist fields by creator
  const isCreator = work.creator_id === user.id;
  const isOwner = work.current_owner_id === user.id;

  if (field === "collection_visible") {
    if (!isOwner) return { error: "Only the current owner can change collection visibility" };
  } else {
    if (!isCreator) return { error: "Only the creator can change this setting" };
  }

  const { error } = await supabase
    .from("artworks")
    .update({ [field]: value })
    .eq("id", workId);

  if (error) return { error: error.message };
  return {};
}

export async function updateProfilePrivacy(
  field: "hide_sold_section" | "collection_public",
  value: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function updateDigestSubscription(
  subscribed: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ weekly_digest: subscribed })
    .eq("id", user.id);

  if (error) return { error: error.message };

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const email = authUser?.user?.email?.toLowerCase().trim();
  if (!email) return {};

  if (subscribed) {
    await admin
      .from("subscribers")
      .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  } else {
    await admin.from("subscribers").delete().eq("email", email);
  }

  return {};
}
