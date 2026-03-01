import { createClient } from "@/lib/supabase/server";

export interface ProfileStats {
  views: number;
  cvClicks: number;
  websiteClicks: number;
  bibClicks: number;
  messagesReceived: number;
}

export async function getProfileStats(profileId: string): Promise<ProfileStats> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: events }, { data: convos }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("event_type")
      .in("event_type", ["profile_view", "cv_click", "website_click", "bib_click"])
      .contains("payload", { profile_id: profileId }) // JSONB containment filter
      .gte("created_at", since),
    supabase
      .from("conversations")
      .select("id")
      .or(`participant_a.eq.${profileId},participant_b.eq.${profileId}`),
  ]);

  const allEvents = events ?? [];

  let messagesReceived = 0;
  const convoIds = (convos ?? []).map((c) => c.id);
  if (convoIds.length > 0) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convoIds)
      .neq("sender_id", profileId)
      .gte("created_at", since);
    messagesReceived = count ?? 0;
  }

  return {
    views: allEvents.filter((e) => e.event_type === "profile_view").length,
    cvClicks: allEvents.filter((e) => e.event_type === "cv_click").length,
    websiteClicks: allEvents.filter((e) => e.event_type === "website_click").length,
    bibClicks: allEvents.filter((e) => e.event_type === "bib_click").length,
    messagesReceived,
  };
}
