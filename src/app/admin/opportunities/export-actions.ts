"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { buildClaimUrl } from "./claim-templates";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export interface ClaimExportRow {
  id: string;
  organiser: string;
  title: string;
  description: string;
  /** Public listing page, for opening from the export panel. */
  listingUrl: string;
  claimUrl: string;
  /** True when this run minted a brand-new token (any previously sent link for it is now dead). */
  tokenIsNew: boolean;
  /** Already has an owner — a claim link would be rejected as "Already claimed". */
  alreadyOwned: boolean;
  claimTokenExpiresAt: string | null;
}

/**
 * Prepare a batch of listings for CSV hand-off: make sure each one has a claim
 * token that stays valid for at least `validForDays`, then hand back the rows.
 *
 * Only ever mints a token when there isn't one (or it has already expired), and
 * only ever pushes the expiry further out — so links already emailed via
 * ClaimInvitePanel / BulkClaimPanel keep working.
 */
export async function prepareClaimExport(
  ids: string[],
  validForDays = 30
): Promise<{ error?: string; rows?: ClaimExportRow[] }> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  if (ids.length === 0) return { rows: [] };

  const supabase = await createClient();

  const { data: opps, error } = await supabase
    .from("opportunities")
    .select("id, title, organiser, description, slug, profile_id, claim_token, claim_token_expires_at")
    .in("id", ids);

  if (error) return { error: error.message };
  if (!opps) return { rows: [] };

  const now = Date.now();
  const targetExpiry = new Date(now + validForDays * 24 * 60 * 60 * 1000).toISOString();

  const rows = await Promise.all(
    opps.map(async (o) => {
      const base = {
        id: o.id,
        organiser: o.organiser ?? "",
        title: o.title ?? "",
        description: o.description ?? "",
        listingUrl: `${SITE_URL}/opportunities/${o.slug ?? o.id}`,
      };

      // Already owned — claimListing() would reject the link, so don't touch
      // the token. The panel flags these so they can be dropped from the batch.
      if (o.profile_id) {
        return {
          ...base,
          claimUrl: "",
          tokenIsNew: false,
          alreadyOwned: true,
          claimTokenExpiresAt: null,
        };
      }

      const expiresAt = o.claim_token_expires_at;
      const expired = !expiresAt || new Date(expiresAt).getTime() < now;
      const tokenIsNew = !o.claim_token || expired;
      const token = tokenIsNew ? crypto.randomUUID() : o.claim_token!;
      // Extend, never shorten — a link that already runs longer stays as it is.
      const needsExtension = !expiresAt || new Date(expiresAt).toISOString() < targetExpiry;
      const finalExpiry = needsExtension ? targetExpiry : expiresAt!;

      if (tokenIsNew || needsExtension) {
        await supabase
          .from("opportunities")
          .update({ claim_token: token, claim_token_expires_at: finalExpiry })
          .eq("id", o.id);
      }

      return {
        ...base,
        claimUrl: buildClaimUrl(token),
        tokenIsNew,
        alreadyOwned: false,
        claimTokenExpiresAt: finalExpiry,
      };
    })
  );

  revalidatePath("/admin/opportunities");

  // Keep the CSV in the order the table showed them, not Postgres' order.
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { rows };
}
