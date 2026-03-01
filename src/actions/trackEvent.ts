"use server";

import { createClient } from "@/lib/supabase/server";

export async function trackEvent(
  eventType: string,
  payload: Record<string, string>
) {
  const supabase = await createClient();
  await supabase.from("analytics_events").insert({ event_type: eventType, payload });
}
