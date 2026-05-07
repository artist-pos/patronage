"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendTagNotificationDM } from "@/lib/autoDM";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
}

/** Convert a NZ local datetime string ("YYYY-MM-DDTHH:mm") to a UTC ISO string. */
function nzLocalToUtc(localStr: string): string {
  const d12 = new Date(localStr + ":00+12:00");
  const check = d12.toLocaleString("sv", { timeZone: "Pacific/Auckland" });
  if (check === localStr.replace("T", " ") + ":00") return d12.toISOString();
  return new Date(localStr + ":00+13:00").toISOString();
}

export async function searchArtistProfiles(query: string) {
  if (!query.trim()) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("role", ["artist", "owner"])
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(8);
  return data ?? [];
}

export async function getArtistProjects(profileId: string) {
  if (!profileId) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("id, title")
    .eq("artist_id", profileId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as { id: string; title: string }[];
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export async function upsertPost(data: {
  id?: string;
  title: string;
  existingSlug?: string;
  body: string;
  image_url: string | null;
  image_url_2: string | null;
  status: "draft" | "published" | "scheduled";
  existingPublishedAt?: string | null;
  featured_profile_id: string | null;
  spotlight_until: string | null;
  scheduled_at: string | null;
  existingLinkedUpdateId?: string | null;
  studioUpdate: {
    caption: string;
    project_id: string | null;
  } | null;
}): Promise<{ error?: string; id?: string; slug?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const now = new Date().toISOString();
  const admin = createAdminClient();

  const scheduled_at = data.scheduled_at ? nzLocalToUtc(data.scheduled_at) : null;

  const published_at =
    data.status === "published"
      ? (data.existingPublishedAt ?? now)
      : data.status === "scheduled" && scheduled_at && new Date(scheduled_at) <= new Date()
      ? now
      : null;

  const effectiveStatus =
    data.status === "scheduled" && scheduled_at && new Date(scheduled_at) <= new Date()
      ? "published"
      : data.status;

  // Create studio update on first publish if requested
  let linkedUpdateId = data.existingLinkedUpdateId ?? null;
  if (
    effectiveStatus === "published" &&
    data.studioUpdate &&
    data.featured_profile_id &&
    data.image_url &&
    !linkedUpdateId
  ) {
    const { data: update, error: updateErr } = await admin
      .from("project_updates")
      .insert({
        artist_id: data.featured_profile_id,
        project_id: data.studioUpdate.project_id ?? null,
        content_type: "image",
        image_url: data.image_url,
        caption: data.studioUpdate.caption || null,
      })
      .select("id")
      .single();
    if (updateErr) return { error: `Studio update failed: ${updateErr.message}` };
    linkedUpdateId = update.id;
    revalidatePath("/feed");
  }

  const payload = {
    title: data.title,
    body: data.body,
    image_url: data.image_url,
    image_url_2: data.image_url_2,
    status: effectiveStatus,
    published_at,
    scheduled_at: effectiveStatus === "published" ? null : scheduled_at,
    featured_profile_id: data.featured_profile_id,
    spotlight_until: data.featured_profile_id ? (data.spotlight_until ?? null) : null,
    linked_update_id: linkedUpdateId,
    updated_at: now,
  };

  if (data.id) {
    const newSlug = data.existingSlug && generateSlug(data.title) === data.existingSlug
      ? data.existingSlug
      : generateSlug(data.title) || data.existingSlug || `post-${Date.now()}`;

    const { data: row, error } = await supabase
      .from("blog_posts")
      .update({ ...payload, slug: newSlug })
      .eq("id", data.id)
      .select("id, slug")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/blog");
    revalidatePath(`/blog/${data.existingSlug}`);
    revalidatePath(`/blog/${row.slug}`);
    revalidatePath("/admin/blog");
    if (effectiveStatus === "published" && data.featured_profile_id) {
      await sendTagNotificationDM(user.id, data.featured_profile_id, {
        type: "blog_post",
        title: data.title,
        url: `${BASE_URL}/blog/${row.slug}`,
        image_url: data.image_url,
      });
    }
    return { id: row.id, slug: row.slug };
  }

  const baseSlug = generateSlug(data.title);
  const slug = baseSlug || `post-${Date.now()}`;

  const { data: row, error } = await supabase
    .from("blog_posts")
    .insert({ ...payload, slug })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  if (effectiveStatus === "published" && data.featured_profile_id) {
    await sendTagNotificationDM(user.id, data.featured_profile_id, {
      type: "blog_post",
      title: data.title,
      url: `${BASE_URL}/blog/${slug}`,
      image_url: data.image_url,
    });
  }
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
