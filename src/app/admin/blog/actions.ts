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

export async function getMyProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("projects")
    .select("id, title")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
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
    new_project_title: string | null;
    override_date: string | null; // NZ local "YYYY-MM-DDTHH:mm"
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

  const basePayload = {
    title: data.title,
    body: data.body,
    image_url: data.image_url,
    image_url_2: data.image_url_2,
    status: effectiveStatus,
    published_at,
    scheduled_at: effectiveStatus === "published" ? null : scheduled_at,
    featured_profile_id: data.featured_profile_id,
    spotlight_until: data.featured_profile_id ? (data.spotlight_until ?? null) : null,
    updated_at: now,
  };

  // Upsert the blog post first so we have the final slug before creating the studio update
  let row: { id: string; slug: string };
  if (data.id) {
    const newSlug = data.existingSlug && generateSlug(data.title) === data.existingSlug
      ? data.existingSlug
      : generateSlug(data.title) || data.existingSlug || `post-${Date.now()}`;
    const { data: updated, error } = await supabase
      .from("blog_posts")
      .update({ ...basePayload, slug: newSlug })
      .eq("id", data.id)
      .select("id, slug")
      .single();
    if (error) return { error: error.message };
    row = updated;
  } else {
    const slug = generateSlug(data.title) || `post-${Date.now()}`;
    const { data: inserted, error } = await supabase
      .from("blog_posts")
      .insert({ ...basePayload, slug })
      .select("id, slug")
      .single();
    if (error) return { error: error.message };
    row = inserted;
  }

  // Create studio update on first publish — posted from admin's account, artist tagged as credit
  let linkedUpdateId = data.existingLinkedUpdateId ?? null;

  // If a linked update ID exists, verify the record still exists (user may have deleted it)
  if (linkedUpdateId) {
    const { data: existing } = await admin
      .from("project_updates")
      .select("id")
      .eq("id", linkedUpdateId)
      .maybeSingle();
    if (!existing) linkedUpdateId = null;
  }

  if (
    effectiveStatus === "published" &&
    data.studioUpdate &&
    data.featured_profile_id &&
    data.image_url &&
    !linkedUpdateId
  ) {
    let resolvedProjectId = data.studioUpdate.project_id ?? null;
    if (!resolvedProjectId && data.studioUpdate.new_project_title?.trim()) {
      const { data: newProject, error: projErr } = await admin
        .from("projects")
        .insert({ artist_id: user.id, title: data.studioUpdate.new_project_title.trim() })
        .select("id")
        .single();
      if (projErr) return { error: `Failed to create thread: ${projErr.message}` };
      resolvedProjectId = newProject.id;
    }

    const blogUrl = `${BASE_URL}/blog/${row.slug}`;
    const overrideCreatedAt = data.studioUpdate.override_date
      ? nzLocalToUtc(data.studioUpdate.override_date)
      : null;
    const { data: update, error: updateErr } = await admin
      .from("project_updates")
      .insert({
        artist_id: user.id,
        collaborator_ids: data.featured_profile_id ? [data.featured_profile_id] : [],
        project_id: resolvedProjectId,
        content_type: "image",
        image_url: data.image_url,
        caption: data.studioUpdate.caption || null,
        embed_url: blogUrl,
        embed_provider: "Patronage",
        ...(overrideCreatedAt ? { created_at: overrideCreatedAt } : {}),
      })
      .select("id")
      .single();
    if (updateErr) return { error: `Studio update failed: ${updateErr.message}` };
    linkedUpdateId = update.id;
    revalidatePath("/feed");
  }

  // Save linked_update_id back onto the post
  if (linkedUpdateId !== (data.existingLinkedUpdateId ?? null)) {
    await supabase
      .from("blog_posts")
      .update({ linked_update_id: linkedUpdateId })
      .eq("id", row.id);
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${data.existingSlug ?? ""}`);
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

export async function deletePost(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  return {};
}
