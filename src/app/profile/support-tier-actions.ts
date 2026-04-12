"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSupportTier(data: {
  title: string;
  price: number;
  description?: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title is required" };
  if (data.price <= 0) return { error: "Price must be greater than 0" };

  const { data: existing } = await supabase
    .from("support_tiers")
    .select("sort_order")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("support_tiers").insert({
    profile_id: user.id,
    title: data.title.trim(),
    price: data.price,
    description: data.description?.trim() || null,
    sort_order: nextOrder,
  });

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return {};
}

export async function deleteSupportTier(tierId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("support_tiers")
    .delete()
    .eq("id", tierId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return {};
}

export async function toggleSupportTierActive(tierId: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("support_tiers")
    .update({ is_active: isActive })
    .eq("id", tierId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return {};
}

export async function registerSupportIntent(
  tierId: string,
  email: string
): Promise<{ error?: string }> {
  if (!email.trim() || !email.includes("@")) return { error: "Please enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.from("support_intents").insert({
    tier_id: tierId,
    email: email.trim().toLowerCase(),
  });

  if (error) return { error: error.message };
  return {};
}
