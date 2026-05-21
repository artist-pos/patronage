"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTransferRequest, notifyTransferAccepted, notifyShippingAddress, type ShippingAddress } from "@/lib/email";
import { sendTransferCertificate } from "@/lib/pdf/transfer-certificate";
import { ensureLedgerId, createLedgerEntry } from "@/lib/provenance";
import { calculateFees } from "@/lib/commerce-fee";
import { grossUpForStripe, PRICING_CURRENCY } from "@/lib/commerce-pricing";
import { createCheckoutSession } from "@/lib/stripe";

export async function initiateTransfer(
  workId: string,
  conversationId: string,
  /** Sale price in major units (e.g. 150.00). Pass 0 or omit for a gift. */
  salePriceMajor?: number,
  currency?: string,
): Promise<{ error?: string; checkoutUrl?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify caller is creator_id of the work
  const { data: work } = await supabase
    .from("artworks")
    .select("id, creator_id, current_owner_id, caption, url, is_available")
    .eq("id", workId)
    .maybeSingle();

  if (!work) return { error: "Work not found" };
  if (work.current_owner_id !== user.id) return { error: "You are not the current owner of this work" };
  if (!work.is_available) return { error: "This work is no longer available" };

  // Verify caller is participant in the conversation
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return { error: "Conversation not found" };
  if (conv.participant_a !== user.id && conv.participant_b !== user.id) {
    return { error: "You are not a participant in this conversation" };
  }

  // Resolve buyer (the other participant)
  const buyerId = conv.participant_a === user.id ? conv.participant_b : conv.participant_a;

  const isGift = !salePriceMajor || salePriceMajor <= 0;
  const salePriceCents = isGift ? 0 : Math.round(salePriceMajor * 100);
  const txCurrency = currency ?? PRICING_CURRENCY;

  let negotiatedSaleId: string | null = null;
  let checkoutUrl: string | undefined;

  if (!isGift) {
    // Create the transaction record before the Stripe session so the webhook
    // has something to match against.
    const admin = createAdminClient();
    const fees = calculateFees("negotiated_sale", salePriceCents);
    const { data: buyerAuthUser } = await admin.auth.admin.getUserById(buyerId);
    const buyerEmail = buyerAuthUser?.user?.email ?? "";

    const { data: txRow, error: txError } = await admin
      .from("negotiated_sale_transactions")
      .insert({
        artwork_id: workId,
        artist_id: user.id,
        buyer_id: buyerId,
        buyer_email: buyerEmail,
        conversation_id: conversationId,
        sale_price_cents: salePriceCents,
        currency: txCurrency,
        patronage_commission_cents: fees.patronageRevenueCents,
        buyer_paid_total_cents: fees.buyerPaidTotalCents,
      })
      .select("id")
      .single();

    if (txError || !txRow) return { error: txError?.message ?? "Couldn't create sale record." };
    negotiatedSaleId = txRow.id;

    const { stripeFeeCents } = grossUpForStripe(salePriceCents);
    const [{ data: artistProfile2 }, { data: artistConnectProfile }] = await Promise.all([
      supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("stripe_account_id, stripe_connect_status").eq("id", user.id).maybeSingle(),
    ]);

    const useConnect =
      artistConnectProfile?.stripe_connect_status === "enabled" &&
      !!artistConnectProfile?.stripe_account_id;

    try {
      const session = await createCheckoutSession({
        purpose: "negotiated_sale",
        mode: "payment",
        buyerEmail: "",  // Stripe will collect it at checkout
        lineItems: [
          {
            amountCents: salePriceCents,
            currency: txCurrency,
            productName: work.caption ?? "Artwork",
            productDescription: `Sold by ${artistProfile2?.full_name ?? artistProfile2?.username ?? "the artist"} via Patronage.`,
            productImageUrl: work.url ?? null,
          },
          {
            amountCents: stripeFeeCents,
            currency: txCurrency,
            productName: "Processing fee",
            productDescription: "Covers third-party card processing (Stripe). Reflects Stripe's actual cost.",
          },
        ],
        metadata: {
          negotiated_sale_id: negotiatedSaleId!,
          artwork_id: workId,
        },
        successPath: `/messages/${conversationId}?transferred=1`,
        cancelPath: `/messages/${conversationId}`,
        ...(useConnect ? {
          connectedAccountId: artistConnectProfile!.stripe_account_id!,
          applicationFeeCents: fees.stripeFeeCents + fees.patronageRevenueCents,
        } : {}),
      });
      await admin
        .from("negotiated_sale_transactions")
        .update({ stripe_session_id: session.sessionId })
        .eq("id", negotiatedSaleId);
      checkoutUrl = session.url;
    } catch (err) {
      await admin.from("negotiated_sale_transactions").delete().eq("id", negotiatedSaleId);
      return { error: err instanceof Error ? err.message : "Stripe error." };
    }
  }

  // Insert the transfer_request message. For paid transfers, metadata stores
  // the sale price so the patron's chat UI can show it.
  const { error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: "",
      message_type: "transfer_request",
      work_id: workId,
      metadata: isGift
        ? { transfer_type: "gift" }
        : {
            transfer_type: "sale",
            sale_price_cents: salePriceCents,
            currency: txCurrency,
            negotiated_sale_id: negotiatedSaleId,
            checkout_url: checkoutUrl,
          },
    });

  if (insertError) return { error: insertError.message };

  // Fetch artist name for notification
  const { data: artistProfile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";
  const workTitle = work.caption ?? "Untitled";

  notifyTransferRequest(buyerId, artistName, workTitle, conversationId).catch(console.error);

  return { checkoutUrl };
}

