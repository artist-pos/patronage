import { createAdminClient } from "@/lib/supabase/admin";

export interface TagNotificationPayload {
  type: "blog_post";
  title: string;
  url: string;
  image_url: string | null;
}

/**
 * Send an automated DM notifying a user they were featured in content.
 * Uses the admin client to bypass RLS and the follower restriction.
 * Fire-and-forget — callers should .catch(console.error).
 */
export async function sendTagNotificationDM(
  senderUserId: string,
  recipientUserId: string,
  payload: TagNotificationPayload
): Promise<void> {
  if (senderUserId === recipientUserId) return;

  const admin = createAdminClient();

  // Canonical ordering: participant_a < participant_b (unique pair constraint)
  const [a, b] = [senderUserId, recipientUserId].sort();

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
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();

    if (error || !created) {
      console.error("[autoDM] Failed to create conversation:", error?.message);
      return;
    }
    conversationId = created.id;
  }

  const content =
    payload.type === "blog_post"
      ? `Blog post: "${payload.title}"`
      : `Tagged in content on Patronage.`;

  const { error: msgError } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderUserId,
    content,
    message_type: "tag_notification",
    metadata: payload,
    is_system_message: false,
  });

  if (msgError) {
    console.error("[autoDM] Failed to insert tag notification:", msgError.message);
  }
}
