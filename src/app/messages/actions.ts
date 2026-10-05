"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyMessageRecipient } from "@/lib/email";

/**
 * Checks whether an artist/owner has a messaging relationship with another user.
 * Returns true if any of:
 * 1. The other user follows the artist
 * 2. The artist has applied to an opportunity owned by the other user
 * 3. The artist has saved an opportunity owned by the other user
 */
async function hasMessagingRelationship(
  supabase: Awaited<ReturnType<typeof createClient>>,
  artistId: string,
  otherUserId: string
): Promise<boolean> {
  // 1. Follower check (original rule)
  const followPromise = supabase
    .from("follows")
    .select("id")
    .eq("follower_id", otherUserId)
    .eq("following_id", artistId)
    .maybeSingle();

  // 2. Applied-to check: artist applied to an opportunity owned by the other user
  //    opportunities.profile_id = otherUserId AND opportunity_applications.artist_id = artistId
  const appliedPromise = supabase
    .from("opportunity_applications")
    .select("id, opportunities!inner(profile_id)")
    .eq("artist_id", artistId)
    .eq("opportunities.profile_id", otherUserId)
    .limit(1)
    .maybeSingle();

  // 3. Saved check: artist saved an opportunity owned by the other user
  const savedPromise = supabase
    .from("saved_opportunities")
    .select("id, opportunities!inner(profile_id)")
    .eq("user_id", artistId)
    .eq("opportunities.profile_id", otherUserId)
    .limit(1)
    .maybeSingle();

  const [followRes, appliedRes, savedRes] = await Promise.all([
    followPromise,
    appliedPromise,
    savedPromise,
  ]);

  return !!(followRes.data || appliedRes.data || savedRes.data);
}

/**
 * Server action to check if the current user (artist/owner) can initiate a
 * conversation with the given user. Non-artist roles can always initiate.
 */
export async function checkCanInitiateConversation(
  otherUserId: string
): Promise<{ canInitiate: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { canInitiate: false };
  if (user.id === otherUserId) return { canInitiate: false };

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (senderProfile?.role !== "artist" && senderProfile?.role !== "owner") {
    return { canInitiate: true };
  }

  const allowed = await hasMessagingRelationship(supabase, user.id, otherUserId);
  return { canInitiate: allowed };
}

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
    const allowed = await hasMessagingRelationship(supabase, user.id, otherUserId);
    if (!allowed) return { error: "not_following" };
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
  "Works can be purchased securely through Patronage — use the Buy button on the artist’s profile to pay via Stripe and receive a verified certificate of authenticity. " +
  "If you arrange a sale outside the platform, that transaction is solely between you and the seller. Patronage does not guarantee or take responsibility for off-platform arrangements.";

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
    .select("id, source_work_id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (existing) {
    // Stamp source_work_id if this enquiry is about a specific work and
    // the conversation doesn't already have one.
    if (workId && !existing.source_work_id) {
      await supabase
        .from("conversations")
        .update({ source_work_id: workId })
        .eq("id", existing.id);
    }
    return { id: existing.id };
  }

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

  // The purchase disclaimer only makes sense when the recipient sells works.
  // Partners and patrons get a plain thread.
  const { data: recipient } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", otherUserId)
    .maybeSingle();
  if (recipient?.role === "artist" || recipient?.role === "owner") {
    await supabase.from("messages").insert({
      conversation_id: created.id,
      sender_id: user.id,
      content: INQUIRY_DISCLAIMER,
      is_system_message: true,
      source_action: sourceAction,
      message_type: "text",
    });
  }

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
  }).select("id, conversation_id, sender_id, content, is_read, message_type, work_id, is_system_message, source_action, metadata, created_at").single();

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
