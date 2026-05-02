"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateHolderPublicSurfaces } from "@/lib/collection";
import { isAdmin } from "@/lib/admin";

type AdminResolution = "uphold_decline" | "override_to_confirmed" | "resolved_by_patronage";

/**
 * Admin resolves a holder's appeal of an artist's decline. Three outcomes:
 *   - uphold_decline           → leave status as 'declined'; appeal closed.
 *   - override_to_confirmed    → status 'confirmed' (rare; artist clearly
 *                                wrong, e.g. estate mistake on a signed work).
 *   - resolved_by_patronage    → public chip reflects an explicit Patronage
 *                                adjudication; used when the truth is murky
 *                                but the work shouldn't stay in 'disputed'.
 *
 * Per docs/dispute-resolution.md, override_to_confirmed should be reserved
 * for clear procedural mistakes — defamation/conversion exposure means
 * Patronage is not in the business of authenticating works.
 */
export async function adminResolveAppeal(
  claimId: string,
  resolution: AdminResolution,
  adminNote?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("holder_attribution_claims")
    .select("id, artwork_id, holder_id, status, decline_appealed_at")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return { error: "Claim not found." };
  if (!claim.decline_appealed_at) return { error: "No appeal to resolve." };

  let nextStatus: string;
  switch (resolution) {
    case "uphold_decline":         nextStatus = "declined"; break;
    case "override_to_confirmed":  nextStatus = "confirmed"; break;
    case "resolved_by_patronage":  nextStatus = "resolved_by_patronage"; break;
    default: return { error: "Invalid resolution." };
  }

  const { error } = await admin
    .from("holder_attribution_claims")
    .update({
      status: nextStatus,
      resolved_by_admin_id: user.id,
      resolved_at: new Date().toISOString(),
      decline_reason: adminNote?.trim() || null,
    })
    .eq("id", claimId);
  if (error) return { error: error.message };

  // If the override flips to confirmed, re-point creator_id at the artist
  // (whoever the claim targets) so the trust tier promotes correctly.
  if (resolution === "override_to_confirmed") {
    const { data: claimWithTarget } = await admin
      .from("holder_attribution_claims")
      .select("artwork_id, target_profile_id")
      .eq("id", claimId)
      .maybeSingle();
    if (claimWithTarget?.target_profile_id) {
      await admin
        .from("artworks")
        .update({ creator_id: claimWithTarget.target_profile_id })
        .eq("id", claimWithTarget.artwork_id);
    }
  }

  revalidatePath("/admin/dispute-resolution");
  await revalidateHolderPublicSurfaces(claim.holder_id);
  return {};
}
