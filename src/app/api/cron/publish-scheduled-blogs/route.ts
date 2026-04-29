import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel cron: hourly. vercel.json: { "path": "/api/cron/publish-scheduled-blogs", "schedule": "0 * * * *" }
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
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("blog_posts")
    .select("id, slug, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ published: 0 });
  }

  const results = await Promise.all(
    due.map(async (p) => {
      const { error: updateError } = await admin
        .from("blog_posts")
        .update({
          status: "published",
          published_at: p.scheduled_at ?? nowIso,
        })
        .eq("id", p.id);
      if (updateError) return { id: p.id, ok: false };
      revalidatePath(`/blog/${p.slug}`);
      return { id: p.id, ok: true };
    }),
  );

  revalidatePath("/blog");

  const published = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({ published, failed });
}
