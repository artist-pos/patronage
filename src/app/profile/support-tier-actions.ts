"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { SupportTierType } from "@/types/database";

export async function createSupportTier(data: {
  title: string;
  price: number;
  description?: string;
  tier_type?: SupportTierType;
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
    tier_type: data.tier_type ?? null,
    sort_order: nextOrder,
  });

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
  return {};
}

export async function updateSupportTier(
  tierId: string,
  data: { title: string; price: number; description?: string; tier_type?: SupportTierType | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title is required" };
  if (data.price <= 0) return { error: "Price must be greater than 0" };

  const { error } = await supabase
    .from("support_tiers")
    .update({
      title: data.title.trim(),
      price: data.price,
      description: data.description?.trim() || null,
      tier_type: data.tier_type ?? null,
    })
    .eq("id", tierId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
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
  revalidatePath("/profile/edit");
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
  revalidatePath("/profile/edit");
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

// ── Intent dashboard ─────────────────────────────────────────────────────────

export type SupportIntentWithProfile = {
  id: string;
  tier_id: string;
  email: string;
  created_at: string;
  profile?: { username: string; full_name: string | null; avatar_url: string | null };
};

export async function getSupportIntentsForProfile(): Promise<{
  intents?: SupportIntentWithProfile[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("support_intents")
    .select("id, tier_id, email, created_at, support_tiers!inner(profile_id)")
    .eq("support_tiers.profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const rows = (data ?? []) as Array<{ id: string; tier_id: string; email: string; created_at: string }>;

  // Look up Patronage profiles for supporter emails via DB function
  const uniqueEmails = [...new Set(rows.map(r => r.email))];
  const profileMap: Record<string, { username: string; full_name: string | null; avatar_url: string | null }> = {};

  if (uniqueEmails.length > 0) {
    const { data: profileRows } = await admin.rpc("get_profiles_by_emails", { emails: uniqueEmails });
    for (const row of (profileRows ?? []) as Array<{ email: string; username: string; full_name: string | null; avatar_url: string | null }>) {
      profileMap[row.email] = { username: row.username, full_name: row.full_name, avatar_url: row.avatar_url };
    }
  }

  return {
    intents: rows.map(r => ({ ...r, profile: profileMap[r.email] })),
  };
}
