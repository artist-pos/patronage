"use client";

import posthog from "posthog-js";
import { trackEvent as persistEvent } from "@/actions/trackEvent";

/**
 * Record a product event in both stores.
 *
 * PostHog gets it for funnels, retention and cohorts. The Supabase
 * `analytics_events` table keeps it for the counts we show back to artists and
 * partners. These events already existed, they just never reached PostHog,
 * which is why every funnel there had to be built out of raw pageviews.
 *
 * Drop-in for the old server action: same name, same signature, never rejects.
 */
export async function trackEvent(
  eventType: string,
  payload: Record<string, string> = {}
): Promise<void> {
  try {
    posthog.capture(eventType, payload);
  } catch {
    // Blocked by an extension, or PostHog failed to init. Not worth surfacing.
  }
  try {
    await persistEvent(eventType, payload);
  } catch {
    // Analytics must never block or break the UI action it describes.
  }
}
