import { NextResponse } from "next/server";
import Papa from "papaparse";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { REACTIONS } from "@/lib/rabobank/shortlist";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  const [{ data: reactions }, { data: artists }] = await Promise.all([
    admin.from("rabobank_reaction").select("*").order("created_at", { ascending: true }),
    admin.from("rabobank_artist").select("id, name"),
  ]);
  const name = Object.fromEntries((artists ?? []).map((a) => [a.id, a.name]));
  const label = Object.fromEntries(REACTIONS.map((r) => [r.key, r.label]));

  const csv = Papa.unparse(
    (reactions ?? []).map((r) => ({
      artist: name[r.artist_id] ?? r.artist_id,
      first_name: r.first_name ?? "",
      reaction: label[r.reaction] ?? r.reaction,
      comment: r.comment ?? "",
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rabobank-reactions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
