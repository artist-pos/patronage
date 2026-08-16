"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { buildClaimUrl } from "./claim-templates";

export interface ClaimExportRow {
  id: string;
  organiser: string;
  title: string;
  claimUrl: string;
  /** True when this run minted a brand-new token (any previously sent link for it is now dead). */
  tokenIsNew: boolean;
  claimTokenExpiresAt: string;
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
    .select("id, title, organiser, claim_token, claim_token_expires_at")
    .in("id", ids);

  if (error) return { error: error.message };
  if (!opps) return { rows: [] };

  const now = Date.now();
  const targetExpiry = new Date(now + validForDays * 24 * 60 * 60 * 1000).toISOString();

  const rows = await Promise.all(
    opps.map(async (o) => {
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
        id: o.id,
        organiser: o.organiser ?? "",
        title: o.title ?? "",
        claimUrl: buildClaimUrl(token),
        tokenIsNew,
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
