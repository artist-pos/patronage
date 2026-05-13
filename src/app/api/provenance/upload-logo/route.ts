import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 2 MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const { data: processed } = await processImage(Buffer.from(bytes), { maxWidth: 400, quality: 85 });

  const path = `${user.id}/logo.webp`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("provenance-assets")
    .upload(path, processed, { contentType: "image/webp", upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage
    .from("provenance-assets")
    .getPublicUrl(path);

  return NextResponse.json({ publicUrl });
}
