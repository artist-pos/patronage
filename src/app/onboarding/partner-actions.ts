"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrganisationType } from "@/types/database";

const VALID_ORG_TYPES: OrganisationType[] = ["charity", "gallery", "business"];

interface PartnerOrgInput {
  organisationType: OrganisationType | null;
  charitableRegistration?: string | null;
  donationUrl?: string | null;
}

/**
 * Partner-only fields. Lives in its own action because it doesn't share state
 * with the artist-shaped ProfileForm and shouldn't widen that signature.
 *
 * donation_enabled stays admin-gated (Phase 6 rule): partners *request* a
 * donation CTA by filling charitable_registration + donation_url, then admin
 * flips donation_enabled via /admin/charity-verification once they've
 * verified the registration number.
 */
export async function updatePartnerOrgFields(
  input: PartnerOrgInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Ensure caller is a partner (or admin acting on their own profile).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, donation_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };
  if (profile.role !== "partner") {
    return { error: "Only partner profiles can set organisation type." };
  }

  if (input.organisationType && !VALID_ORG_TYPES.includes(input.organisationType)) {
    return { error: "Invalid organisation type." };
  }

  // If org-type changes away from charity, the donation CTA disappears too.
  // The actual approval flag stays admin-controlled; we only clear it when
  // the partner self-changes their type.
  const patch: Record<string, unknown> = {
    organisation_type: input.organisationType ?? null,
    charitable_registration: input.charitableRegistration?.trim() || null,
    donation_url: input.donationUrl?.trim() || null,
  };
  if (input.organisationType !== "charity" && profile.donation_enabled) {
    patch.donation_enabled = false;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  const { data: updated } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (updated?.username) revalidatePath(`/${updated.username}`);
  return {};
}
