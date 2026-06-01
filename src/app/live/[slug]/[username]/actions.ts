"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignEnquiryNotification } from "@/lib/email";
import { createCheckoutSession, getStripe } from "@/lib/stripe";
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
  printSize?: string;
  shippingConfig?: {
    nz_cents?: number;
    intl_cents?: number;
    stripe_nz_rate_id?: string;
    stripe_intl_rate_id?: string;
  };
}): Promise<{ checkoutUrl?: string; error?: string }> {
  if (!opts.buyerName.trim() || !opts.buyerEmail.trim()) {
    return { error: "Name and email are required." };
  }
  if (opts.priceCents <= 0) {
    return { error: "Use claimCampaignWorkFree for free works." };
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const metadata: Record<string, string> = {
    campaign_id: opts.campaignId,
    work_id: opts.workId,
    artist_id: opts.artistId,
    buyer_name: opts.buyerName.trim(),
    ...(opts.printSize ? { print_size: opts.printSize } : {}),
  };

  try {
    // If shipping rates are configured, use the Stripe SDK directly so we can
    // attach shipping_options (not supported by the generic createCheckoutSession helper).
    const hasShipping = opts.shippingConfig &&
      (opts.shippingConfig.nz_cents || opts.shippingConfig.intl_cents);

    if (hasShipping) {
      const shippingOptionIds = await Promise.all([
        opts.shippingConfig!.nz_cents
          ? ensureShippingRate("nz", opts.shippingConfig!.nz_cents, opts.currency, opts.campaignId, opts.shippingConfig!.stripe_nz_rate_id)
          : Promise.resolve(null),
        opts.shippingConfig!.intl_cents
          ? ensureShippingRate("intl", opts.shippingConfig!.intl_cents, opts.currency, opts.campaignId, opts.shippingConfig!.stripe_intl_rate_id)
          : Promise.resolve(null),
      ]);

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: opts.buyerEmail.trim(),
        line_items: [{
          quantity: 1,
          price_data: {
            currency: opts.currency.toLowerCase(),
            unit_amount: opts.priceCents,
            product_data: {
              name: opts.workTitle,
              images: opts.workImageUrl ? [opts.workImageUrl] : undefined,
              description: `Artwork by ${opts.artistUsername} — includes Patronage provenance certificate.`,
            },
          },
        }],
        shipping_address_collection: { allowed_countries: ["NZ", "AU", "GB", "US", "CA", "DE", "FR", "JP", "SG", "HK", "CN", "KR", "TW", "TH", "MY", "ID", "PH", "IN", "AE", "CH", "SE", "NO", "DK", "NL", "IT", "ES", "PT"] },
        shipping_options: shippingOptionIds.filter(Boolean).map(id => ({ shipping_rate: id! })),
        metadata: { purpose: "campaign_sale", ...metadata },
        payment_intent_data: { metadata: { purpose: "campaign_sale", ...metadata } },
        success_url: `${SITE_URL}/live/${opts.campaignSlug}/${opts.artistUsername}?purchased=1`,
        cancel_url: `${SITE_URL}/live/${opts.campaignSlug}/${opts.artistUsername}`,
      });
      if (!session.url) throw new Error("Stripe didn't return a checkout URL");
      return { checkoutUrl: session.url };
    }

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
          productDescription: `Artwork by ${opts.artistUsername} — includes Patronage provenance certificate.`,
        },
      ],
      metadata,
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
 * Lazily create a Stripe ShippingRate for the given zone and cache the ID
 * back on the campaign's landing_page_config so future checkouts reuse it.
 */
async function ensureShippingRate(
  zone: "nz" | "intl",
  amountCents: number,
  currency: string,
  campaignId: string,
  cachedRateId?: string,
): Promise<string> {
  if (cachedRateId) {
    // Verify it still exists in Stripe
    try {
      await getStripe().shippingRates.retrieve(cachedRateId);
      return cachedRateId;
    } catch {
      // Doesn't exist — fall through to create a new one
    }
  }

  const displayName = zone === "nz" ? "NZ Delivery" : "International Delivery";
  const rate = await getStripe().shippingRates.create({
    display_name: displayName,
    type: "fixed_amount",
    fixed_amount: { amount: amountCents, currency: currency.toLowerCase() },
    metadata: { campaign_id: campaignId, zone },
  });

  // Cache the new rate ID so the next checkout reuses it
  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("landing_page_config")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaign) {
    const existing = (campaign.landing_page_config ?? {}) as Record<string, unknown>;
    const existingShipping = (existing.shipping ?? {}) as Record<string, unknown>;
    await admin.from("campaigns").update({
      landing_page_config: {
        ...existing,
        shipping: {
          ...existingShipping,
          [`stripe_${zone}_rate_id`]: rate.id,
        },
      },
    }).eq("id", campaignId);
  }

  return rate.id;
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

  // Work IS the artwork row after migration 135
  const { data: artwork } = await admin
    .from("artworks")
    .select("id, is_available, title, caption, url, year, medium, dimensions, certificate_note")
    .eq("id", opts.workId)
    .maybeSingle();

  if (!artwork) return { error: "Work not found." };

  const resolvedArtworkId: string = artwork.id;
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
