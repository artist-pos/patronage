import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";

export const runtime = "nodejs";

const BUCKET = "rabobank-pilot";
const MAX_BYTES = 12 * 1024 * 1024;

const field = (fd: FormData, name: string, max: number): string | null =>
  String(fd.get(name) ?? "").trim().slice(0, max) || null;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorised." }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get("file");
  const artistId = String(fd.get("artist_id") ?? "");
  if (!(file instanceof File) || !artistId) {
    return NextResponse.json({ error: "Choose an image first." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is not an image, or is over 12 MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: artist } = await admin.from("rabobank_artist").select("id").eq("id", artistId).maybeSingle();
  if (!artist) return NextResponse.json({ error: "Artist not found." }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let full, thumb;
  try {
    [full, thumb] = await Promise.all([
      processImage(buffer, { maxWidth: 1800, quality: 88 }),
      processImage(buffer, { maxWidth: 640, quality: 78 }),
    ]);
  } catch {
    return NextResponse.json({ error: "That image could not be read." }, { status: 400 });
  }

  const base = `${artistId}/${randomUUID()}`;
  const opts = { contentType: "image/webp", cacheControl: "31536000" };
  const [a, b] = await Promise.all([
    admin.storage.from(BUCKET).upload(`${base}.webp`, full.data, opts),
    admin.storage.from(BUCKET).upload(`${base}-thumb.webp`, thumb.data, opts),
  ]);
  if (a.error || b.error) {
    return NextResponse.json({ error: (a.error ?? b.error)!.message }, { status: 500 });
  }

  const { data: last } = await admin
    .from("rabobank_work")
    .select("sort_order")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("rabobank_work").insert({
    artist_id: artistId,
    image_url: admin.storage.from(BUCKET).getPublicUrl(`${base}.webp`).data.publicUrl,
    thumb_url: admin.storage.from(BUCKET).getPublicUrl(`${base}-thumb.webp`).data.publicUrl,
    title: field(fd, "title", 200),
    size: field(fd, "size", 100),
    year: field(fd, "year", 20),
    medium: field(fd, "medium", 200),
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/admin/rabobank/shortlist");
  return NextResponse.json({ ok: true });
}
