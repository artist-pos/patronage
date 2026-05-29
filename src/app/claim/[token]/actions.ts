"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function claimEntity(
  token: string,
  userId: string
): Promise<{ error?: string; redirectTo?: string }> {
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("claim_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (!tokenRow) return { error: "Token not found." };
  if (tokenRow.status === "claimed") return { error: "Already claimed." };
  if (tokenRow.status === "expired") return { error: "Token has expired." };
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    await admin.from("claim_tokens").update({ status: "expired" }).eq("id", tokenRow.id);
    return { error: "Token has expired." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, account_status, role")
    .eq("id", tokenRow.entity_id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const expectedRole = tokenRow.entity_type === "partner" ? "partner" : "artist";

  // Check the claiming user has the right role
  const { data: claimingUser } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (claimingUser && claimingUser.role !== expectedRole && claimingUser.role !== "admin" && claimingUser.role !== "owner") {
    return { error: `This claim link is for a ${tokenRow.entity_type} account. Your account type is "${claimingUser.role}".` };
  }

  // For shadow profiles: transfer ownership to the claiming user
  if (profile.account_status === "shadow") {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ account_status: "active", id: userId })
      .eq("id", profile.id);

    if (profileError) {
      // If id transfer fails (profile already exists), just link via token
      // The shadow profile stays but we mark the token claimed
    }
  }

  // Mark token claimed
  await admin
    .from("claim_tokens")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by: userId,
    })
    .eq("id", tokenRow.id);

  // Update CRM contact if linked
  if (tokenRow.outreach_contact_id) {
    const [{ data: entityProfile }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", tokenRow.entity_id).single(),
    ]);

    await Promise.all([
      admin.from("outreach_contacts")
        .update({
          status: "completed",
          last_activity_date: new Date().toISOString().slice(0, 10),
        })
        .eq("id", tokenRow.outreach_contact_id),
      admin.from("outreach_activity").insert({
        contact_id: tokenRow.outreach_contact_id,
        activity_type: "note",
        description: `${entityProfile?.full_name ?? tokenRow.entity_type} claimed their ${tokenRow.entity_type} profile on Patronage.`,
      }),
    ]);
  }

  const redirectTo = tokenRow.entity_type === "partner" ? "/partner/dashboard" : "/dashboard";
  return { redirectTo };
}
