import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const bucket = form.get("bucket") as string | null;
  const path = form.get("path") as string | null;

  if (!file || !bucket || !path) {
    return NextResponse.json({ error: "Missing file, bucket, or path" }, { status: 400 });
  }

  const maxWidth = form.get("maxWidth") ? Number(form.get("maxWidth")) : undefined;
  const quality = form.get("quality") ? Number(form.get("quality")) : 90;
  const upsert = form.get("upsert") === "true";
  const thumb = form.get("thumb") === "true";
  const thumbPath = form.get("thumbPath") as string | null;
  const thumbWidth = form.get("thumbWidth") ? Number(form.get("thumbWidth")) : 800;
  const thumbQuality = form.get("thumbQuality") ? Number(form.get("thumbQuality")) : 80;

  const buffer = Buffer.from(await file.arrayBuffer());

  const [full, thumbProcessed] = await Promise.all([
    processImage(buffer, { maxWidth, quality }),
    thumb ? processImage(buffer, { maxWidth: thumbWidth, quality: thumbQuality }) : Promise.resolve(null),
  ]);

  const admin = createAdminClient();

  const uploadPromises: Promise<{ error: { message: string } | null }>[] = [
    admin.storage.from(bucket).upload(path, full.data, { contentType: "image/webp", upsert }).then(r => r),
  ];
  if (thumbProcessed && thumbPath) {
    uploadPromises.push(
      admin.storage.from(bucket).upload(thumbPath, thumbProcessed.data, { contentType: "image/webp", upsert }).then(r => r)
    );
  }

  const [fullResult, thumbResult] = await Promise.all(uploadPromises);
  if (fullResult.error) {
    return NextResponse.json({ error: fullResult.error.message }, { status: 500 });
  }

  const url = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const thumbUrl =
    thumbResult && !thumbResult.error && thumbPath
      ? admin.storage.from(bucket).getPublicUrl(thumbPath).data.publicUrl
      : undefined;

  return NextResponse.json({ url, thumbUrl, width: full.width, height: full.height });
}
