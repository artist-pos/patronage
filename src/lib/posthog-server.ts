const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * Server-side PostHog capture.
 *
 * A plain fetch to the capture endpoint rather than posthog-node: the only
 * server events we send are email webhooks, which arrive one at a time and do
 * not need the batching, retry queue or shutdown handling a client brings with
 * it. Never throws — analytics must not fail a webhook and make Resend retry.
 */
export async function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  if (!POSTHOG_KEY) return;

  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          // Marks the event as arriving from our backend rather than a browser,
          // so it is easy to exclude from web-session analysis.
          $lib: "patronage-server",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Network hiccup reaching PostHog. The email event itself already happened;
    // losing the analytics copy is not worth a 500 back to the provider.
  }
}
