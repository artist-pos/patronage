"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureLedgerId,
  createLedgerEntry,
  createShadowAccount,
  getArtistProvenanceOverview,
} from "@/lib/provenance";
import { sendTransferCertificate } from "@/lib/pdf/transfer-certificate";
import {
  sendOwnershipClaimNotification,
  sendClaimDeclinedNotification,
} from "@/lib/email";

export { getArtistProvenanceOverview };

// ── Direct transfer (dashboard-initiated, no message thread) ──────────────────

export async function initiateDirectTransfer(
  artworkId: string,
  buyerName: string,
  buyerEmail: string,
  price?: number | null,
  notes?: string | null,
  campaignId?: string | null,
): Promise<{ error?: string; ledgerId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Verify caller is the creator of this artwork
  const { data: artwork } = await admin
    .from("artworks")
    .select("id, title, caption, url, creator_id, current_owner_id, is_available, year, medium, dimensions, edition, certificate_note")
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };
  if (artwork.creator_id !== user.id) return { error: "You are not the creator of this work." };
  if (!artwork.is_available) return { error: "This work has already been transferred." };

  // Resolve buyer — create shadow account if needed
  const { userId: buyerId, isNew } = await createShadowAccount(buyerEmail, buyerName);

  // Ensure artwork has a ledger ID
  const ledgerId = await ensureLedgerId(artworkId);

  // Transfer ownership
  const { error: updateError } = await admin
    .from("artworks")
    .update({ current_owner_id: buyerId, is_available: false })
    .eq("id", artworkId);

  if (updateError) return { error: `Failed to update ownership: ${updateError.message}` };

  // Append to buyer's acquired_works
  const { data: buyerProfile } = await admin
    .from("profiles")
    .select("acquired_works")
    .eq("id", buyerId)
    .maybeSingle();

  const existing = buyerProfile?.acquired_works ?? [];
  await admin
    .from("profiles")
    .update({ acquired_works: [...existing, artworkId] })
    .eq("id", buyerId);

  // Record ledger entry
  await createLedgerEntry({
    artworkId,
    ledgerId,
    entryType: "transferred",
    fromOwnerId: user.id,
    toOwnerId: buyerId,
    transferMethod: "direct",
    price: price ?? null,
    notes: notes ?? null,
    campaignId: campaignId ?? null,
  });

  // Fetch artist profile for certificate branding
  const [{ data: artistProfile }, { data: branding }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle(),
    admin.from("profiles").select("provenance_logo_url, provenance_signature_url").eq("id", user.id).maybeSingle(),
  ]);

  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";
  const workTitle = (artwork as { title: string | null; caption: string | null }).title ?? (artwork as { caption: string | null }).caption ?? "Untitled";

  // Fire-and-forget certificate email
  sendTransferCertificate({
    artistId: user.id,
    buyerId,
    ledgerId,
    workTitle,
    workImageUrl: artwork.url ?? null,
    artistName,
    artistUsername: artistProfile?.username ?? null,
    patronName: buyerName,
    yearCreated: artwork.year ?? null,
    medium: artwork.medium ?? null,
    dimensions: artwork.dimensions ?? null,
    edition: artwork.edition ?? null,
    certificateNote: artwork.certificate_note ?? null,
    logoUrl: branding?.provenance_logo_url ?? null,
    signatureUrl: branding?.provenance_signature_url ?? null,
    isNewAccount: isNew,
  }).catch(console.error);

  return { ledgerId };
}

// ── Ownership claim (public — no auth required) ───────────────────────────────

export async function submitOwnershipClaim(
  artworkId: string,
  claimerName: string,
  claimerEmail: string,
): Promise<{ error?: string }> {
  if (!claimerName.trim() || !claimerEmail.trim()) {
    return { error: "Name and email are required." };
  }

  const admin = createAdminClient();

  // Verify artwork exists and get creator info for notification
  const { data: artwork } = await admin
    .from("artworks")
    .select("id, title, creator_id")
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };

  // Check for duplicate pending claim from same email
  const { data: existing } = await admin
    .from("pending_ownership_claims")
    .select("id")
    .eq("artwork_id", artworkId)
    .eq("claimer_email", claimerEmail.toLowerCase())
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return { error: "A claim from this email is already pending." };

  // Insert claim
  const { error: insertError } = await admin
    .from("pending_ownership_claims")
    .insert({
      artwork_id: artworkId,
      claimer_name: claimerName.trim(),
      claimer_email: claimerEmail.trim().toLowerCase(),
    });

  if (insertError) return { error: insertError.message };

  // Notify artist
  const [{ data: artistProfile }, { data: { user: artistUser } }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", artwork.creator_id).maybeSingle(),
    admin.auth.admin.getUserById(artwork.creator_id),
  ]);

  if (artistUser?.email) {
    const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";
    const artworkTitle = artwork.title ?? "Untitled";
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

    sendOwnershipClaimNotification({
      artistEmail: artistUser.email,
      artistName,
      claimerName: claimerName.trim(),
      claimerEmail: claimerEmail.trim(),
      artworkTitle,
      dashboardUrl: `${SITE_URL}/dashboard?tab=provenance`,
    }).catch(console.error);
  }

  return {};
}

// ── Resolve claim (artist approves or declines) ───────────────────────────────

export async function resolveOwnershipClaim(
  claimId: string,
  action: "approve" | "decline",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Fetch claim with artwork info
  const { data: claim } = await admin
    .from("pending_ownership_claims")
    .select("*, artwork:artworks(id, title, creator_id)")
    .eq("id", claimId)
    .maybeSingle() as { data: any };

  if (!claim) return { error: "Claim not found." };
  if (claim.artwork?.creator_id !== user.id) return { error: "Not authorised." };
  if (claim.status !== "pending") return { error: "This claim has already been resolved." };

  // Mark resolved
  await admin
    .from("pending_ownership_claims")
    .update({ status: action === "approve" ? "approved" : "declined", resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", claimId);

  if (action === "decline") {
    // Notify claimer
    const { data: artistProfile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .maybeSingle();
    sendClaimDeclinedNotification({
      claimerEmail: claim.claimer_email,
      claimerName: claim.claimer_name,
      artworkTitle: claim.artwork?.title ?? "Untitled",
      artistName: artistProfile?.full_name ?? artistProfile?.username ?? "The artist",
    }).catch(console.error);
    return {};
  }

  // Approve: execute the transfer
  const result = await initiateDirectTransfer(
    claim.artwork_id,
    claim.claimer_name,
    claim.claimer_email,
    null,
    `Approved from ownership claim ${claimId}`,
  );

  return result.error ? { error: result.error } : {};
}

// ── Provenance settings ───────────────────────────────────────────────────────

export async function saveProvenanceSettings(data: {
  provenance_logo_url?: string | null;
  provenance_signature_url?: string | null;
  provenance_template_theme?: "minimal" | "editorial" | "gallery";
  provenance_primary_color?: string | null;
  provenance_accent_color?: string | null;
  provenance_font_pair?:
    | "classic" | "modern" | "mixed" | "inverse"
    | "editorial" | "mono" | "condensed" | "display";
  provenance_orientation?: "portrait" | "landscape";
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Validate hex colours so we never write "javascript:..." or anything wild
  // into a column that ends up in a generated PDF.
  const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  if (data.provenance_primary_color && !HEX_RE.test(data.provenance_primary_color)) {
    return { error: "Primary colour must be a valid hex code." };
  }
  if (data.provenance_accent_color && !HEX_RE.test(data.provenance_accent_color)) {
    return { error: "Accent colour must be a valid hex code." };
  }

  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", user.id);

  return error ? { error: error.message } : {};
}
