import { NextResponse } from "next/server";
import Papa from "papaparse";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient()
    .from("rabobank_survey_response")
    .select("*")
    .order("created_at", { ascending: true });

  const csv = Papa.unparse(
    (data ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      first_name: r.first_name ?? "",
      art_relation: r.art_relation ?? "",
      art_relation_note: r.art_relation_note ?? "",
      story_together: r.story_together ?? "",
      story_place: r.story_place ?? "",
      story_cooperation: r.story_cooperation ?? "",
      local_artist: r.local_artist ?? "",
      room_uses: (r.room_uses ?? []).join("; "),
      room_scene: r.room_scene ?? "",
      room_wants: (r.room_wants ?? []).join("; "),
      feels_wrong: r.feels_wrong ?? "",
      memorable_artwork: r.memorable_artwork ?? "",
      v1_q1_day_to_day_use: r.q1 ?? "",
      v1_q2_feeling: [...(r.q2 ?? []), r.q2_other ?? ""].filter(Boolean).join("; "),
      v1_q3_subjects: r.q3 ?? "",
      v1_q4_avoid: r.q4 ?? "",
      completion_seconds: r.completion_seconds ?? "",
    }))
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rabobank-survey.csv"',
      "Cache-Control": "no-store",
    },
  });
}
