import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createShadowAccount, ensureLedgerId, createLedgerEntry } from "@/lib/provenance";
import { sendTransferCertificate } from "@/lib/pdf/transfer-certificate";

/**
 * Webhook handler for `checkout.session.completed` with purpose=campaign_sale.
 *
 * Session metadata must contain:
 *   campaign_id  — campaigns.id
 *   work_id      — artworks.id
 *   artist_id    — profiles.id (the seller)
 *   buyer_name   — prefilled from the purchase form
 *
 * Idempotent: if the artwork is already marked unavailable, skips silently.
 */
export async function handleCampaignSaleCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { campaign_id, work_id, artist_id, buyer_name } = session.metadata ?? {};
  if (!campaign_id || !work_id || !artist_id) {
    console.warn("[campaign sale handler] missing required metadata", session.metadata);
    return;
  }

  const buyerEmail = session.customer_details?.email;
  const buyerName = buyer_name ?? session.customer_details?.name ?? "";
  if (!buyerEmail) throw new Error("[campaign sale handler] no buyer email on session");

  const admin = createAdminClient();

  // work_id is now an artworks.id directly
  const { data: artwork } = await admin
    .from("artworks")
    .select("id, is_available, creator_id, title, caption, url, year, medium, dimensions, certificate_note")
    .eq("id", work_id)
    .maybeSingle();

  if (!artwork) {
    console.warn(`[campaign sale handler] work ${work_id} not found`);
    return;
  }

  const resolvedArtworkId: string = artwork.id;
  if (!artwork.is_available) {
    console.warn(`[campaign sale handler] artwork ${resolvedArtworkId} already transferred — skipping`);
    return;
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const pricePaid = session.amount_total ? session.amount_total / 100 : null;

  // Create shadow account for buyer
  const { userId: buyerId, isNew } = await createShadowAccount(buyerEmail, buyerName);

  // Ensure the artwork has a provenance ledger ID
  const ledgerId = await ensureLedgerId(resolvedArtworkId);

  // Transfer ownership
  await admin
    .from("artworks")
    .update({ current_owner_id: buyerId, is_available: false })
    .eq("id", resolvedArtworkId);

  // Append to buyer's acquired_works
  const { data: buyerProfile } = await admin
    .from("profiles")
    .select("acquired_works")
    .eq("id", buyerId)
    .maybeSingle();
  const existingWorks = (buyerProfile?.acquired_works as string[] | null) ?? [];
  await admin
    .from("profiles")
    .update({ acquired_works: [...existingWorks, resolvedArtworkId] })
    .eq("id", buyerId);

  // Add to buyer's collection
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
      price_paid_amount: pricePaid,
      price_paid_currency: (session.currency ?? "nzd").toUpperCase(),
    },
    { onConflict: "holder_id,artwork_id", ignoreDuplicates: true },
  );

  // Record the provenance ledger entry
  await createLedgerEntry({
    artworkId: resolvedArtworkId,
    ledgerId,
    entryType: "transferred",
    fromOwnerId: artist_id,
    toOwnerId: buyerId,
    transferMethod: "stripe",
    price: pricePaid,
    campaignId: campaign_id,
  });

  // Fetch artist profile for certificate branding
  const [{ data: artistProfile }, { data: branding }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", artist_id).maybeSingle(),
    admin.from("profiles").select("provenance_logo_url, provenance_signature_url").eq("id", artist_id).maybeSingle(),
  ]);

  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";
  const workTitle = artwork.title ?? artwork.caption ?? "Untitled";

  sendTransferCertificate({
    artistId: artist_id,
    buyerId,
    ledgerId,
    workTitle,
    workImageUrl: artwork.url ?? null,
    artistName,
    artistUsername: artistProfile?.username ?? null,
    patronName: buyerName,
    yearCreated: (artwork as { year?: number | null }).year ?? null,
    medium: (artwork as { medium?: string | null }).medium ?? null,
    dimensions: (artwork as { dimensions?: string | null }).dimensions ?? null,
    edition: (artwork as { edition?: string | null }).edition ?? null,
    certificateNote: (artwork as { certificate_note?: string | null }).certificate_note ?? null,
    logoUrl: branding?.provenance_logo_url ?? null,
    signatureUrl: branding?.provenance_signature_url ?? null,
    isNewAccount: isNew,
  }).catch(console.error);

  void paymentIntent; // used in ledger via createLedgerEntry's transaction_ref (not on cert)
}
