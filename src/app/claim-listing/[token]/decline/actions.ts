"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records every address we've invited about this listing as opted out, then shows the confirmation. */
export async function declineClaimInvites(token: string): Promise<void> {
  if (UUID.test(token)) {
    const admin = createAdminClient();
    const { data: opp } = await admin
      .from("opportunities")
      .select("claim_invite_email, claim_email, contact_email")
      .eq("claim_token", token)
      .maybeSingle();

    const emails = new Set(
      [opp?.claim_invite_email, opp?.claim_email, opp?.contact_email]
        .filter((e): e is string => !!e)
        .map((e) => e.trim().toLowerCase())
    );
    if (emails.size > 0) {
      await admin
        .from("claim_invite_optouts")
        .upsert([...emails].map((email) => ({ email, source_token: token })), { onConflict: "email" });
    }
  }
  redirect(`/claim-listing/${token}/decline?done=1`);
}
