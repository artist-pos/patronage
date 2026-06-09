import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureLedgerId, createLedgerEntry } from "@/lib/provenance";
import { sendPurchaseConfirmation } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { sendTransferCertificate } from "@/lib/pdf/transfer-certificate";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/**
 * Webhook handler for negotiated_sale checkouts — DM transfers where the
 * artist set a price and the patron paid via Stripe. On completion:
 *   - Ownership flips
 *   - Ledger entry recorded as "negotiated_sale"
 *   - collection_membership created for buyer
 *   - Provenance certificate emailed to buyer
 *   - Artist payout queued in negotiated_sale_transactions
 */
export async function handleNegotiatedSaleCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const saleId = session.metadata?.negotiated_sale_id;
  if (!saleId) {
    console.warn("[negotiated sale handler] missing negotiated_sale_id");
    return;
  }

  const admin = createAdminClient();
  const { data: sale } = await admin
    .from("negotiated_sale_transactions")
    .select("*")
    .eq("id", saleId)
    .maybeSingle();

  if (!sale) {
    console.warn(`[negotiated sale handler] sale ${saleId} not found`);
    return;
  }
  if (sale.status === "paid") return;

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const buyerEmail = (session.customer_details?.email ?? sale.buyer_email).toLowerCase();
  const buyerProfileId: string = sale.buyer_id;

  // Flip ownership.
  await admin
    .from("artworks")
    .update({ current_owner_id: buyerProfileId, is_available: false, price_cents: null, is_poa: false })
    .eq("id", sale.artwork_id);

  // Ledger entry with negotiated_sale transfer method.
  const ledgerId = await ensureLedgerId(sale.artwork_id);
  await createLedgerEntry({
    artworkId: sale.artwork_id,
    ledgerId,
    entryType: "transferred",
    fromOwnerId: sale.artist_id,
    toOwnerId: buyerProfileId,
    transferMethod: "negotiated_sale",
    price: sale.sale_price_cents / 100,
  });

  // Upsert collection_membership.
  const { data: lastPosition } = await admin
    .from("collection_membership")
    .select("position")
    .eq("holder_id", buyerProfileId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await admin.from("collection_membership").upsert(
    {
      holder_id: buyerProfileId,
      artwork_id: sale.artwork_id,
      position: (lastPosition?.position ?? -1) + 1,
      source_type: "directly_from_artist",
      price_paid_amount: sale.sale_price_cents / 100,
      price_paid_currency: sale.currency,
    },
    { onConflict: "holder_id,artwork_id", ignoreDuplicates: true },
  );

  // Mark paid.
  await admin
    .from("negotiated_sale_transactions")
    .update({
      status: "paid",
      stripe_payment_intent: paymentIntent,
      paid_at: new Date().toISOString(),
    })
    .eq("id", sale.id);

  // Fire-and-forget: certificate + confirmation email.
  ;(async () => {
    const [{ data: artistProfile }, { data: buyerProfile }, { data: artwork }, { data: branding }] =
      await Promise.all([
        admin.from("profiles").select("full_name, username").eq("id", sale.artist_id).maybeSingle(),
        admin.from("profiles").select("full_name, username").eq("id", buyerProfileId).maybeSingle(),
        admin.from("artworks").select("caption, url, year, medium, dimensions, edition, certificate_note, ledger_id").eq("id", sale.artwork_id).maybeSingle(),
        admin.from("profiles").select("provenance_logo_url, provenance_signature_url").eq("id", sale.artist_id).maybeSingle(),
      ]);

    const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";
    const artistUsername = artistProfile?.username ?? null;
    const buyerName = buyerProfile?.full_name ?? buyerProfile?.username ?? null;
    const workTitle = artwork?.caption ?? "Untitled";

    createNotification(
      sale.artist_id,
      "sale",
      `${buyerName ?? "Someone"} purchased ${workTitle}`,
      null,
      "/studio/earnings",
    ).catch(console.error);

    await Promise.all([
      sendTransferCertificate({
        artistId: sale.artist_id,
        buyerId: buyerProfileId,
        ledgerId,
        workTitle,
        workImageUrl: artwork?.url ?? null,
        artistName,
        artistUsername,
        patronName: buyerName ?? "Collector",
        yearCreated: artwork?.year ?? null,
        medium: artwork?.medium ?? null,
        dimensions: artwork?.dimensions ?? null,
        edition: artwork?.edition ?? null,
        certificateNote: artwork?.certificate_note ?? null,
        logoUrl: branding?.provenance_logo_url ?? null,
        signatureUrl: branding?.provenance_signature_url ?? null,
      }),
      sendPurchaseConfirmation({
        toEmail: buyerEmail,
        buyerName,
        workTitle,
        artistName,
        workImageUrl: artwork?.url ?? null,
        provenanceUrl: artwork?.ledger_id
          ? `${SITE_URL}/provenance/${artwork.ledger_id}`
          : `${SITE_URL}/dashboard/collection`,
        claimToken: null, // buyer is always logged-in in the DM flow
      }),
    ]);
  })().catch(console.error);
}