export async function acceptTransfer(
  messageId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch the transfer_request message
  const { data: message } = await supabase
    .from("messages")
    .select("id, sender_id, work_id, message_type, conversation_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!message) return { error: "Message not found" };
  if (message.message_type !== "transfer_request") return { error: "Not a transfer request" };
  if (message.sender_id === user.id) return { error: "You cannot accept your own transfer" };
  if (!message.work_id) return { error: "No work associated with this transfer" };

  // Verify work is still available (guard against double-accept)
  const { data: work } = await supabase
    .from("artworks")
    .select("id, title, caption, url, is_available, creator_id, current_owner_id, year, medium, dimensions, edition, certificate_note, ledger_id")
    .eq("id", message.work_id)
    .maybeSingle();

  if (!work) return { error: "Work not found" };
  if (!work.is_available) return { error: "This work has already been transferred" };

  // Update ownership — use admin client to bypass RLS; auth checks above are sufficient
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("artworks")
    .update({ current_owner_id: user.id, is_available: false, price_cents: null, is_poa: false })
    .eq("id", message.work_id);

  if (updateError) return { error: updateError.message };

  // Append work id to buyer's acquired_works array
  const { data: buyerProfile } = await supabase
    .from("profiles")
    .select("acquired_works")
    .eq("id", user.id)
    .maybeSingle();

  const existing = buyerProfile?.acquired_works ?? [];
  await supabase
    .from("profiles")
    .update({ acquired_works: [...existing, message.work_id] })
    .eq("id", user.id);

  // Insert transfer_accepted system message — capture ID for certificate
  const { data: acceptedMsg, error: acceptMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: message.conversation_id,
      sender_id: user.id,
      content: "",
      message_type: "transfer_accepted",
      work_id: message.work_id,
    })
    .select("id")
    .single();

  if (acceptMsgError) return { error: acceptMsgError.message };

  // Fetch buyer + artist profiles for notifications and certificate
  const [{ data: buyerData }, { data: artistData }] = await Promise.all([
    supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name, username").eq("id", work.creator_id).maybeSingle(),
  ]);

  const buyerName = buyerData?.full_name ?? buyerData?.username ?? "The buyer";
  const artistName = artistData?.full_name ?? artistData?.username ?? "The artist";
  const artistUsername = artistData?.username ?? null;
  const workTitle = work.title ?? work.caption ?? "Untitled";
  const w = work as {
    url?: string | null;
    year?: number | null;
    medium?: string | null;
    dimensions?: string | null;
    edition?: string | null;
    certificate_note?: string | null;
  };

  // Upsert collection_membership so the work appears in the buyer's dashboard.
  const { data: lastPos } = await admin
    .from("collection_membership")
    .select("position")
    .eq("holder_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await admin.from("collection_membership").upsert(
    {
      holder_id: user.id,
      artwork_id: message.work_id!,
      position: (lastPos?.position ?? -1) + 1,
      source_type: "directly_from_artist",
    },
    { onConflict: "holder_id,artwork_id", ignoreDuplicates: true },
  );

  // Ledger entry must complete before returning — chain of custody depends on it.
  // Gift transfers (no payment) use the "gift" transfer method; paid DM transfers
  // are handled by the negotiated_sale webhook and never reach acceptTransfer.
  const ledgerId = await ensureLedgerId(message.work_id!);
  await createLedgerEntry({
    artworkId: message.work_id!,
    ledgerId,
    entryType: "transferred",
    fromOwnerId: work.current_owner_id,
    toOwnerId: user.id,
    transferMethod: "gift",
  });

  // Fire-and-forget: notifications + certificate (non-critical)
  ;(async () => {
    const { data: branding } = await admin.from("profiles")
      .select("provenance_logo_url, provenance_signature_url")
      .eq("id", work.creator_id)
      .maybeSingle();
    await Promise.all([
      notifyTransferAccepted(work.creator_id, buyerName, workTitle),
      sendTransferCertificate({
        artistId: work.creator_id,
        buyerId: user.id,
        ledgerId,
        workTitle,
        workImageUrl: w.url ?? null,
        artistName,
        artistUsername,
        patronName: buyerName,
        yearCreated: w.year ?? null,
        medium: w.medium ?? null,
        dimensions: w.dimensions ?? null,
        edition: w.edition ?? null,
        certificateNote: w.certificate_note ?? null,
        logoUrl: branding?.provenance_logo_url ?? null,
        signatureUrl: branding?.provenance_signature_url ?? null,
      }),
    ]);
  })().catch(console.error);

  return {};
}

