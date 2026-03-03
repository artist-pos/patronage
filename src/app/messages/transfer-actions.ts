"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTransferRequest, notifyTransferAccepted } from "@/lib/email";

export async function initiateTransfer(
  workId: string,
  conversationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify caller is creator_id of the work
  const { data: work } = await supabase
    .from("portfolio_images")
    .select("id, creator_id, caption, is_available")
    .eq("id", workId)
    .maybeSingle();

  if (!work) return { error: "Work not found" };
  if (work.creator_id !== user.id) return { error: "You are not the creator of this work" };
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

  // Insert transfer_request message
  const { error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: "",
      message_type: "transfer_request",
      work_id: workId,
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

  // Fire-and-forget email
  notifyTransferRequest(buyerId, artistName, workTitle, conversationId).catch(console.error);

  return {};
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
    .from("portfolio_images")
    .select("id, caption, is_available, creator_id")
    .eq("id", message.work_id)
    .maybeSingle();

  if (!work) return { error: "Work not found" };
  if (!work.is_available) return { error: "This work has already been transferred" };

  // Update ownership — use admin client because portfolio_images has no UPDATE RLS policy
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Server configuration error — admin client unavailable" };
  }
  const { error: updateError } = await admin
    .from("portfolio_images")
    .update({ current_owner_id: user.id, is_available: false })
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

  // Insert transfer_accepted system message
  const { error: acceptMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: message.conversation_id,
      sender_id: user.id,
      content: "",
      message_type: "transfer_accepted",
      work_id: message.work_id,
    });

  if (acceptMsgError) return { error: acceptMsgError.message };

  // Fetch buyer name for notification
  const { data: buyerData } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const buyerName = buyerData?.full_name ?? buyerData?.username ?? "The buyer";
  const workTitle = work.caption ?? "Untitled";

  // Fire-and-forget email to artist
  notifyTransferAccepted(work.creator_id, buyerName, workTitle).catch(console.error);

  return {};
}
