import { randomBytes } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * One organisation, one account. When a listing's organiser already has an
 * unclaimed (shadow) account, every claim path leads to claiming that account:
 * it keeps its id, so its followers (223), linked listings and page carry over.
 * Claiming the listing on its own would make a second account for the same
 * organisation and strand the first one's followers.
 */

/** The organiser's account if it's a partner nobody has claimed yet. */
export async function unclaimedShadowPartner(
  admin: Admin,
  profileId: string | null | undefined,
): Promise<{ id: string; full_name: string | null } | null> {
  if (!profileId) return null;
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, role, account_status")
    .eq("id", profileId)
    .maybeSingle();
  return data && data.role === "partner" && data.account_status === "shadow"
    ? { id: data.id, full_name: data.full_name }
    : null;
}

/**
 * A live claim token for a shadow account: the existing pending/sent one if
 * there is one, otherwise a new one (90 days, like Admin → Claim tokens).
 * A known address is recorded on a token that doesn't have one yet.
 */
export async function getOrCreateShadowClaimToken(
  admin: Admin,
  shadowId: string,
  recipient?: { email?: string | null; name?: string | null },
): Promise<{ id: string; token: string; status: string; recipient_email: string | null } | null> {
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("claim_tokens")
    .select("id, token, status, recipient_email, expires_at")
    .eq("entity_id", shadowId)
    .in("status", ["pending", "sent"])
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const email = recipient?.email?.trim().toLowerCase() || null;
  if (existing) {
    if (!existing.recipient_email && email) {
      await admin
        .from("claim_tokens")
        .update({ recipient_email: email, recipient_name: recipient?.name?.trim() || null })
        .eq("id", existing.id);
      existing.recipient_email = email;
    }
    return existing;
  }

  const token = randomBytes(8).toString("hex");
  const { data, error } = await admin
    .from("claim_tokens")
    .insert({
      token,
      entity_type: "partner",
      entity_id: shadowId,
      recipient_email: email,
      recipient_name: recipient?.name?.trim() || null,
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      status: "pending",
    })
    .select("id, token, status, recipient_email")
    .single();
  if (error || !data) {
    console.error("[shadow-claims] token:", error?.message);
    return null;
  }
  return data;
}

export function shadowClaimUrl(token: string): string {
  return `${SITE_URL}/claim/${token}`;
}

/** The "claim your organisation" email, as sent from Admin → Claim tokens. */
export function buildShadowClaimEmail(opts: {
  recipientName: string | null;
  entityLabel: string;
  entityType: "partner" | "artist";
  claimUrl: string;
  /** A line about the listing that prompted this, for the automatic invite. */
  context?: string;
}): { subject: string; html: string } {
  const entityTypeLabel = opts.entityType === "partner" ? "organisation" : "artist profile";
  const subject = `Claim your ${entityTypeLabel} on Patronage`;
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;font-size:14px;line-height:1.7">
<p>Hi ${opts.recipientName ?? "there"},</p>
<p>We've created a <strong>${entityTypeLabel}</strong> page for <strong>${opts.entityLabel}</strong> on Patronage — New Zealand's platform connecting artists with grants, residencies, and commissions.</p>
${opts.context ? `<p>${opts.context}</p>` : ""}
<p>Claim it to edit your profile, add your logo, and manage your presence on the platform.</p>
<div style="margin:28px 0">
  <a href="${opts.claimUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;font-size:14px;font-weight:600">Claim your listing →</a>
</div>
<p style="font-size:12px;color:#888">This link expires in 90 days. If you have any questions, reply to this email or contact <a href="mailto:hello@patronage.nz" style="color:#888">hello@patronage.nz</a>.</p>
<p style="font-size:12px;color:#888">— Blake, Patronage</p>
</body></html>`;
  return { subject, html };
}

/**
 * Once an organisation has claimed its account, the listings linked to it as
 * organiser become its own (profile_id), so they show in its dashboard and it
 * can edit them. Listings someone else already owns are left alone.
 */
export async function adoptLinkedListings(admin: Admin, organiserId: string): Promise<void> {
  const { error } = await admin
    .from("opportunities")
    .update({ profile_id: organiserId })
    .eq("organiser_profile_id", organiserId)
    .is("profile_id", null);
  if (error) console.error("[shadow-claims] adopt listings:", error.message);
}
