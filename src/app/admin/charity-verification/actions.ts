"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

/**
 * Approve or revoke a charity's donation CTA. Admin verifies the
 * Charities Commission registration off-platform (the public registry is
 * the authoritative check) before flipping the flag here.
 */
export async function setDonationEnabled(
  profileId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("organisation_type, username")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };
  if (enabled && profile.organisation_type !== "charity") {
    return { error: "Only charity profiles can enable donations." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ donation_enabled: enabled })
    .eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/charity-verification");
  if (profile.username) revalidatePath(`/${profile.username}`);
  return {};
}
