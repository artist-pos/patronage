"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import type { ClaimTokenKind, OutreachStatus } from "@/types/database";

const VALID_OUTREACH_STATUSES: OutreachStatus[] = [
  "unattempted",
  "emailed",
  "phoned",
  "unreachable",
];

/**
 * Update outreach metadata on a pending_artists row. Other token kinds
 * (opportunity / provenance) don't have outreach fields — those updates are
 * no-ops here. Keeps the panel UI uniform without forcing a shared schema.
 */
export async function updateOutreachStatus(
  kind: ClaimTokenKind,
  sourceId: string,
  status: OutreachStatus | null,
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };

  if (status && !VALID_OUTREACH_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  if (kind !== "artist") {
    return {}; // outreach metadata only lives on pending_artists
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("pending_artists")
    .update({
      outreach_status: status,
      outreach_notes: notes?.trim() || null,
      last_outreach_at: status ? new Date().toISOString() : null,
    })
    .eq("id", sourceId);
  if (error) return { error: error.message };

  revalidatePath("/admin/tokens");
  return {};
}

/**
 * Mint a new claim token, invalidating the old one. Useful when an outreach
 * email leaks publicly or the user reports a phishing concern. Per kind:
 *  - opportunity: rotate opportunities.claim_token
 *  - provenance:  rotate provenance_links.claim_token
 *  - artist:      rotate pending_artists.claim_token
 */
export async function regenerateToken(
  kind: ClaimTokenKind,
  sourceId: string,
): Promise<{ error?: string; claimToken?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };

  const admin = createAdminClient();
  const table =
    kind === "opportunity" ? "opportunities"
    : kind === "provenance" ? "provenance_links"
    : "pending_artists";

  // Postgres generates the new UUID via gen_random_uuid() default. We force
  // a re-default by setting it to null then re-defaulting — simpler to just
  // generate the new token here and write it.
  const newToken = crypto.randomUUID();
  const { error } = await admin
    .from(table)
    .update({ claim_token: newToken })
    .eq("id", sourceId);
  if (error) return { error: error.message };

  revalidatePath("/admin/tokens");
  return { claimToken: newToken };
}
