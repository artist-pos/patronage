"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignEnquiryNotification } from "@/lib/email";
import { createCheckoutSession } from "@/lib/stripe";
import { createShadowAccount, ensureLedgerId, createLedgerEntry } from "@/lib/provenance";
import { sendTransferCertificate } from "@/lib/pdf/transfer-certificate";

export async function sendCampaignEnquiry(opts: {
  campaignId: string;
  visitorName: string;
  visitorEmail: string;
  message: string;
  workTitle: string | null;
}): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("title, artist_profile_id, slug, venue_contact_name, venue_contact_email")
    .eq("id", opts.campaignId)
    .single();

  if (!campaign) return { error: "Campaign not found" };

  const c = campaign as {
    title: string;
    artist_profile_id: string;
    slug: string;
    venue_contact_name: string | null;
    venue_contact_email: string | null;
  };

  // Fetch artist email from auth
  let artistEmail: string | undefined;
  let artistName = "Artist";
  try {
    const { data: { user } } = await admin.auth.admin.getUserById(c.artist_profile_id);
    artistEmail = user?.email;
    const { data: artistProfile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", c.artist_profile_id)
      .single();
    artistName = (artistProfile as { full_name?: string | null; username?: string } | null)?.full_name
      ?? (artistProfile as { full_name?: string | null; username?: string } | null)?.username
      ?? "Artist";
  } catch {
    // continue without email
  }

  if (artistEmail) {
    sendCampaignEnquiryNotification({
      artistEmail,
      artistName,
      workTitle: opts.workTitle ?? "their campaign",
      visitorName: opts.visitorName,
      visitorEmail: opts.visitorEmail,
      message: opts.message,
      campaignTitle: c.title,
      venueContactEmail: c.venue_contact_email,
      venueContactName: c.venue_contact_name,
    }).catch(console.error);
  }

  return {};
}

/**
 * Create a Stripe Checkout session for a paid campaign work purchase.
 * The buyer name is stored in session metadata; Stripe collects the email.
 */
export async function createCampaignSaleCheckout(opts: {
  campaignId: string;
  workId: string;
  artistId: string;
  campaignSlug: string;
  artistUsername: string;
  buyerName: string;
  buyerEmail: string;
  priceCents: number;
  currency: string;
  workTitle: string;
  workImageUrl: string | null;
}): Promise<{ checkoutUrl?: string; error?: string }> {
  if (!opts.buyerName.trim() || !opts.buyerEmail.trim()) {
    return { error: "Name and email are required." };
  }
  if (opts.priceCents <= 0) {
    return { error: "Use claimCampaignWorkFree for free works." };
  }

  try {
    const { url } = await createCheckoutSession({
      purpose: "campaign_sale",
      mode: "payment",
      buyerEmail: opts.buyerEmail.trim(),
      lineItems: [
        {
          amountCents: opts.priceCents,
          currency: opts.currency.toLowerCase(),
          productName: opts.workTitle,
          productImageUrl: opts.workImageUrl,
          productDescription: `Original artwork by ${opts.artistUsername} — includes Patronage provenance certificate.`,
        },
      ],
      metadata: {
        campaign_id: opts.campaignId,
        work_id: opts.workId,
        artist_id: opts.artistId,
        buyer_name: opts.buyerName.trim(),
      },
      successPath: `/live/${opts.campaignSlug}/${opts.artistUsername}?purchased=1`,
      cancelPath: `/live/${opts.campaignSlug}/${opts.artistUsername}`,
    });
    return { checkoutUrl: url };
  } catch (err) {
    console.error("[createCampaignSaleCheckout]", err);
    return { error: "Failed to start checkout. Please try again." };
  }
}

/**
 * Claim a free campaign work (price = 0). Bypasses Stripe entirely:
 * creates a shadow account + ledger entry + sends certificate email.
 */
