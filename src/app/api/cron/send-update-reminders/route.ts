import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PipelineConfig } from "@/types/database";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const results = { processed: 0, reminded: 0, errors: [] as string[] };

  // Fetch all active selected applications, joined to opportunity for pipeline_config + partner profile
  const { data: apps, error: appsError } = await admin
    .from("opportunity_applications")
    .select("id, artist_id, opportunity_id, selected_at, last_reminder_sent_at, opportunity:opportunities(title, profile_id, pipeline_config)")
    .in("status", ["selected", "approved_pending_assets", "production_ready"]);

  if (appsError) {
    return NextResponse.json({ error: appsError.message }, { status: 500 });
  }

  for (const app of apps ?? []) {
    results.processed++;

    const opp = (app.opportunity as unknown) as {
      title: string;
      profile_id: string | null;
      pipeline_config: PipelineConfig | null;
    } | null;

    if (!opp?.profile_id) continue;

    const postSel = opp.pipeline_config?.post_selection;
    if (!postSel?.requires_studio_updates || !postSel.update_frequency_days) continue;

    // Compute when the next reminder is due
    const baseDate = app.last_reminder_sent_at ?? app.selected_at;
    if (!baseDate) continue;

    const nextDue = new Date(baseDate);
    nextDue.setDate(nextDue.getDate() + postSel.update_frequency_days);

    if (nextDue > now) continue;

    // Find or create a conversation between partner and artist
    const [a, b] = [opp.profile_id, app.artist_id].sort();

    const { data: existing } = await admin
      .from("conversations")
      .select("id")
      .eq("participant_a", a)
      .eq("participant_b", b)
      .maybeSingle();

    let conversationId: string;

    if (existing) {
      conversationId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin
        .from("conversations")
        .insert({ participant_a: a, participant_b: b })
        .select("id")
        .single();

      if (createErr || !created) {
        results.errors.push(`Create conversation for app ${app.id}: ${createErr?.message}`);
        continue;
      }
      conversationId = created.id;
    }

    // Insert reminder message as partner (sender = opportunity.profile_id)
    const { error: msgErr } = await admin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: opp.profile_id,
        content: `Hi — just a reminder to post a project update for "${opp.title}". No pressure, just keeping the thread alive.`,
        message_type: "text",
        is_read: false,
      });

    if (msgErr) {
      results.errors.push(`Send message for app ${app.id}: ${msgErr.message}`);
      continue;
    }

    // Update last_reminder_sent_at
    await admin
      .from("opportunity_applications")
      .update({ last_reminder_sent_at: now.toISOString() })
      .eq("id", app.id);

    results.reminded++;
  }

  return NextResponse.json(results);
}
