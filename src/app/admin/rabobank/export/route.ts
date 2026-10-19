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
      q1_day_to_day_use: r.q1 ?? "",
      q2_feeling: (r.q2 ?? []).join("; "),
      q2_other: r.q2_other ?? "",
      q3_subjects: r.q3 ?? "",
      q4_avoid: r.q4 ?? "",
      q5_see_shortlist: r.q5 === null ? "" : r.q5 ? "Yes" : "No",
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
