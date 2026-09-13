import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { captureServerEvent } from "@/lib/posthog-server";

/**
 * Resend event webhook.
 *
 * Turns delivery events into PostHog events so the digest can be measured the
 * same way the on-site loops are. Opens and clicks only arrive if open and
 * click tracking are switched on for the sending domain in the Resend
 * dashboard — the endpoint is correct either way, but it will stay quiet until
 * that is enabled.
 *
 * Signature verification follows the Svix scheme Resend uses. Verifying by hand
 * rather than adding the svix package: it is one HMAC, and the payload is small.
 */

function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string
): boolean {
  // Secrets are issued as "whsec_<base64>"; the raw key is the base64 part.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // The header carries one or more space-separated "v1,<sig>" pairs so keys can
  // be rotated. Any match is a pass.
  for (const part of signatureHeader.split(" ")) {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) continue;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Resend replays events; a stale timestamp means a replay attack, not a retry. */
const TOLERANCE_SECONDS = 5 * 60;

interface ResendEvent {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
    click?: { link?: string };
  };
}

/** Our digest sends carry a "type: digest" tag; everything else is ignored. */
function isDigest(data: ResendEvent["data"]): boolean {
  const tags = data?.tags;
  if (Array.isArray(tags)) return tags.some((t) => t.name === "type" && t.value === "digest");
  if (tags && typeof tags === "object") return tags.type === "digest";
  // Older sends predate tagging — fall back to the subject line we control.
  return /opportunit(y|ies) worth knowing about/i.test(data?.subject ?? "");
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("RESEND_WEBHOOK_SECRET not configured", { status: 500 });
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return new NextResponse("Missing signature headers", { status: 400 });
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return new NextResponse("Timestamp outside tolerance", { status: 400 });
  }

  // Raw body — re-serialising JSON would change the bytes and break the HMAC.
  const body = await req.text();
  if (!verifySignature(secret, id, timestamp, body, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return new NextResponse("Malformed JSON", { status: 400 });
  }

  const recipient = event.data?.to?.[0];
  if (!recipient || !isDigest(event.data)) {
    // Acknowledge: a 4xx here would have Resend retry an event we do not want.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // The recipient address is the only identifier an email event carries. It
  // will not merge with the browser distinct_id on its own — alias them in
  // PostHog if open-to-signup attribution is ever needed.
  const eventName =
    event.type === "email.opened"
      ? "digest_email_open"
      : event.type === "email.clicked"
        ? "digest_email_click"
        : null;

  if (!eventName) return NextResponse.json({ ok: true, ignored: true });

  await captureServerEvent(eventName, recipient, {
    email_id: event.data?.email_id,
    subject: event.data?.subject,
    ...(event.type === "email.clicked" && { link: event.data?.click?.link }),
  });

  return NextResponse.json({ ok: true });
}
