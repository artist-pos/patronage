import { createAdminClient } from "@/lib/supabase/admin";

export interface TagNotificationPayload {
  type: "blog_post";
  title: string;
  url: string;
  image_url: string | null;
}

export async function sendTagNotificationDM(
  senderUserId: string,
  recipientUserId: string,
  payload: TagNotificationPayload
): Promise<{ error?: string }> {
  if (senderUserId === recipientUserId) return {};

  const admin = createAdminClient();

  // Canonical ordering: participant_a < participant_b (unique pair constraint)
  const [a, b] = [senderUserId, recipientUserId].sort();

  const { data: existing, error: convSelectError } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (convSelectError) {
    console.error("[autoDM] conversation lookup failed:", convSelectError.message);
    return { error: `autoDM conversation lookup: ${convSelectError.message}` };
  }

  let conversationId: string;

  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error: convInsertError } = await admin
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();

    if (convInsertError || !created) {
      console.error("[autoDM] conversation insert failed:", convInsertError?.message);
      return { error: `autoDM conversation insert: ${convInsertError?.message}` };
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
    console.error("[autoDM] message insert failed:", msgError.message);
    return { error: `autoDM message insert: ${msgError.message}` };
  }

  return {};
}
