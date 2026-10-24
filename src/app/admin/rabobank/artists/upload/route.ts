import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";

export const runtime = "nodejs";

/** Featured image for an invite's landing page. Returns the public URL. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Choose an image under 12 MB." }, { status: 400 });
  }
  let full;
  try {
    const oriented = await sharp(Buffer.from(await file.arrayBuffer())).rotate().toBuffer();
    full = await processImage(oriented, { maxWidth: 1800, quality: 86 });
  } catch {
    return NextResponse.json({ error: "That image could not be read." }, { status: 400 });
  }
  const admin = createAdminClient();
  const path = `invites/${randomUUID()}.webp`;
  const { error } = await admin.storage.from("rabobank-pilot").upload(path, full.data, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: admin.storage.from("rabobank-pilot").getPublicUrl(path).data.publicUrl });
}
