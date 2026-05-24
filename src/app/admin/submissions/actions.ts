"use server";

import { createClient } from "@/lib/supabase/server";
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

function isSlugBad(slug: string | null): boolean {
  // A bad slug is null, empty, or starts with "-" (produced when title was blank at insert time)
  return !slug || slug.startsWith("-");
}

export async function approveSubmission(submissionId: string) {
  await guard();
  const supabase = await createClient();

  // Fetch current state so we can fix bad slugs generated when the title was blank at submit time.
  const { data: opp } = await supabase
    .from("opportunities")
    .select("slug, title, organiser, deadline")
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  const updates: Record<string, unknown> = { status: "published", is_active: true };
  if (opp && isSlugBad(opp.slug)) {
    updates.slug = toSlug(opp.title ?? "", opp.organiser ?? null, opp.deadline ?? null);
  }

  const { error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${submissionId}`);
}

export async function rejectSubmission(submissionId: string) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("opportunities")
    .update({ status: "rejected" })
    .eq("id", submissionId);
  revalidatePath("/admin/submissions");
}
