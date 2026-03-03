import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

/**
 * Send a "you have a new message" email to the recipient of a DM.
 * Only fires on the first unread message from the sender (spam guard).
 * Uses admin client to bypass RLS and read auth.users emails.
 */
export async function notifyMessageRecipient(
  conversationId: string,
  senderId: string
): Promise<void> {
  const admin = createAdminClient();

  // Resolve recipient from conversation
  const { data: conv } = await admin
    .from("conversations")
    .select("participant_a, participant_b")
    .eq("id", conversationId)
    .single();

  if (!conv) return;

  const recipientId =
    conv.participant_a === senderId ? conv.participant_b : conv.participant_a;

  // Spam guard: only notify on the first unread message from this sender
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", senderId)
    .eq("is_read", false);

  if (count !== 1) return;

  // Get recipient email
  const { data: { user: recipientUser } } = await admin.auth.admin.getUserById(recipientId);
  if (!recipientUser?.email) return;

  // Get sender display name
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", senderId)
    .single();

  const senderName =
    senderProfile?.full_name ?? senderProfile?.username ?? "Someone";

  // Get message preview (the message we just inserted — most recent)
  const { data: msg } = await admin
    .from("messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const preview = msg?.content ?? "";

  await getResend().emails.send({
    from: FROM,
    to: recipientUser.email,
    subject: `New message from ${senderName} on Patronage`,
    html: buildMessageNotificationHtml({
      senderName,
      preview,
      messagesUrl: `${SITE_URL}/messages`,
    }),
  });
}

function buildMessageNotificationHtml({
  senderName,
  preview,
  messagesUrl,
}: {
  senderName: string;
  preview: string;
  messagesUrl: string;
}): string {
  const escaped = preview
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">You have a new message</p>

      <p style="margin:0 0 8px;font-size:15px;"><strong>${senderName}</strong> sent you a message:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">
        ${escaped}
      </blockquote>

      <a href="${messagesUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View message →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        You're receiving this because you have an account at
        <a href="${SITE_URL}" style="color:#888;">Patronage</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
