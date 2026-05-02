"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateHolderPublicSurfaces } from "@/lib/collection";
import type { AttributionClaimStatus } from "@/types/database";

type ConfirmationDecision = "confirmed" | "declined" | "unknown";

const VALID_DECISIONS: ConfirmationDecision[] = ["confirmed", "declined", "unknown"];

/**
 * Resolve a single claim. Authorisation: caller must be the target_profile_id
 * on the claim. We verify in app code rather than relying on RLS — the admin
 * client bypasses RLS, but the explicit check is the actual gate.
 *
 * On 'confirmed', we re-point the artwork's creator_id at the artist so it
 * shows up in their studio and the trust tier renders as confirmed_by_artist.
 * On 'declined', the work drops from public surfaces but stays in the
 * holder's vault.
 */
export async function resolveClaim(
  claimId: string,
  decision: ConfirmationDecision,
  reason?: string,
): Promise<{ error?: string }> {
  if (!VALID_DECISIONS.includes(decision)) {
    return { error: "Invalid decision." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("holder_attribution_claims")
    .select("id, artwork_id, holder_id, target_profile_id, status")
    .eq("id", claimId)
    .maybeSingle();

  if (!claim) return { error: "Claim not found." };
  if (claim.target_profile_id !== user.id) {
    return { error: "You're not the artist on this record." };
  }
  if (claim.status !== "pending") {
    return { error: "This claim has already been resolved." };
  }

  const status: AttributionClaimStatus =
    decision === "confirmed" ? "confirmed"
    : decision === "declined" ? "declined"
    : "unknown";

  const { error: updateError } = await admin
    .from("holder_attribution_claims")
    .update({
      status,
      decline_reason: decision === "declined" ? (reason?.trim() || null) : null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", claimId);
  if (updateError) return { error: updateError.message };

  // Confirmation promotes the artwork to the artist's studio. We don't move
  // the file, just re-point creator_id; the holder remains current_owner_id
  // because they still own the physical work.
  if (decision === "confirmed") {
    const { error: artworkError } = await admin
      .from("artworks")
      .update({ creator_id: user.id })
      .eq("id", claim.artwork_id);
    if (artworkError) return { error: artworkError.message };
  }

  revalidatePath("/studio/pending-confirmations");
  revalidatePath("/studio");
  // Trust-tier change → public collection page + embed need to refresh.
  await revalidateHolderPublicSurfaces(claim.holder_id);
  return {};
}

/**
 * Bulk action — confirm/decline/unknown all pending claims from a single
 * holder. The UI surfaces this as "Confirm all from {holder}" because that's
 * the realistic case (one collector, many works).
 */
export async function resolveClaimsByHolder(
  holderId: string,
  decision: ConfirmationDecision,
): Promise<{ error?: string; resolved: number }> {
  if (!VALID_DECISIONS.includes(decision)) {
    return { error: "Invalid decision.", resolved: 0 };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", resolved: 0 };

  const admin = createAdminClient();
  const { data: claims } = await admin
    .from("holder_attribution_claims")
    .select("id, artwork_id")
    .eq("target_profile_id", user.id)
    .eq("holder_id", holderId)
    .eq("status", "pending");

  if (!claims || claims.length === 0) return { resolved: 0 };

  // Resolve each individually so per-row errors don't take down the batch.
  const results = await Promise.all(
    claims.map((c) => resolveClaim(c.id, decision)),
  );
  const failed = results.filter((r) => r.error);
  const resolved = results.length - failed.length;

  if (failed.length > 0) {
    return { error: `${failed.length} of ${results.length} failed.`, resolved };
  }
  return { resolved };
}
