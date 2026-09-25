"use server";

import { randomBytes, randomUUID } from "crypto";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { isOrgCategory } from "@/lib/org-categories";
import { SHADOW_EMAIL_DOMAIN } from "@/lib/shadow";
import { slugify } from "@/lib/slugify";
import type { ClaimToken, ClaimEntityType } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const FROM = "Blake Aitken <blake@patronage.nz>";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function generateToken(): string {
  return randomBytes(8).toString("hex");
}

// ── Enriched type for the admin table ────────────────────────────────────────

export interface EnrichedClaimToken extends ClaimToken {
  entity_name: string | null;
  entity_username: string | null;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function getClaimTokens(): Promise<EnrichedClaimToken[]> {
  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from("claim_tokens")
    .select("*")
    .order("created_at", { ascending: false });

  if (!tokens?.length) return [];

  const entityIds = [...new Set(tokens.map((t) => t.entity_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, username")
    .in("id", entityIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  return tokens.map((t) => {
    const profile = profileMap.get(t.entity_id);
    return {
      ...t,
      entity_name: profile?.full_name ?? null,
      entity_username: profile?.username ?? null,
    };
  });
}

// ── Generate token ────────────────────────────────────────────────────────────

export async function generateClaimToken(input: {
  entityType: ClaimEntityType;
  entityId: string;
  recipientEmail?: string;
  recipientName?: string;
  notes?: string;
  outreachContactId?: string;
}): Promise<{ token?: string; tokenId?: string; error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };

  const admin = createAdminClient();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  let outreachContactId = input.outreachContactId ?? null;

  // Auto-create CRM contact if email provided and no contact linked
  if (!outreachContactId && input.recipientEmail) {
    const { data: existing } = await admin
      .from("outreach_contacts")
      .select("id")
      .eq("email", input.recipientEmail.trim())
      .maybeSingle();

    if (existing) {
      outreachContactId = existing.id;
    } else if (input.recipientName || input.entityId) {
      const { data: newContact } = await admin
        .from("outreach_contacts")
        .insert({
          company: input.recipientName?.trim() ?? "Unknown",
          email: input.recipientEmail.trim(),
          status: "contacted",
          category: "other",
          sent_from: "patronage",
        })
        .select("id")
        .single();
      if (newContact) outreachContactId = newContact.id;
    }
  }

  const { data, error } = await admin
    .from("claim_tokens")
    .insert({
      token,
      entity_type: input.entityType,
      entity_id: input.entityId,
      recipient_email: input.recipientEmail?.trim() ?? null,
      recipient_name: input.recipientName?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      outreach_contact_id: outreachContactId,
      expires_at: expiresAt,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/admin/claim-tokens");
  return { token, tokenId: data.id };
}

// ── Create shadow profile ─────────────────────────────────────────────────────

export async function createShadowProfile(input: {
  name: string;
  entityType: ClaimEntityType;
  /** Partners only. A regional arts org with a region anchors that region's
   *  page, so the artists already there are attached to it from day one. */
  orgCategory?: string | null;
  regionId?: string | null;
  /** Partners only, local_board_arts_org. Must belong to regionId — the
   *  caller always derives this from a real board row, never free text. */
  localBoardId?: string | null;
  bio?: string | null;
}): Promise<{ profileId?: string; username?: string; error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  if (!input.name.trim()) return { error: "Name is required." };

  const admin = createAdminClient();
  // slugify folds macrons and other diacritics ("Ōrākei" -> "orakei") rather
  // than dropping the letters, which is what a bare [^a-z0-9] strip does.
  const baseUsername = slugify(input.name).slice(0, 30).replace(/-+$/, "") || "profile";

  // Find unique username
  let username = baseUsername;
  let suffix = 1;
  while (true) {
    const { data } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!data) break;
    username = `${baseUsername}-${suffix++}`;
  }

  const isPartner = input.entityType === "partner";
  const orgCategory = isPartner && isOrgCategory(input.orgCategory) ? input.orgCategory : null;

  // profiles.id is the primary key of an auth user, so a profile cannot exist
  // without one. Make a placeholder login the same way the provenance shadow
  // accounts do: unusable (no password, unroutable address) and there only to
  // own the row until someone claims it.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: `shadow-${randomUUID()}@${SHADOW_EMAIL_DOMAIN}`,
    email_confirm: true,
    user_metadata: { full_name: input.name.trim(), shadow: true },
  });
  if (authError || !authUser.user) return { error: authError?.message ?? "Could not create the account." };

  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: authUser.user.id,
      username,
      full_name: input.name.trim(),
      role: isPartner ? "partner" : "artist",
      account_status: "shadow",
      ...(isPartner && orgCategory ? { org_category: orgCategory } : {}),
      ...(isPartner && input.regionId ? { region_id: input.regionId } : {}),
      ...(isPartner && input.localBoardId ? { local_board_id: input.localBoardId } : {}),
      ...(isPartner && input.bio?.trim() ? { bio: input.bio.trim() } : {}),
    })
    .select("id, username")
    .single();

  if (error) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: error.message };
  }
  revalidatePath("/admin/artists");
  revalidatePath("/admin/claim-tokens");
  return { profileId: data.id, username: data.username };
}

