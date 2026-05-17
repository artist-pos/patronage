import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";
import { ledgerContentHash, HASH_VERSION } from "@/lib/content-hash";
import { sendPurchaseConfirmation } from "@/lib/email";

/**
 * Shared completion logic for primary sales — called by both the legacy
 * Hosted Checkout handler and the new PaymentIntent (embedded) handler.
 */
async function completePrimarySale(params: {
  saleId: string;
  buyerEmail: string;
  buyerName: string | null;
  paymentIntentId: string | null;
  sessionId: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: sale } = await admin
    .from("primary_sale_transactions")
    .select("*")
    .eq("id", params.saleId)
    .maybeSingle();
  if (!sale) {
    console.warn(`[primary sale handler] sale ${params.saleId} not found`);
    return;
  }
  if (sale.status === "paid") return;

  const paidAt = new Date().toISOString();
  const buyerEmail = params.buyerEmail.toLowerCase();
  let buyerProfileId: string | null = sale.buyer_id;

  if (!buyerProfileId) {
    buyerProfileId = await findAuthUserIdByEmail(admin, buyerEmail);
    if (!buyerProfileId) {
      const { data: created } = await admin.auth.admin.createUser({
        email: buyerEmail,
        email_confirm: false,
      });
      if (created?.user) {
        buyerProfileId = created.user.id;
        await admin.from("profiles").upsert(
          {
            id: buyerProfileId,
            username: `buyer-${buyerProfileId.slice(0, 8)}`,
            full_name: params.buyerName,
            role: "patron",
            account_status: "shadow",
          },
          { onConflict: "id" },
        );
      }
    }
  }
  if (!buyerProfileId) {
    throw new Error("Couldn't resolve a buyer profile id for the primary sale");
  }

  const { data: artwork } = await admin
    .from("artworks")
    .select("ledger_id")
    .eq("id", sale.artwork_id)
    .maybeSingle();
  if (!artwork?.ledger_id) {
    throw new Error(`Artwork ${sale.artwork_id} has no ledger_id; cannot append transferred entry`);
  }

  const createdAt = new Date();
  const contentHash = ledgerContentHash({
    artwork_id: sale.artwork_id,
    entry_type: "transferred",
    from_owner_id: sale.artist_id,
    to_owner_id: buyerProfileId,
    transfer_method: "stripe",
    campaign_id: null,
    created_at: createdAt,
  });

  await admin.from("artwork_provenance_ledger").insert({
    artwork_id: sale.artwork_id,
    ledger_id: artwork.ledger_id,
    entry_type: "transferred",
    from_owner_id: sale.artist_id,
    to_owner_id: buyerProfileId,
    transfer_method: "stripe",
    transaction_ref: params.paymentIntentId,
    price: sale.sale_price_cents / 100,
    transferred_at: createdAt.toISOString(),
    content_hash: contentHash,
    hash_version: HASH_VERSION,
  });

  await admin
    .from("artworks")
    .update({ current_owner_id: buyerProfileId, is_available: false })
    .eq("id", sale.artwork_id);

  const { data: provenanceLink } = await admin.from("provenance_links").insert({
    artwork_id: sale.artwork_id,
    artist_id: sale.artist_id,
    patron_id: buyerProfileId,
    patron_email: buyerEmail,
    status: "invited",
  }).select("claim_token").single();

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

  const [{ data: artistProfile }, { data: artworkForEmail }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", sale.artist_id).maybeSingle(),
    admin.from("artworks").select("ledger_id, url, caption").eq("id", sale.artwork_id).maybeSingle(),
  ]);
  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";
  const isGuest = sale.buyer_id === null;
  sendPurchaseConfirmation({
    toEmail: buyerEmail,
    buyerName: params.buyerName,
    workTitle: artworkForEmail?.caption ?? "Untitled",
    artistName,
    workImageUrl: artworkForEmail?.url ?? null,
    provenanceUrl: artworkForEmail?.ledger_id
      ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/provenance/${artworkForEmail.ledger_id}`
      : `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/dashboard/collection`,
    claimToken: isGuest && provenanceLink?.claim_token ? String(provenanceLink.claim_token) : null,
  }).catch(console.error);

  await admin
    .from("primary_sale_transactions")
    .update({
      status: "paid",
      buyer_id: buyerProfileId,
      buyer_email: buyerEmail,
      stripe_session_id: params.sessionId,
      stripe_payment_intent: params.paymentIntentId,
      paid_at: paidAt,
    })
    .eq("id", sale.id);
}

/** Webhook handler for `payment_intent.succeeded` from embedded PaymentElement. */
export async function handlePrimaryPaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const saleId = intent.metadata?.primary_sale_id;
  if (!saleId) {
    console.warn("[primary sale handler] payment_intent missing primary_sale_id");
    return;
  }
  await completePrimarySale({
    saleId,
    buyerEmail: intent.metadata?.buyer_email ?? intent.receipt_email ?? "",
    buyerName: null,
    paymentIntentId: intent.id,
    sessionId: null,
  });
}

/**
 * Webhook handler for `checkout.session.completed` with purpose=primary_sale.
 * Delegates to shared completePrimarySale — idempotent on sale status.
 */
export async function handlePrimarySaleCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const saleId = session.metadata?.primary_sale_id;
  if (!saleId) {
    console.warn("[primary sale handler] missing primary_sale_id");
    return;
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  await completePrimarySale({
    saleId,
    buyerEmail: session.customer_details?.email ?? "",
    buyerName: session.customer_details?.name ?? null,
    paymentIntentId,
    sessionId: session.id,
  });
}
