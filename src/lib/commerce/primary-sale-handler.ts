import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";
import { ledgerContentHash, HASH_VERSION } from "@/lib/content-hash";
import { sendPurchaseConfirmation } from "@/lib/email";

/**
 * Webhook handler for `checkout.session.completed` with purpose=primary_sale.
 * Mirrors the resale handler minus the royalty hold — artist IS the seller.
 *
 * Idempotent on stripe_session_id.
 */
export async function handlePrimarySaleCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const saleId = session.metadata?.primary_sale_id;
  if (!saleId) {
    console.warn("[primary sale handler] missing primary_sale_id");
    return;
  }

  const admin = createAdminClient();
  const { data: sale } = await admin
    .from("primary_sale_transactions")
    .select("*")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) {
    console.warn(`[primary sale handler] sale ${saleId} not found`);
    return;
  }
  if (sale.status === "paid") return;

  const paidAt = new Date().toISOString();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const buyerEmail = (session.customer_details?.email ?? sale.buyer_email).toLowerCase();
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
    throw new Error("Couldn't resolve a buyer profile id for the primary sale");
  }

  // Append a 'transferred' ledger entry. The artwork already has a 'created'
  // entry from when the artist registered it; this is the first owner change.
  const createdAt = new Date();
  const { data: artwork } = await admin
    .from("artworks")
    .select("ledger_id")
    .eq("id", sale.artwork_id)
    .maybeSingle();
  if (!artwork?.ledger_id) {
    throw new Error(`Artwork ${sale.artwork_id} has no ledger_id; cannot append transferred entry`);
  }

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
    transaction_ref: paymentIntent,
    price: sale.sale_price_cents / 100,
    transferred_at: createdAt.toISOString(),
    content_hash: contentHash,
    hash_version: HASH_VERSION,
  });

  // Flip ownership and mark the artwork unavailable.
  await admin
    .from("artworks")
    .update({ current_owner_id: buyerProfileId, is_available: false })
    .eq("id", sale.artwork_id);

  // Mint a claim token for the buyer and read it back for the email.
  const { data: provenanceLink } = await admin.from("provenance_links").insert({
    artwork_id: sale.artwork_id,
    artist_id: sale.artist_id,
    patron_id: buyerProfileId,
    patron_email: buyerEmail,
    status: "invited",
  }).select("claim_token").single();

  // Upsert collection_membership so the work appears in the buyer's dashboard
  // immediately — even for shadow accounts (they'll see it the moment they claim).
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

  // Fetch artist name + ledger_id for the confirmation email.
  const [{ data: artistProfile }, { data: artworkForEmail }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", sale.artist_id).maybeSingle(),
    admin.from("artworks").select("ledger_id, url, caption").eq("id", sale.artwork_id).maybeSingle(),
  ]);
  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";
  const isGuest = sale.buyer_id === null; // was null before webhook resolved it
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

  await admin
    .from("primary_sale_transactions")
    .update({
      status: "paid",
      buyer_id: buyerProfileId,
      buyer_email: buyerEmail,
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      paid_at: paidAt,
    })
    .eq("id", sale.id);
}
