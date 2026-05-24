"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

function toSlug(title: string, organiser: string | null, deadline: string | null): string {
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const organiserPart = organiser ? slugify(organiser).slice(0, 40).replace(/-+$/, "") : "";
  const titlePart = slugify(title).slice(0, 60).replace(/-+$/, "");
  const year = deadline ? new Date(deadline).getFullYear() : null;
  const base = [organiserPart, titlePart].filter(Boolean).join("-");
  return year ? `${base}-${year}` : base;
}

export async function approveOpportunity(id: string) {
  await guard();
  const admin = createAdminClient();

  // Fetch the opportunity so we can generate a slug if one is missing.
  const { data: opp } = await admin
    .from("opportunities")
    .select("slug, title, organiser, deadline")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = { status: "published", is_active: true };
  if (opp && !opp.slug) {
    updates.slug = toSlug(opp.title ?? "", opp.organiser ?? null, opp.deadline ?? null);
  }

  await admin.from("opportunities").update(updates).eq("id", id);
  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
}

export async function rejectOpportunity(id: string) {
  await guard();
  const admin = createAdminClient();
  // Soft-delete: keep as block-list so scraper won't re-insert on next run
  await admin
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .eq("id", id);
  revalidatePath("/admin/opportunities/queue");
}

export async function approveAll(ids: string[]) {
  await guard();
  const admin = createAdminClient();

  // Fetch all to generate slugs for any that are missing one.
  const { data: opps } = await admin
    .from("opportunities")
    .select("id, slug, title, organiser, deadline")
    .in("id", ids);

  // Generate slugs in parallel for slug-less opps, then bulk-approve all.
  const slugUpdates = (opps ?? [])
    .filter((o) => !o.slug)
    .map((o) => admin
      .from("opportunities")
      .update({ slug: toSlug(o.title ?? "", o.organiser ?? null, o.deadline ?? null) })
      .eq("id", o.id)
    );

  await Promise.all([
    ...slugUpdates,
    admin.from("opportunities").update({ status: "published", is_active: true }).in("id", ids),
  ]);

  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/[id]", "page");
}

export async function rejectAll(ids: string[]) {
  await guard();
  const admin = createAdminClient();
  // Soft-delete: keep as block-list so scraper won't re-insert on next run
  await admin
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .in("id", ids);
  revalidatePath("/admin/opportunities/queue");
}

export async function updateQueueOpportunity(
  id: string,
  fields: {
    title: string;
    organiser: string;
    caption: string | null;
    type: string;
    country: string;
    city: string | null;
    opens_at: string | null;
    deadline: string | null;
    url: string | null;
    funding_range: string | null;
    full_description: string | null;
    featured_image_url: string | null;
    sub_categories: string[] | null;
    career_stage: string[] | null;
    tags: string[] | null;
    entry_fee: number | null;
    entry_fee_currency: string | null;
    entry_fee_local: number | null;
    grant_type: string | null;
    recipients_count: number | null;
    artist_payment_type: string | null;
    travel_support: boolean | null;
    travel_support_details: string | null;
    is_recurring: boolean;
    recurrence_pattern: string | null;
    recurrence_open_day: number | null;
    recurrence_close_day: number | null;
    recurrence_end_date: string | null;
  }
) {
  await guard();
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({
      title: fields.title.trim(),
      organiser: fields.organiser.trim(),
      caption: fields.caption?.trim() || null,
      type: fields.type,
      country: fields.country,
      city: fields.city?.trim() || null,
      opens_at: fields.opens_at || null,
      deadline: fields.deadline || null,
      url: fields.url?.trim() || null,
      funding_range: fields.funding_range?.trim() || null,
      full_description: fields.full_description?.trim() || null,
      featured_image_url: fields.featured_image_url?.trim() || null,
      sub_categories: fields.sub_categories,
      career_stage: fields.career_stage,
      tags: fields.tags,
      entry_fee: fields.entry_fee,
      entry_fee_currency: fields.entry_fee_currency,
      entry_fee_local: fields.entry_fee_local,
      grant_type: fields.grant_type?.trim() || null,
      recipients_count: fields.recipients_count,
      artist_payment_type: fields.artist_payment_type || null,
      travel_support: fields.travel_support,
      travel_support_details: fields.travel_support_details?.trim() || null,
      is_recurring: fields.is_recurring,
      recurrence_pattern: fields.recurrence_pattern || null,
      recurrence_open_day: fields.recurrence_open_day,
      recurrence_close_day: fields.recurrence_close_day,
      recurrence_end_date: fields.recurrence_end_date || null,
    })
    .eq("id", id);
  revalidatePath("/admin/opportunities/queue");
}
