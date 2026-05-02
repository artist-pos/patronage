"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Claim a pending_artists stub for the signed-in user.
 *
 * Email verification: if the stub has a known contact email (either from the
 * holder's upload or a prior outreach), the claimer's auth email must match.
 * Otherwise the claim is admin-reviewed via the find-my-records flow.
 *
 * On success: link the stub to the user, re-point all artworks attributed to
 * this stub at the real profile, and reroute their pending_ownership_claims
 * to surface on the artist's confirmation dashboard.
 */
export async function claimArtistStub(
  token: string,
): Promise<{ error?: string; needsAdminReview?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in or create your Patronage account first." };

  const admin = createAdminClient();
  const { data: stub } = await admin
    .from("pending_artists")
    .select("id, name, email, claim_invite_email, claimed_by_profile_id")
    .eq("claim_token", token)
    .maybeSingle();

  if (!stub) return { error: "This claim link is invalid or has been retired." };
  if (stub.claimed_by_profile_id) {
    return { error: "This artist record has already been claimed." };
  }

  // Email verification: any of the on-file emails must match the auth email.
  const expectedEmails = [stub.email, stub.claim_invite_email]
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());
  const userEmail = user.email?.toLowerCase() ?? "";

  if (expectedEmails.length > 0 && !expectedEmails.includes(userEmail)) {
    // Mismatch — surface as admin-review case rather than silently failing.
    return {
      needsAdminReview: true,
      error:
        "Your email doesn't match the address on file for this record. Contact Patronage and we'll verify it manually.",
    };
  }

  // Mark stub as claimed.
  const { error: stubError } = await admin
    .from("pending_artists")
    .update({
      claimed_by_profile_id: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", stub.id);
  if (stubError) return { error: stubError.message };

  // Repoint artworks: stub link → real profile.
  await admin
    .from("artworks")
    .update({
      attributed_artist_id: user.id,
      attributed_pending_artist_id: null,
    })
    .eq("attributed_pending_artist_id", stub.id);

  // Repoint pending claims so they surface on /studio/pending-confirmations.
  await admin
    .from("holder_attribution_claims")
    .update({
      target_profile_id: user.id,
      target_pending_artist_id: null,
    })
    .eq("target_pending_artist_id", stub.id);

  revalidatePath("/studio/pending-confirmations");
  return {};
}