// ── Send claim email ──────────────────────────────────────────────────────────

export async function sendClaimTokenEmail(tokenId: string): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("claim_tokens")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (!tokenRow) return { error: "Token not found." };
  if (!tokenRow.recipient_email) return { error: "No recipient email on this token." };
  if (tokenRow.status === "claimed") return { error: "Already claimed." };

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username, role")
    .eq("id", tokenRow.entity_id)
    .single();

  const entityLabel = profile?.full_name ?? tokenRow.entity_type;
  const claimUrl = `${SITE_URL}/claim/${tokenRow.token}`;
  const recipientName = tokenRow.recipient_name ?? "there";
  const entityTypeLabel = tokenRow.entity_type === "partner" ? "organisation" : "artist profile";

  const subject = `Claim your ${entityTypeLabel} on Patronage`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;font-size:14px;line-height:1.7">
<p>Hi ${recipientName},</p>
<p>We've created a <strong>${entityTypeLabel}</strong> page for <strong>${entityLabel}</strong> on Patronage — New Zealand's platform connecting artists with grants, residencies, and commissions.</p>
<p>Claim it to edit your profile, add your logo, and manage your presence on the platform.</p>
<div style="margin:28px 0">
  <a href="${claimUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;font-size:14px;font-weight:600">Claim your listing →</a>
</div>
<p style="font-size:12px;color:#888">This link expires in 90 days. If you have any questions, reply to this email or contact <a href="mailto:hello@patronage.nz" style="color:#888">hello@patronage.nz</a>.</p>
<p style="font-size:12px;color:#888">— Blake, Patronage</p>
</body></html>`;

  const resend = getResend();
  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: tokenRow.recipient_email,
    subject,
    html,
  });

  if (sendError) return { error: (sendError as { message?: string }).message ?? "Send failed." };

  await admin
    .from("claim_tokens")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", tokenId);

  // Log to CRM if linked
  if (tokenRow.outreach_contact_id) {
    await Promise.all([
      admin.from("outreach_activity").insert({
        contact_id: tokenRow.outreach_contact_id,
        activity_type: "email_sent",
        description: `Claim token sent to ${tokenRow.recipient_email} for ${entityLabel}`,
      }),
      admin.from("outreach_contacts").update({
        last_activity_date: new Date().toISOString().slice(0, 10),
      }).eq("id", tokenRow.outreach_contact_id),
    ]);
  }

  revalidatePath("/admin/claim-tokens");
  return {};
}

// ── Expire token ─────────────────────────────────────────────────────────────

export async function expireClaimToken(tokenId: string): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("claim_tokens")
    .update({ status: "expired" })
    .eq("id", tokenId);
  if (error) return { error: error.message };
  revalidatePath("/admin/claim-tokens");
  return {};
}

// ── Search profiles for picker ────────────────────────────────────────────────

export async function searchProfiles(
  query: string,
  role: "partner" | "artist"
): Promise<{ id: string; full_name: string | null; username: string; email?: string }[]> {
  if (!(await isAdmin())) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, username")
    .eq("role", role)
    .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(10);
  return data ?? [];
}
