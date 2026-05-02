import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";
import { ledgerContentHash, HASH_VERSION } from "@/lib/content-hash";
import { defaultHoldExpiry } from "@/lib/commerce-fee";
import { sendPurchaseConfirmation } from "@/lib/email";

/**
 * Webhook handler for `checkout.session.completed` events whose
 * metadata.purpose is "resale". Idempotent: same session id arriving
 * twice does nothing the second time.
 *
 * Phase 7 originally lived in /api/stripe/webhook/route.ts; extracted here
 * so Phase 7.5's webhook can dispatch by purpose.
 */
export async function handleResaleCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const resaleId = session.metadata?.resale_transaction_id;
  if (!resaleId) {
    console.warn("[resale handler] missing resale_transaction_id");
    return;
  }

  const admin = createAdminClient();

  const { data: resale } = await admin
    .from("resale_transactions")
    .select("*")
    .eq("id", resaleId)
    .maybeSingle();
  if (!resale) {
    console.warn(`[resale handler] resale ${resaleId} not found`);
    return;
  }
  if (resale.status === "paid") return;

  const paidAt = new Date().toISOString();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // 1. Resolve buyer profile (real → existing match → shadow account).
  const buyerEmail = (session.customer_details?.email ?? resale.buyer_email).toLowerCase();
  let buyerProfileId: string | null = resale.buyer_id;

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
            full_name: session.customer_details?.name ?? null,
            role: "patron",
            account_status: "shadow",
          },
          { onConflict: "id" },
        );
      }
    }
  }

  if (!buyerProfileId) {
    throw new Error("Couldn't resolve a buyer profile id for the resale");
  }

  // 2. Append the 'resold' ledger entry with content hash.
  const createdAt = new Date();
  const ledgerId = await ledgerIdFor(resale.artwork_id, admin);
  const contentHash = ledgerContentHash({
    artwork_id: resale.artwork_id,
    entry_type: "resold",
    from_owner_id: resale.seller_id,
    to_owner_id: buyerProfileId,
    transfer_method: "stripe",
    campaign_id: null,
    created_at: createdAt,
  });

  await admin.from("artwork_provenance_ledger").insert({
    artwork_id: resale.artwork_id,
    ledger_id: ledgerId,
    entry_type: "resold",
    from_owner_id: resale.seller_id,
    to_owner_id: buyerProfileId,
    transfer_method: "stripe",
    transaction_ref: paymentIntent,
    price: resale.sale_price_cents / 100,
    transferred_at: createdAt.toISOString(),
    content_hash: contentHash,
    hash_version: HASH_VERSION,
  });

  // 3. Flip ownership.
  await admin
    .from("artworks")
    .update({ current_owner_id: buyerProfileId, is_available: false })
    .eq("id", resale.artwork_id);

  // 4. Mint a claim token and read it back for the email.
  const { data: provenanceLink } = await admin.from("provenance_links").insert({
    artwork_id: resale.artwork_id,
    artist_id: resale.seller_id,
    patron_id: buyerProfileId,
    patron_email: buyerEmail,
    status: "invited",
  }).select("claim_token").single();

  // Upsert collection_membership so the work is visible in the buyer's dashboard.
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
      artwork_id: resale.artwork_id,
      position: (lastPosition?.position ?? -1) + 1,
      source_type: "other",
      price_paid_amount: resale.sale_price_cents / 100,
      price_paid_currency: resale.currency,
    },
    { onConflict: "holder_id,artwork_id", ignoreDuplicates: true },
  );

  // Fetch artist + artwork info for the confirmation email.
  const [{ data: artistProfile }, { data: artworkForEmail }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", resale.seller_id).maybeSingle(),
    admin.from("artworks").select("ledger_id, url, caption, creator_id").eq("id", resale.artwork_id).maybeSingle(),
  ]);
  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The seller";
  const isGuest = resale.buyer_id === null;
  sendPurchaseConfirmation({
    toEmail: buyerEmail,
    buyerName: session.customer_details?.name ?? null,
    workTitle: artworkForEmail?.caption ?? "Untitled",
    artistName,
    workImageUrl: artworkForEmail?.url ?? null,
    provenanceUrl: artworkForEmail?.ledger_id
      ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/provenance/${artworkForEmail.ledger_id}`
      : `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/dashboard/collection`,
    claimToken: isGuest && provenanceLink?.claim_token ? String(provenanceLink.claim_token) : null,
  }).catch(console.error);

  // 5. Earmark the 5% artist royalty.
  const { data: artwork } = await admin
    .from("artworks")
    .select("attributed_artist_id, attributed_pending_artist_id, attributed_artist_text")
    .eq("id", resale.artwork_id)
    .maybeSingle();
  await admin.from("royalty_holds").insert({
    resale_transaction_id: resale.id,
    artwork_id: resale.artwork_id,
    artist_profile_id: artwork?.attributed_artist_id ?? null,
    artist_pending_id: artwork?.attributed_pending_artist_id ?? null,
    artist_name_text: artwork?.attributed_artist_text ?? null,
    amount_cents: resale.artist_royalty_cents,
    currency: resale.currency,
    expires_at: defaultHoldExpiry().toISOString(),
  });

  // 6. Mark resale paid.
  await admin
    .from("resale_transactions")
    .update({
      status: "paid",
      buyer_id: buyerProfileId,
      buyer_email: buyerEmail,
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      paid_at: paidAt,
    })
    .eq("id", resale.id);
}

async function ledgerIdFor(
  artworkId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const { data } = await admin
    .from("artworks")
    .select("ledger_id")
    .eq("id", artworkId)
    .maybeSingle();
  if (!data?.ledger_id) {
    throw new Error(`Artwork ${artworkId} has no ledger_id; cannot append resold entry`);
  }
  return data.ledger_id;
}