export async function submitShippingAddress(
  messageId: string,
  conversationId: string,
  address: ShippingAddress,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the message exists and the caller is the sender (buyer)
  const { data: msg } = await supabase
    .from("messages")
    .select("id, sender_id, work_id, message_type, metadata")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) return { error: "Message not found" };
  if (msg.message_type !== "transfer_accepted") return { error: "Invalid message type" };
  if (msg.sender_id !== user.id) return { error: "Not authorised" };
  if ((msg.metadata as Record<string, unknown> | null)?.shipping_address) {
    return { error: "Address already submitted" };
  }

  const admin = createAdminClient();

  // Persist address on the transfer_accepted message metadata
  const { error: updateErr } = await admin
    .from("messages")
    .update({ metadata: { ...(msg.metadata ?? {}), shipping_address: address } })
    .eq("id", messageId);

  if (updateErr) return { error: updateErr.message };

  // Insert a system message so the artist sees the address via realtime
  const addrText = [
    address.recipientName,
    address.line1,
    address.line2,
    `${address.city} ${address.postcode}`.trim(),
    address.country,
  ].filter(Boolean).join(", ");

  await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: `Shipping address: ${addrText}`,
    message_type: "text",
    is_system_message: true,
    metadata: { shipping_address: address },
  });

  // Resolve artist id from the work
  if (msg.work_id) {
    const { data: work } = await admin
      .from("artworks")
      .select("creator_id, caption, title")
      .eq("id", msg.work_id)
      .maybeSingle();

    if (work) {
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();

      const buyerName = buyerProfile?.full_name ?? buyerProfile?.username ?? "The buyer";
      const workTitle = work.title ?? work.caption ?? "Untitled";

      notifyShippingAddress(work.creator_id, buyerName, workTitle, address, conversationId)
        .catch(console.error);
    }
  }

  return {};
}
