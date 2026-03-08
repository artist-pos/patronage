"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function approveOpportunity(id: string) {
  await guard();
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({ status: "published", is_active: true })
    .eq("id", id);
  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
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
  await admin
    .from("opportunities")
    .update({ status: "published", is_active: true })
    .in("id", ids);
  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
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
    opens_at: string | null;
    deadline: string | null;
    url: string | null;
    funding_range: string | null;
    full_description: string | null;
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
      opens_at: fields.opens_at || null,
      deadline: fields.deadline || null,
      url: fields.url?.trim() || null,
      funding_range: fields.funding_range?.trim() || null,
      full_description: fields.full_description?.trim() || null,
    })
    .eq("id", id);
  revalidatePath("/admin/opportunities/queue");
}
