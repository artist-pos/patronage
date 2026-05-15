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

export interface ShippingAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
}

/**
 * Notify an artist that a buyer has submitted their shipping address.
 */
export async function notifyShippingAddress(
  artistId: string,
  buyerName: string,
  workTitle: string,
  address: ShippingAddress,
  conversationId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: { user: artistUser } } = await admin.auth.admin.getUserById(artistId);
  if (!artistUser?.email) return;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const addrLines = [
    address.line1,
    address.line2,
    `${address.city} ${address.postcode}`.trim(),
    address.country,
  ].filter((s): s is string => !!s).map(esc).join("<br>");

  await getResend().emails.send({
    from: FROM,
    to: artistUser.email,
    subject: `Shipping address from ${buyerName} — ${workTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${esc(buyerName)}</strong> has provided their shipping address for <strong>${esc(workTitle)}</strong>:</p>
      <p style="font-family:monospace;background:#f5f5f5;padding:12px;border-radius:4px;line-height:1.7">${addrLines}</p>
      <p><a href="${SITE_URL}/messages/${conversationId}">View conversation →</a></p>
      <p style="color:#888;font-size:12px">Patronage</p>
    `,
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
 * Sent to every buyer after a successful Stripe payment (primary sale or resale).
 * For shadow/guest accounts includes a claim CTA; for logged-in buyers links
 * straight to the provenance certificate.
 */
export async function sendPurchaseConfirmation({
  toEmail,
  buyerName,
  workTitle,
  artistName,
  workImageUrl,
  provenanceUrl,
  claimToken,
}: {
  toEmail: string;
  buyerName: string | null;
  workTitle: string;
  artistName: string;
  workImageUrl: string | null;
  provenanceUrl: string;
  claimToken: string | null;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const greeting = buyerName ? `Kia ora ${esc(buyerName)},` : "Kia ora,";
  const claimUrl = claimToken ? `${SITE_URL}/claim/${claimToken}` : null;

  const guestSection = claimUrl ? `
      <div style="margin:32px 0;border:1px solid #e5e5e5;padding:20px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Your work is already in your collection.</p>
        <p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.5;">
          Create a free Patronage account and your collection dashboard will show this work — certificate attached, ready to go. Nothing to set up.
        </p>
        <a href="${claimUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
          Claim your account →
        </a>
      </div>` : "";

  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `You now own "${workTitle}" by ${artistName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Certificate of provenance</p>

      <p style="margin:0 0 24px;font-size:15px;">${greeting}</p>

      ${workImageUrl ? `<img src="${workImageUrl}" alt="${esc(workTitle)}" style="width:100%;max-height:280px;object-fit:contain;background:#f9f9f9;display:block;margin:0 0 24px;" />` : ""}

      <p style="margin:0 0 4px;font-size:15px;font-weight:600;">${esc(workTitle)}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#555;">by ${esc(artistName)}</p>

      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;">
        Your certificate of provenance is ready. It records the full ownership history of this work on the Patronage ledger.
      </p>

      <a href="${provenanceUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;margin-bottom:24px;">
        View provenance certificate →
      </a>

      ${guestSection}

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        Questions? <a href="mailto:hello@patronage.nz" style="color:#888;">hello@patronage.nz</a> ·
        <a href="${SITE_URL}" style="color:#888;">patronage.nz</a>
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

/**
 * Notify hello@patronage.nz when a partner submits an opportunity.
 */
export async function notifyOpportunitySubmission(params: {
  title: string;
  organiser: string;
  type: string;
  submitterEmail: string | null;
  isFeatured: boolean;
  isPipeline: boolean;
  adminUrl: string;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { title, organiser, type, submitterEmail, isFeatured, isPipeline, adminUrl } = params;

  const addOns: string[] = [];
  if (isFeatured) addOns.push("Featured placement ($75 NZD)");
  if (isPipeline) addOns.push("Patronage Pipeline");
  const addOnHtml = addOns.length
    ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Add-ons requested:</strong> ${addOns.map(esc).join(", ")}</p>`
    : "";

  const subjectFlag = isFeatured ? " ★ Featured requested" : "";

  await getResend().emails.send({
    from: FROM,
    to: "hello@patronage.nz",
    subject: `New opportunity submission: ${title}${subjectFlag}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">New opportunity submission — review within 2 business days</p>

      <p style="margin:0 0 8px;font-size:15px;"><strong>${esc(title)}</strong></p>
      <p style="margin:0 0 4px;font-size:14px;color:#555;">Organiser: ${esc(organiser)}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">Type: ${esc(type)}</p>
      ${addOnHtml}
      ${submitterEmail ? `<p style="margin:0 0 24px;font-size:14px;color:#555;">Submitted by: ${esc(submitterEmail)}</p>` : ""}

      <a href="${adminUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        Review in admin →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        <a href="${SITE_URL}" style="color:#888;">patronage.nz</a>
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

// ── Campaign notifications ────────────────────────────────────────────────────

/**
 * Notify an artist that they've been selected for a partner campaign.
 * Fired when createCampaignForSelection creates a new campaign row.
 */
export async function sendCampaignSelectedNotification(params: {
  artistEmail: string;
  artistName: string;
  opportunityTitle: string;
  studioUrl: string;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { artistEmail, artistName, opportunityTitle, studioUrl } = params;
  await getResend().emails.send({
    from: FROM,
    to: artistEmail,
    subject: `You've been selected for ${opportunityTitle}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Patronage · Campaign selected</p>
      <p style="margin:0 0 8px;font-size:15px;">Congratulations <strong>${esc(artistName)}</strong>!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">You've been selected for:</p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;">${esc(opportunityTitle)}</blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">Set up your storefront in Studio — choose your hero artwork, add works, and configure pricing. Your QR code is already generated and ready.</p>
      <a href="${studioUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">Set up your storefront →</a>
      <p style="color:#888;font-size:12px;margin:32px 0 0;">You're receiving this because you have an account at <a href="${SITE_URL}" style="color:#888;">Patronage</a>.</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Notify the admin (hello@patronage.nz) when an artist submits or publishes a campaign.
 */
export async function sendCampaignSubmittedToAdmin(params: {
  artistName: string;
  campaignTitle: string;
  reviewUrl: string;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { artistName, campaignTitle, reviewUrl } = params;
  await getResend().emails.send({
    from: FROM,
    to: "hello@patronage.nz",
    subject: `${artistName} has submitted for ${campaignTitle}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Patronage · Campaign submission</p>
      <p style="margin:0 0 16px;font-size:15px;"><strong>${esc(artistName)}</strong> has submitted for <strong>${esc(campaignTitle)}</strong>.</p>
      <a href="${reviewUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">Review in admin →</a>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Notify an artist that their campaign storefront is now live.
 */
export async function sendCampaignLiveNotification(params: {
  artistEmail: string;
  artistName: string;
  campaignTitle: string;
  landingUrl: string;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { artistEmail, artistName, campaignTitle, landingUrl } = params;
  await getResend().emails.send({
    from: FROM,
    to: artistEmail,
    subject: `Your storefront for ${campaignTitle} is now live`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Patronage · Storefront live</p>
      <p style="margin:0 0 8px;font-size:15px;">Hi <strong>${esc(artistName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">Your storefront for <strong>${esc(campaignTitle)}</strong> is now live. Share your QR code or landing page link with visitors.</p>
      <p style="margin:0 0 24px;font-size:13px;font-family:monospace;background:#f5f5f5;padding:10px 14px;word-break:break-all;">${landingUrl}</p>
      <a href="${landingUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">View live storefront →</a>
      <p style="color:#888;font-size:12px;margin:32px 0 0;">You're receiving this because you have an account at <a href="${SITE_URL}" style="color:#888;">Patronage</a>.</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Notify an artist of a new enquiry from their QR landing page.
 */
export async function sendCampaignEnquiryNotification(params: {
  artistEmail: string;
  artistName: string;
  workTitle: string;
  visitorName: string;
  visitorEmail: string;
  message: string;
  campaignTitle: string;
  venueContactEmail?: string | null;
  venueContactName?: string | null;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { artistEmail, artistName, workTitle, visitorName, visitorEmail, message, campaignTitle, venueContactEmail, venueContactName } = params;
  const resend = getResend();

  const bodyHtml = (recipientName: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Patronage · New enquiry via ${esc(campaignTitle)}</p>
      <p style="margin:0 0 8px;font-size:15px;">Hi <strong>${esc(recipientName)}</strong>,</p>
      <p style="margin:0 0 4px;font-size:14px;color:#555;"><strong>${esc(visitorName)}</strong> (${esc(visitorEmail)}) enquired about <strong>${esc(workTitle)}</strong>:</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;white-space:pre-wrap;">${esc(message)}</blockquote>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">Reply directly to this email to respond.</p>
      <p style="color:#888;font-size:12px;margin:32px 0 0;">You're receiving this because you're listed as a contact for this campaign on <a href="${SITE_URL}" style="color:#888;">Patronage</a>.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const sends: Promise<unknown>[] = [
    resend.emails.send({
      from: FROM,
      to: artistEmail,
      replyTo: visitorEmail,
      subject: `New enquiry about ${workTitle} from ${visitorName}`,
      html: bodyHtml(artistName),
    }),
  ];

  if (venueContactEmail) {
    sends.push(
      resend.emails.send({
        from: FROM,
        to: venueContactEmail,
        replyTo: visitorEmail,
        subject: `New enquiry about ${workTitle} from ${visitorName}`,
        html: bodyHtml(venueContactName ?? "there"),
      }),
    );
  }

  await Promise.all(sends);
}

export async function sendOwnershipClaimNotification({
  artistEmail,
  artistName,
  claimerName,
  claimerEmail,
  artworkTitle,
  dashboardUrl,
}: {
  artistEmail: string;
  artistName: string;
  claimerName: string;
  claimerEmail: string;
  artworkTitle: string;
  dashboardUrl: string;
}): Promise<void> {
  const resend = getResend();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  await resend.emails.send({
    from: FROM,
    to: artistEmail,
    subject: `${claimerName} is claiming ownership of "${artworkTitle}"`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px 64px;">
    <tr><td>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
        Kia ora ${esc(artistName)},<br><br>
        <strong>${esc(claimerName)}</strong> (${esc(claimerEmail)}) has submitted an ownership claim for
        <strong>${esc(artworkTitle)}</strong>.<br><br>
        Visit your provenance dashboard to approve or decline this claim.
      </p>
      <a href="${dashboardUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        Review claim →
      </a>
      <div style="border-top:1px solid #e8e8e8;margin-top:40px;padding-top:20px;">
        <p style="margin:0;font-size:11px;color:#aaa;">
          Patronage &middot; <a href="mailto:hello@patronage.nz" style="color:#aaa;text-decoration:none;">hello@patronage.nz</a> &middot; <a href="${SITE_URL}" style="color:#aaa;text-decoration:none;">patronage.nz</a>
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendClaimDeclinedNotification({
  claimerEmail,
  claimerName,
  artworkTitle,
  artistName,
}: {
  claimerEmail: string;
  claimerName: string;
  artworkTitle: string;
  artistName: string;
}): Promise<void> {
  const resend = getResend();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  await resend.emails.send({
    from: FROM,
    to: claimerEmail,
    subject: `Ownership claim update — ${artworkTitle}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px 64px;">
    <tr><td>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
        Kia ora ${esc(claimerName)},<br><br>
        ${esc(artistName)} was unable to verify your ownership claim for
        <strong>${esc(artworkTitle)}</strong>.<br><br>
        If you believe this is an error, please contact the artist directly.
      </p>
      <div style="border-top:1px solid #e8e8e8;margin-top:40px;padding-top:20px;">
        <p style="margin:0;font-size:11px;color:#aaa;">
          Patronage &middot; <a href="mailto:hello@patronage.nz" style="color:#aaa;text-decoration:none;">hello@patronage.nz</a> &middot; <a href="${SITE_URL}" style="color:#aaa;text-decoration:none;">patronage.nz</a>
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendCollectiveInvitation({
  email,
  collectiveName,
  inviterName,
  token,
}: {
  email: string;
  collectiveName: string;
  inviterName: string;
  token: string;
}): Promise<void> {
  const resend = getResend();
  const claimUrl = `${SITE_URL}/join?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${inviterName} invited you to join "${collectiveName}" on Patronage`,
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fff;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 24px;max-width:560px;margin:0 auto;">

      <p style="color:#888;font-size:13px;margin:0 0 32px;">Patronage · Collective Invitation</p>

      <p style="margin:0 0 16px;font-size:15px;">
        <strong>${inviterName}</strong> has invited you to join
        <strong>${collectiveName}</strong> on Patronage — a platform for NZ and Australian artists.
      </p>

      <p style="margin:0 0 24px;font-size:14px;color:#555;">
        Click the link below to accept. If you don't have an account yet, you'll be able to create one first.
      </p>

      <a href="${claimUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        Accept invitation →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        This invitation expires in 30 days. If you weren't expecting this, you can ignore it.
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendArtistAttributionEmail({
  toEmail,
  artistName,
  holderName,
  artworkTitle,
  claimToken,
}: {
  toEmail: string;
  artistName: string;
  holderName: string;
  artworkTitle: string;
  claimToken: string;
}): Promise<void> {
  const resend = getResend();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const claimUrl = `${SITE_URL}/claim/artist/${claimToken}`;

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${holderName} has attributed a work to you on Patronage`,
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fff;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 24px;max-width:560px;margin:0 auto;">

      <p style="color:#888;font-size:13px;margin:0 0 32px;">Patronage · Artist Attribution</p>

      <p style="margin:0 0 16px;font-size:15px;">
        Hi ${esc(artistName)},
      </p>

      <p style="margin:0 0 16px;font-size:15px;">
        <strong>${esc(holderName)}</strong> has added <em>${esc(artworkTitle)}</em> to their collection
        on Patronage and attributed it to you.
      </p>

      <p style="margin:0 0 24px;font-size:14px;color:#555;">
        You can claim this attribution and connect it to your Patronage profile — or simply ignore this
        if you'd prefer not to participate.
      </p>

      <a href="${claimUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">
        View &amp; claim →
      </a>

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        Patronage connects NZ and Australian artists with collectors and opportunities.
        If you weren't expecting this email you can safely ignore it.
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendSaleRevertedBuyer({
  toEmail,
  buyerName,
  workTitle,
  artistName,
  amountFormatted,
}: {
  toEmail: string;
  buyerName: string | null;
  workTitle: string;
  artistName: string;
  amountFormatted: string;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const greeting = buyerName ? `Kia ora ${esc(buyerName)},` : "Kia ora,";
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `Your purchase of "${workTitle}" has been cancelled`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 32px;">Patronage</h1>
      <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        Your purchase of <strong>${esc(workTitle)}</strong> by ${esc(artistName)} has been cancelled by the Patronage team.
        A full refund of <strong>${esc(amountFormatted)}</strong> has been issued to your original payment method.
        Please allow 5–10 business days for it to appear on your statement.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        If you have questions, please reply to this email or contact us at
        <a href="mailto:hello@patronage.nz" style="color:#000;">hello@patronage.nz</a>.
      </p>
      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        <a href="${SITE_URL}" style="color:#888;">patronage.nz</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendSaleRevertedArtist({
  toEmail,
  artistName,
  workTitle,
}: {
  toEmail: string;
  artistName: string;
  workTitle: string;
}): Promise<void> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `Sale of "${workTitle}" has been cancelled`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 32px;">Patronage</h1>
      <p style="margin:0 0 16px;font-size:15px;">Kia ora ${esc(artistName)},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        The sale of <strong>${esc(workTitle)}</strong> has been cancelled by the Patronage team and the work has been returned to your available listings.
        The buyer has been fully refunded.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        If you have questions, please contact us at
        <a href="mailto:hello@patronage.nz" style="color:#000;">hello@patronage.nz</a>.
      </p>
      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        <a href="${SITE_URL}" style="color:#888;">patronage.nz</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

