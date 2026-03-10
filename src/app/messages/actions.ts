"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyMessageRecipient } from "@/lib/email";

export async function getOrCreateConversation(
  otherUserId: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };
  if (user.id === otherUserId) return { error: "cannot_message_self" };

  // Artists may only message users who follow them
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (senderProfile?.role === "artist" || senderProfile?.role === "owner") {
    const { data: followRow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", otherUserId)
      .eq("following_id", user.id)
      .maybeSingle();

    if (!followRow) return { error: "not_following" };
  }

  // Always order UUIDs so participant_a < participant_b (unique pair constraint)
  const [a, b] = [user.id, otherUserId].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (existing) return { id: existing.id };

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ participant_a: a, participant_b: b })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Failed to create conversation" };
  return { id: created.id };
}

const INQUIRY_DISCLAIMER =
  "Payments, shipping, and all off-platform arrangements are solely between the buyer and seller. " +
  "Patronage does not facilitate, guarantee, or take responsibility for any transaction made outside of this platform. " +
  "Please exercise caution and verify all details before proceeding.";

/**
 * Starts or opens an enquiry thread.
 * - Bypasses the follower restriction (the act of enquiring is itself the handshake).
 * - On first contact only: inserts a pinned system disclaimer about off-platform arrangements.
 * - Records source_action so the artist knows what triggered the message.
 */
export async function initializeInquiryThread(
  otherUserId: string,
  sourceAction: "profile_enquiry" | "artwork_enquiry" | "artwork_offer",
  workId?: string | null
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };
  if (user.id === otherUserId) return { error: "cannot_message_self" };

  // Always order UUIDs so participant_a < participant_b
  const [a, b] = [user.id, otherUserId].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (existing) return { id: existing.id };

  // New thread — create with enquiry metadata
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      participant_a: a,
      participant_b: b,
      initiated_via_enquiry: true,
      source_action: sourceAction,
      source_work_id: workId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Failed to create conversation" };

  // Insert pinned system disclaimer
  await supabase.from("messages").insert({
    conversation_id: created.id,
    sender_id: user.id,
    content: INQUIRY_DISCLAIMER,
    is_system_message: true,
    source_action: sourceAction,
    message_type: "text",
  });

  return { id: created.id };
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ message?: import("@/types/database").Message; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > 10000) return { error: "Message must be between 1 and 10,000 characters." };

  const { data: msg, error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: trimmed,
  }).select("id, conversation_id, sender_id, content, is_read, message_type, work_id, is_system_message, source_action, created_at").single();

  if (error || !msg) return { error: error?.message ?? "Failed to send" };

  // Fire-and-forget: email notification for recipient (failure must not fail the send)
  try {
    await notifyMessageRecipient(conversationId, user.id);
  } catch {
    // swallow — email is best-effort
  }

  return { message: msg as import("@/types/database").Message };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);
}
