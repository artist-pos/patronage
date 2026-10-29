"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";
import { isOrgMember } from "@/lib/partner-org";
import { sendOrgMemberInvite } from "@/lib/email";
import { slugify } from "@/lib/slugify";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function usernameFromEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string> {
  const base = slugify(email.split("@")[0]).slice(0, 24).replace(/-+$/, "") || "member";
  let username = base;
  let suffix = 1;
  while (true) {
    const { data } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!data) return username;
    username = `${base}-${suffix++}`;
  }
}

/** A sign-in link that lands the new member on the organisation's dashboard. */
async function orgLinkFor(email: string, orgId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const next = encodeURIComponent(`/partner/switch?org=${orgId}`);
  return `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${next}`;
}

/**
 * Add someone as an owner of the organisation. They do not need an account yet:
 * if there is none, a light account is made and the email carries a link that
 * signs them straight in. Every member has full access, so only an existing
 * member (the organisation's own login included) can add another.
 */
export async function inviteMember(orgId: string, rawEmail: string): Promise<{ error?: string; created?: boolean }> {
  const { supabase, user } = await getServerUser();
  if (!user) return { error: "Please sign in again." };

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  if (!(await isOrgMember(supabase, user.id, orgId))) return { error: "Not authorised." };

  const admin = createAdminClient();
  const [{ data: org }, { data: inviter }] = await Promise.all([
    admin.from("profiles").select("id, role, full_name, username").eq("id", orgId).single(),
    admin.from("profiles").select("full_name, username").eq("id", user.id).single(),
  ]);
  if (!org || org.role !== "partner") return { error: "Only organisations can have members." };

  let inviteeId = await findAuthUserIdByEmail(admin, email);
  let created = false;

  if (inviteeId === orgId) return { error: "That is the organisation's own login, which already has access." };
  if (inviteeId && (await isOrgMember(admin, inviteeId, orgId))) {
    return { error: "They are already a member." };
  }

  if (!inviteeId) {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { guest_reviewer: true },
    });
    if (authError || !authUser.user) return { error: authError?.message ?? "Could not set up their account." };
    inviteeId = authUser.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      id: inviteeId,
      username: await usernameFromEmail(admin, email),
      role: "reviewer",
      email,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(inviteeId);
      return { error: profileError.message };
    }
    created = true;
  }

  const { error: insertError } = await admin
    .from("partner_members")
    .insert({ partner_id: orgId, user_id: inviteeId, added_by: user.id });
  if (insertError) {
    return { error: insertError.code === "23505" ? "They are already a member." : insertError.message };
  }

  revalidatePath("/partner/members");

  const orgName = (org.full_name ?? org.username) as string;
  const inviterName = (inviter?.full_name ?? inviter?.username ?? "Someone") as string;
  const link = await orgLinkFor(email, orgId);
  if (!link) {
    return { error: "They've been added, but the sign-in link couldn't be made. They can sign in with this email address.", created };
  }
  try {
    await sendOrgMemberInvite({ to: email, inviterName, orgName, link });
  } catch (err) {
    console.error("[partner-members] invite email failed:", err);
    return { error: "They've been added, but the invitation email didn't send. They can sign in with this email address.", created };
  }

  return { created };
}

/**
 * Remove a member, or leave the organisation yourself. The organisation's own
 * login is not a member row, so it can never be removed and the organisation
 * always has someone in charge.
 */
export async function removeMember(orgId: string, memberUserId: string): Promise<{ error?: string }> {
  const { supabase, user } = await getServerUser();
  if (!user) return { error: "Please sign in again." };

  if (!(await isOrgMember(supabase, user.id, orgId))) return { error: "Not authorised." };
  if (memberUserId === orgId) return { error: "The organisation's own login can't be removed." };

  const { error } = await createAdminClient()
    .from("partner_members")
    .delete()
    .eq("partner_id", orgId)
    .eq("user_id", memberUserId);
  if (error) return { error: error.message };

  revalidatePath("/partner/members");
  return {};
}
