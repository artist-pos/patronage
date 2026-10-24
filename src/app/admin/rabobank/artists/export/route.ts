import { NextResponse } from "next/server";
import Papa from "papaparse";
import { isAdmin } from "@/lib/admin";
import { loadArtistAdmin } from "@/lib/rabobank/artist-admin";

export const dynamic = "force-dynamic";

/** One row per invite: status, the submitted quote, and the indicative totals. Fees are excluding GST. */
export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 });
  const { rows } = await loadArtistAdmin();
  const csv = Papa.unparse(
    rows.map(({ invite: i, quote: q, artist: a, deletion: d, partOne, partTwo, sizes }) => ({
      first_name: i.first_name,
      full_name: i.full_name ?? "",
      channel: i.channel,
      email: i.email ?? "",
      instagram: i.instagram_handle ?? "",
      invited_at: i.invited_at ?? "",
      opened_at: i.opened_at ?? "",
      opened_source: i.opened_source ?? "",
      part_one: partOne,
      part_two: partTwo,
      interested: q?.interested ?? "",
      questions: q?.questions_text ?? "",
      deliver_by: q?.deliver_by === "date" ? q.deliver_date ?? "" : q?.deliver_by ?? "",
      work_type: q?.work_type ?? "",
      approach: q?.approach_text ?? "",
      fee_1800x900_as_entered: q?.fee_1800x900 ?? "",
      fee_1600x800_as_entered: q?.fee_1600x800 ?? "",
      gst: q?.gst_inclusive === null || q?.gst_inclusive === undefined ? "" : q.gst_inclusive ? "included" : "excluded",
      fee_1800x900_ex_gst: sizes.big.fee ?? "",
      fee_1600x800_ex_gst: sizes.small.fee ?? "",
      framing: q?.framing_option ?? "",
      framing_cost: q?.framing_cost ?? "",
      framing_recommendation: q?.framing_recommendation ?? "",
      install: q?.install_option ?? "",
      install_cost: q?.install_cost ?? "",
      install_recommendation: q?.install_recommendation ?? "",
      based_in: q?.based_in ?? "",
      indicative_total_1800x900: sizes.big.total ?? "",
      indicative_total_1600x800: sizes.small.total ?? "",
      alt_size_note: q?.alt_size_note ?? "",
      lead_time_weeks: q?.lead_time_weeks ?? "",
      anything_else: q?.anything_else ?? "",
      decline_suggestion: i.decline_suggestion ?? "",
      shortlisted: a?.visible ? "yes" : "",
      profile_state: a?.state ?? (d ? "deleted" : ""),
      profile_choice: a?.visibility_choice ?? "",
      works: a?.works ?? "",
      deleted_at: d?.deleted_at ?? "",
      notes: i.admin_notes ?? "",
    }))
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rabobank-artists.csv"',
      "Cache-Control": "no-store",
    },
  });
}
