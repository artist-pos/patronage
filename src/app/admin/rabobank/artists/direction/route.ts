import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

/** The current PDF, for admins (the artist preview links here so no artist's open is recorded). */
export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 });
  const path = (await getSettings()).direction_pdf_path;
  if (!path) return new NextResponse("No PDF uploaded yet.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from("rabobank-private").download(path);
  if (error || !data) return new NextResponse("Not available", { status: 503 });
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="creative-direction.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}

/** Replaces the creative direction PDF in the private bucket. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a PDF first." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That PDF is over 20 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return NextResponse.json({ error: "That file isn't a PDF." }, { status: 400 });

  const admin = createAdminClient();
  const previous = (await getSettings()).direction_pdf_path;
  const path = `direction/${randomUUID()}.pdf`;
  const { error } = await admin.storage.from("rabobank-private").upload(path, bytes, { contentType: "application/pdf" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: saveError } = await admin
    .from("rabobank_settings")
    .update({ direction_pdf_path: path, direction_pdf_uploaded_at: new Date().toISOString() })
    .eq("id", 1);
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  if (previous) await admin.storage.from("rabobank-private").remove([previous]);
  revalidatePath("/admin/rabobank/artists");
  return NextResponse.json({ ok: true });
}
