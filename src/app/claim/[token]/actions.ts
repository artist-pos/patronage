"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { issueEmailVerification } from "@/lib/email-verification";
import { isShadowEmail } from "@/lib/shadow";

type Admin = ReturnType<typeof createAdminClient>;
type TokenRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  outreach_contact_id: string | null;
};

// Keeps the outreach CRM in step once a profile has been claimed.
async function logCrmClaim(admin: Admin, tokenRow: TokenRow) {
  if (!tokenRow.outreach_contact_id) return;
  const { data: entityProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", tokenRow.entity_id)
    .single();
  await Promise.all([
    admin
      .from("outreach_contacts")
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

/**
 * Claim an admin-created shadow profile by giving its placeholder login the
 * claimant's own email and a password. Works for any address, so a link that
 * was sent to the wrong person can simply be forwarded to the right one.
 *
 * The token is taken atomically first, so two people opening the same link
 * cannot both succeed. If the address already has an account we stop and say
 * so rather than merging two profiles.
 */
export async function claimShadowAccount(input: {
  token: string;
  email: string;
  password: string;
}): Promise<{ error?: string; redirectTo?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (input.password.length < 8) return { error: "Password must be at least 8 characters." };

  const ip = await getClientIp();
  const [ipOk, tokenOk] = await Promise.all([
    checkRateLimit(`claim-shadow:ip:${ip}`, 10, 3600),
    checkRateLimit(`claim-shadow:token:${input.token}`, 10, 3600),
  ]);
  if (!ipOk || !tokenOk) return { error: "Too many attempts. Try again in a little while." };

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("claim_tokens")
    .select("*")
    .eq("token", input.token)
    .maybeSingle();

  if (!tokenRow) return { error: "This link is not valid." };
  if (tokenRow.status === "claimed") return { error: "This profile has already been claimed." };
  if (tokenRow.status === "expired" || (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date())) {
    return { error: "This link has expired. Contact hello@patronage.nz for a new one." };
  }

  const { data: authRes } = await admin.auth.admin.getUserById(tokenRow.entity_id);
  if (!isShadowEmail(authRes?.user?.email)) return { error: "This link cannot be claimed this way." };

  // Take the token first; whoever loses the race gets "already used".
  const now = new Date().toISOString();
  const { data: taken } = await admin
    .from("claim_tokens")
    .update({ status: "claimed", claimed_at: now, claimed_by: tokenRow.entity_id })
    .eq("id", tokenRow.id)
    .in("status", ["pending", "sent"])
    .select("id");
  if (!taken || taken.length === 0) return { error: "This link has already been used." };

  const { error: updateError } = await admin.auth.admin.updateUserById(tokenRow.entity_id, {
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { shadow: false },
  });

  if (updateError) {
    await admin
      .from("claim_tokens")
      .update({ status: tokenRow.status, claimed_at: null, claimed_by: null })
      .eq("id", tokenRow.id);
    return {
      error: /already|registered|exists/i.test(updateError.message)
        ? "That email already has a Patronage account. Use a different email, or contact hello@patronage.nz to attach this profile to your existing account."
        : "We could not set up your account. Try again.",
    };
  }

  // The link only proves the address if it was emailed to that same address.
  const proved =
    tokenRow.status === "sent" &&
    !!tokenRow.recipient_email &&
    tokenRow.recipient_email.trim().toLowerCase() === email;

  await admin
    .from("profiles")
    .update({
      email,
      account_status: "active",
      email_verified_at: proved ? now : null,
    })
    .eq("id", tokenRow.entity_id);

  if (!proved) issueEmailVerification(tokenRow.entity_id).catch(console.error);
  logCrmClaim(admin, tokenRow).catch(console.error);

  return { redirectTo: tokenRow.entity_type === "partner" ? "/partner/dashboard" : "/dashboard" };
}

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

  await logCrmClaim(admin, tokenRow);

  const redirectTo = tokenRow.entity_type === "partner" ? "/partner/dashboard" : "/dashboard";
  return { redirectTo };
}
