"use server";

import { createClient } from "@/lib/supabase/server";
import { initializeInquiryThread } from "@/app/messages/actions";

export async function sendWorkOffer(
  artistId: string,
  workId: string,
  offerAmount: number,
  offerCurrency: "NZD" | "AUD"
): Promise<{ conversationId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // Get or create conversation
  const convResult = await initializeInquiryThread(artistId, "artwork_offer", workId);
  if ("error" in convResult) return { error: convResult.error };

  const conversationId = convResult.id;

  // Fetch work details for the message content
  const { data: work } = await supabase
    .from("artworks")
    .select("caption")
    .eq("id", workId)
    .maybeSingle();

  const workTitle = work?.caption ?? "Untitled";

  // Insert work_offer message
  const { error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `Offer of ${offerCurrency} ${offerAmount.toLocaleString("en-NZ")} for "${workTitle}"`,
      message_type: "work_offer",
      work_id: workId,
      offer_amount: offerAmount,
      offer_currency: offerCurrency,
    });

  if (insertError) return { error: insertError.message };

  return { conversationId };
}
