"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isEventPast } from "@/lib/events";
import type { ExhibitionEntry } from "@/types/database";

/**
 * The after-the-date question on an artist's own event (227): add it to their
 * exhibitions as a solo or group show, or leave it. Solo and Group write one
 * CV line from what the event already says. Asked once either way.
 */
export async function answerEventRecord(
  updateId: string,
  choice: "Solo" | "Group" | "dismiss",
): Promise<{ error?: string; entry?: ExhibitionEntry }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: update } = await supabase
    .from("project_updates")
    .select("id, artist_id, title, caption, text_content, event_date, event_venue, event_cv_status, regions:event_region_id (name)")
    .eq("id", updateId)
    .eq("artist_id", user.id)
    .maybeSingle();
  if (!update?.event_date) return { error: "That event couldn't be found." };
  if (!isEventPast(update.event_date)) return { error: "You can add it once the event has happened." };
  if (update.event_cv_status) return {};

  let entry: ExhibitionEntry | undefined;
  if (choice !== "dismiss") {
    const firstLine = (update.title ?? update.caption ?? update.text_content ?? "").split("\n")[0];
    // "Harbour, early: opening night" → "Harbour, early"
    const title = firstLine.split(/:\s| — | - /)[0].trim().slice(0, 140) || "Untitled";
    const region = (update.regions as { name?: string } | null)?.name ?? "";
    entry = {
      type: choice,
      title,
      venue: update.event_venue ?? "",
      location: region,
      year: Number(update.event_date.slice(0, 4)),
    };
    const { data: profile } = await supabase
      .from("profiles")
      .select("exhibition_history")
      .eq("id", user.id)
      .single();
    const history = ((profile?.exhibition_history ?? []) as ExhibitionEntry[]).filter(Boolean);
    const { error } = await supabase
      .from("profiles")
      .update({ exhibition_history: [entry, ...history] })
      .eq("id", user.id);
    if (error) return { error: "We couldn't add it to your exhibitions. Try again." };
  }

  const { error } = await supabase
    .from("project_updates")
    .update({ event_cv_status: choice === "dismiss" ? "dismissed" : "added" })
    .eq("id", updateId)
    .eq("artist_id", user.id);
  if (error) return { error: "We couldn't save that. Try again." };

  revalidatePath("/feed");
  revalidatePath(`/projects/${updateId}`);
  return { entry };
}
