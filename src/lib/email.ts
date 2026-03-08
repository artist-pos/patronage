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

  // Role-conditional: only notify if receiver is an artist, or patron initiated the thread
  const [{ data: receiverProfile }, { data: firstMsg }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", recipientId).single(),
    admin
      .from("messages")
      .select("sender_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),
  ]);

  const patronInitiated = firstMsg?.sender_id !== senderId;
  if (receiverProfile?.role !== "artist" && !patronInitiated) return;

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

/**
 * Send application confirmation to artist.
 */
export async function sendApplicationConfirmation(
  artistEmail: string,
  artistName: string,
  opportunityTitle: string,
  partnerName: string,
  dashboardUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: artistEmail,
    subject: `Application Received: ${opportunityTitle}`,
    html: buildApplicationConfirmationHtml({ artistName, opportunityTitle, partnerName, dashboardUrl }),
  });
}

/**
 * Notify artist that their high-res upload is needed (approved_pending_assets).
 */
export async function sendHighResRequest(
  artistEmail: string,
  artistName: string,
  opportunityTitle: string,
  dashboardUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: artistEmail,
    subject: `Action Required: Upload your high-res file for ${opportunityTitle}`,
    html: buildHighResRequestHtml({ artistName, opportunityTitle, dashboardUrl }),
  });
}

/**
 * Notify a buyer that an artist has offered them an artwork via transfer request.
 */
export async function notifyTransferRequest(
  buyerId: string,
  artistName: string,
  workTitle: string,
  conversationId: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: { user: buyerUser } } = await admin.auth.admin.getUserById(buyerId);
  if (!buyerUser?.email) return;

  await getResend().emails.send({
    from: FROM,
    to: buyerUser.email,
    subject: `${artistName} has offered you an artwork`,
    html: buildTransferRequestHtml({ artistName, workTitle, conversationUrl: `${SITE_URL}/messages/${conversationId}` }),
  });
}

/**
 * Notify an artist that their transfer offer was accepted.
 */
export async function notifyTransferAccepted(
  artistId: string,
  buyerName: string,
  workTitle: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: { user: artistUser } } = await admin.auth.admin.getUserById(artistId);
  if (!artistUser?.email) return;

  await getResend().emails.send({
    from: FROM,
    to: artistUser.email,
    subject: `${buyerName} accepted your transfer of ${workTitle}`,
    html: buildTransferAcceptedHtml({ buyerName, workTitle, messagesUrl: `${SITE_URL}/messages` }),
  });
}

/**
 * Invite a non-account patron to join Patronage and claim an artwork.
 */
export async function sendProvenanceInvite(
  toEmail: string,
  artistName: string,
  workTitle: string,
  claimUrl: string
): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `${artistName} has added your artwork to Patronage`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">You've been added to the provenance record</p>

      <p style="margin:0 0 8px;font-size:15px;"><strong>${esc(artistName)}</strong> has recorded your artwork in their provenance history:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">
        ${esc(workTitle)}
      </blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">Create a free Patronage account to confirm this work is in your collection and have it displayed on your profile.</p>

      <a href="${claimUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        Claim this artwork →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        If you don't recognise this, you can safely ignore this email.
        Patronage is a platform for NZ and Australian artists — <a href="${SITE_URL}" style="color:#888;">patronage.nz</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Notify an existing patron that an artist has linked an artwork to their collection.
 */
export async function sendProvenanceNotification(
  patronId: string,
  artistName: string,
  workTitle: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.admin.getUserById(patronId);
  if (!user?.email) return;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await getResend().emails.send({
    from: FROM,
    to: user.email,
    subject: `${artistName} linked an artwork to your collection`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Collection verification request</p>

      <p style="margin:0 0 8px;font-size:15px;"><strong>${esc(artistName)}</strong> has linked the following artwork to your collection:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">
        ${esc(workTitle)}
      </blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">Visit your dashboard to verify or decline this provenance link.</p>

      <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View in dashboard →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        You're receiving this because you have an account at <a href="${SITE_URL}" style="color:#888;">Patronage</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

function buildTransferRequestHtml({
  artistName,
  workTitle,
  conversationUrl,
}: {
  artistName: string;
  workTitle: string;
  conversationUrl: string;
}): string {
  const escapedTitle = workTitle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const escapedArtist = artistName
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
      <p style="color:#888;font-size:13px;margin:0 0 32px;">You have received an artwork offer</p>

      <p style="margin:0 0 8px;font-size:15px;"><strong>${escapedArtist}</strong> has offered you:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">
        ${escapedTitle}
      </blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">Open the conversation to accept or discuss the transfer.</p>

      <a href="${conversationUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View offer →
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

function buildTransferAcceptedHtml({
  buyerName,
  workTitle,
  messagesUrl,
}: {
  buyerName: string;
  workTitle: string;
  messagesUrl: string;
}): string {
  const escapedTitle = workTitle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const escapedBuyer = buyerName
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
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Transfer confirmed</p>

      <p style="margin:0 0 8px;font-size:15px;"><strong>${escapedBuyer}</strong> has accepted your transfer of:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">
        ${escapedTitle}
      </blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">The work is now listed in their collection.</p>

      <a href="${messagesUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View messages →
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

function buildApplicationConfirmationHtml({
  artistName,
  opportunityTitle,
  partnerName,
  dashboardUrl,
}: {
  artistName: string;
  opportunityTitle: string;
  partnerName: string;
  dashboardUrl: string;
}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Application received</p>

      <p style="margin:0 0 8px;font-size:15px;">Hi <strong>${esc(artistName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">Your application has been received by <strong>${esc(partnerName)}</strong> for:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">
        ${esc(opportunityTitle)}
      </blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">We&apos;ll let you know when the status of your application changes.</p>

      <a href="${dashboardUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View in dashboard →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        You're receiving this because you applied via <a href="${SITE_URL}" style="color:#888;">Patronage</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildHighResRequestHtml({
  artistName,
  opportunityTitle,
  dashboardUrl,
}: {
  artistName: string;
  opportunityTitle: string;
  dashboardUrl: string;
}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Action required</p>

      <p style="margin:0 0 8px;font-size:15px;">Congratulations <strong>${esc(artistName)}</strong>!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">Your application for <strong>${esc(opportunityTitle)}</strong> has been approved. Please upload your high-resolution file to complete the process.</p>

      <a href="${dashboardUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        Upload high-res file →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        You're receiving this because you applied via <a href="${SITE_URL}" style="color:#888;">Patronage</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
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
