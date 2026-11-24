"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isSubmittedTooFast } from "@/lib/form-timing";
import { isTorExit, recordBlocked } from "@/lib/bot-guard";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";

/**
 * A community tip about an event, from anyone (signed in or not). Same guards
 * as the opportunity tip: honeypot, timing, Tor, rate limit, Turnstile.
 */
export async function submitEventTip(data: {
  title: string;
  date: string;
  venue: string;
  link: string;
  email: string;
  turnstileToken?: string;
  loadedAt?: number;
  [HONEYPOT_FIELD]?: string;
}): Promise<{ error?: string }> {
  if (data[HONEYPOT_FIELD] || isSubmittedTooFast(data.loadedAt)) return {};

  const title = data.title.trim();
  const venue = data.venue.trim();
  const link = data.link.trim();
  const email = data.email.trim();
  const date = data.date.trim();

  if (!title) return { error: "Tell us what the event is." };
  if (title.length > 200 || venue.length > 200 || link.length > 500 || email.length > 254) {
    return { error: "One of those fields is too long." };
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "That date doesn't look right." };
  if (link) {
    // Stored and later shown as an href in the admin list: web links only.
    try {
      const u = new URL(link);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("scheme");
    } catch {
      return { error: "Please enter a link starting with https://, or leave it blank." };
    }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address, or leave it blank." };
  }

  const ip = await getClientIp();
  if (await isTorExit(ip)) {
    await recordBlocked("form_blocked", { reason: "tor", form: "event_tip" });
    return {};
  }
  if (!(await checkRateLimit(`event-tip:${ip}`, 5, 3600))) {
    return { error: "Too many tips from this network. Please try again later." };
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return { error: "Verification failed. Please refresh and try again." };
  }

  const { error } = await createAdminClient().from("event_tips").insert({
    title,
    event_date: date || null,
    venue: venue || null,
    link: link || null,
    submitter_email: email || null,
  });
  if (error) {
    console.error("event tip insert failed:", error.message);
    return { error: "Couldn't save your tip just now. Please try again." };
  }
  return {};
}