export async function claimCampaignWorkFree(opts: {
  campaignId: string;
  workId: string;
  artistId: string;
  claimerName: string;
  claimerEmail: string;
}): Promise<{ error?: string; ledgerId?: string }> {
  if (!opts.claimerName.trim() || !opts.claimerEmail.trim()) {
    return { error: "Name and email are required." };
  }

  const admin = createAdminClient();

  // Resolve or create the artwork record
  const { data: work } = await admin
    .from("portfolio_images")
    .select("id, url, caption, title, year, medium, dimensions, linked_artwork_id")
    .eq("id", opts.workId)
    .maybeSingle();

  if (!work) return { error: "Work not found." };

  let artworkId = (work as { linked_artwork_id?: string | null }).linked_artwork_id ?? null;

  if (!artworkId) {
    const { data: created, error: createError } = await admin
      .from("artworks")
      .insert({
        creator_id: opts.artistId,
        current_owner_id: opts.artistId,
        title: work.title ?? null,
        caption: work.caption ?? null,
        url: work.url ?? null,
        year: (work as { year?: number | null }).year ?? null,
        medium: (work as { medium?: string | null }).medium ?? null,
        dimensions: (work as { dimensions?: string | null }).dimensions ?? null,
        is_available: true,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return { error: "Failed to register work." };
    }
    artworkId = created.id;
    await admin.from("portfolio_images").update({ linked_artwork_id: artworkId }).eq("id", opts.workId);
  }

  if (!artworkId) return { error: "Failed to resolve artwork." };
  const resolvedArtworkId: string = artworkId;

  const { data: artwork } = await admin
    .from("artworks")
    .select("is_available, title, caption, url, year, medium, dimensions, edition, certificate_note")
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };
  if (!artwork.is_available) return { error: "This work has already been claimed." };

  const { userId: buyerId, isNew } = await createShadowAccount(
    opts.claimerEmail.trim(),
    opts.claimerName.trim(),
  );

  const ledgerId = await ensureLedgerId(resolvedArtworkId);

  await admin
    .from("artworks")
    .update({ current_owner_id: buyerId, is_available: false })
    .eq("id", resolvedArtworkId);

  const { data: buyerProfile } = await admin
    .from("profiles")
    .select("acquired_works")
    .eq("id", buyerId)
    .maybeSingle();
  const existing = (buyerProfile?.acquired_works as string[] | null) ?? [];
  await admin
    .from("profiles")
    .update({ acquired_works: [...existing, resolvedArtworkId] })
    .eq("id", buyerId);

  const { data: lastPos } = await admin
    .from("collection_membership")
    .select("position")
    .eq("holder_id", buyerId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await admin.from("collection_membership").upsert(
    {
      holder_id: buyerId,
      artwork_id: resolvedArtworkId,
      position: (lastPos?.position ?? -1) + 1,
      source_type: "directly_from_artist",
      price_paid_amount: 0,
      price_paid_currency: "NZD",
    },
    { onConflict: "holder_id,artwork_id", ignoreDuplicates: true },
  );

  await createLedgerEntry({
    artworkId: resolvedArtworkId,
    ledgerId,
    entryType: "transferred",
    fromOwnerId: opts.artistId,
    toOwnerId: buyerId,
    transferMethod: "gift",
    price: 0,
    campaignId: opts.campaignId,
  });

  const [{ data: artistProfile }, { data: branding }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", opts.artistId).maybeSingle(),
    admin.from("profiles").select("provenance_logo_url, provenance_signature_url").eq("id", opts.artistId).maybeSingle(),
  ]);

  sendTransferCertificate({
    artistId: opts.artistId,
    buyerId,
    ledgerId,
    workTitle: artwork.title ?? artwork.caption ?? "Untitled",
    workImageUrl: artwork.url ?? null,
    artistName: artistProfile?.full_name ?? artistProfile?.username ?? "The artist",
    artistUsername: artistProfile?.username ?? null,
    patronName: opts.claimerName.trim(),
    yearCreated: (artwork as { year?: number | null }).year ?? null,
    medium: (artwork as { medium?: string | null }).medium ?? null,
    dimensions: (artwork as { dimensions?: string | null }).dimensions ?? null,
    edition: (artwork as { edition?: string | null }).edition ?? null,
    certificateNote: (artwork as { certificate_note?: string | null }).certificate_note ?? null,
    logoUrl: branding?.provenance_logo_url ?? null,
    signatureUrl: branding?.provenance_signature_url ?? null,
    isNewAccount: isNew,
  }).catch(console.error);

  return { ledgerId };
}
