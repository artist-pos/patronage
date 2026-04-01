"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
}

export async function upsertPost(data: {
  id?: string;
  title: string;
  existingSlug?: string;
  body: string;
  image_url: string | null;
  status: "draft" | "published";
  existingPublishedAt?: string | null;
}): Promise<{ error?: string; id?: string; slug?: string }> {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const published_at =
    data.status === "published"
      ? (data.existingPublishedAt ?? now)
      : null;

  if (data.id) {
    const { data: row, error } = await supabase
      .from("blog_posts")
      .update({
        title: data.title,
        body: data.body,
        image_url: data.image_url,
        status: data.status,
        published_at,
        updated_at: now,
      })
      .eq("id", data.id)
      .select("id, slug")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/blog");
    revalidatePath(`/blog/${row.slug}`);
    revalidatePath("/admin/blog");
    return { id: row.id, slug: row.slug };
  }

  // New post — generate slug with collision fallback
  const baseSlug = generateSlug(data.title);
  const slug = baseSlug || `post-${Date.now()}`;

  const { data: row, error } = await supabase
    .from("blog_posts")
    .insert({
      title: data.title,
      slug,
      body: data.body,
      image_url: data.image_url,
      status: data.status,
      published_at,
    })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  return { id: row.id, slug: row.slug };
}

export async function deletePost(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  return {};
}
