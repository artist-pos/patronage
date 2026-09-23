"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sourceKeyForUrl } from "@/lib/opportunity-sources";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isSubmittedTooFast } from "@/lib/form-timing";
import { isTorExit, recordBlocked } from "@/lib/bot-guard";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";

const MAX_NAME = 200;
const MAX_LINK = 500;
const MAX_EMAIL = 254;

export async function submitOpportunityTip(data: {
  name: string;
  sourceLink: string;
  email: string;
  turnstileToken?: string;
  loadedAt?: number;
  [HONEYPOT_FIELD]?: string;
}): Promise<{ error?: string }> {
  // Bots that blindly fill every field trip the honeypot — pretend success
  // so they don't retry with a cleaner payload. Same treatment for a
  // submission that arrived faster than a human could fill the form.
  if (data[HONEYPOT_FIELD] || isSubmittedTooFast(data.loadedAt)) return {};

  const name = data.name.trim();
  const sourceLink = data.sourceLink.trim();
  const email = data.email.trim();

  if (!name || !sourceLink) {
    return { error: "Opportunity name and source link are required." };
  }
  if (name.length > MAX_NAME || sourceLink.length > MAX_LINK || email.length > MAX_EMAIL) {
    return { error: "One of those fields is too long." };
  }
  // The link is stored and later rendered as an href in the admin queue, so
  // only accept real web URLs (no javascript:/data: schemes).
  let parsed: URL;
  try {
    parsed = new URL(sourceLink);
  } catch {
    return { error: "Please enter a valid link starting with https://" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Please enter a valid link starting with https://" };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address, or leave it blank." };
  }

  const ip = await getClientIp();
  if (await isTorExit(ip)) {
    await recordBlocked("form_blocked", { reason: "tor", form: "opportunity_tip" });
    return {};
  }
  if (!(await checkRateLimit(`opportunity-tip:${ip}`, 5, 3600))) {
    return { error: "Too many tips from this network. Please try again later." };
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return { error: "Verification failed. Please refresh and try again." };
  }

  const supabase = createAdminClient();

  // The tip's source link is by definition where the tipper saw it, so tag the
  // board when we recognise the domain. An admin can correct it in the queue.
  const sourceKey = sourceKeyForUrl(sourceLink);

  // Migration 064 merged opportunity_submissions into opportunities. Submissions
  // are now opportunities rows with status='pending' and is_active=false.
  const { error } = await supabase.from("opportunities").insert({
    title: name,
    organiser: "Community Tip",
    url: sourceLink,
    source: sourceKey,
    source_url: sourceKey ? sourceLink : null,
    submitter_email: email || null,
    type: "Grant",
    country: "NZ",
    routing_type: "external",
    custom_fields: [],
    show_badges_in_submission: false,
    status: "pending",
    is_active: false,
  });

  if (error) {
    console.error("opportunity tip insert failed:", error.message);
    return { error: "Couldn't save your tip just now. Please try again." };
  }
  return {};
}
