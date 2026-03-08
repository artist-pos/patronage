"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Soft-hide an artwork from the artist's own sold/collected works view.
 * The artwork remains in the patron's collection display.
 */
export async function removeFromArtistProfile(
  artworkId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: artwork } = await supabase
    .from("artworks")
    .select("creator_id, profile_id")
    .eq("id", artworkId)
    .single();

  if (!artwork || artwork.creator_id !== user.id) {
    return { error: "Not authorised." };
  }

  const { error } = await supabase
    .from("artworks")
    .update({ hidden_from_artist: true })
    .eq("id", artworkId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile) revalidatePath(`/${profile.username}`);
  return {};
}

/**
 * Send a deletion_request message to the current owner of the artwork.
 * Finds or creates a conversation between artist and patron.
 * Returns the conversationId so the artist can be redirected to the chat.
 */
export async function requestArtworkDeletion(
  artworkId: string
): Promise<{ conversationId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: artwork } = await supabase
    .from("artworks")
    .select("id, creator_id, current_owner_id, caption, is_available")
    .eq("id", artworkId)
    .single();

  if (!artwork) return { error: "Artwork not found." };
  if (artwork.creator_id !== user.id) return { error: "Not authorised." };

  const ownerId = artwork.current_owner_id;
  if (!ownerId || ownerId === user.id) {
    // Artist owns it themselves — delete directly
    const { error } = await admin.from("artworks").delete().eq("id", artworkId);
    if (error) return { error: error.message };
    const { data: profile } = await supabase
      .from("profiles").select("username").eq("id", user.id).single();
    if (profile) revalidatePath(`/${profile.username}`);
    return {};
  }

  // Find or create conversation between artist and patron (bypass follower restriction)
  const [a, b] = [user.id, ownerId].sort();
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  let conversationId: string;
  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error: convErr } = await admin
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();
    if (convErr || !created) return { error: convErr?.message ?? "Failed to create conversation." };
    conversationId = created.id;
  }

  // Insert deletion_request message
  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: "",
    message_type: "deletion_request",
    work_id: artworkId,
  });

  if (msgErr) return { error: msgErr.message };

  return { conversationId };
}

/**
 * Patron approves deletion — artwork is permanently deleted.
 */
export async function approveDeletionRequest(
  messageId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: message } = await supabase
    .from("messages")
    .select("id, sender_id, work_id, message_type, conversation_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!message) return { error: "Message not found." };
  if (message.message_type !== "deletion_request") return { error: "Not a deletion request." };
  if (message.sender_id === user.id) return { error: "You cannot approve your own request." };
  if (!message.work_id) return { error: "No artwork associated with this request." };

  // Verify the work still exists and caller is the current owner
  const { data: artwork } = await admin
    .from("artworks")
    .select("id, caption, current_owner_id, creator_id")
    .eq("id", message.work_id)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found or already deleted." };
  if (artwork.current_owner_id !== user.id) return { error: "Not authorised." };

  // Delete artwork — messages.work_id cascades to null
  const { error: delErr } = await admin.from("artworks").delete().eq("id", message.work_id);
  if (delErr) return { error: delErr.message };

  // Send deletion_accepted message
  await supabase.from("messages").insert({
    conversation_id: message.conversation_id,
    sender_id: user.id,
    content: "",
    message_type: "deletion_accepted",
    work_id: null,
  });

  return {};
}
