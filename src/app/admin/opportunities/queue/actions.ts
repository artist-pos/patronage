"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { toSlug, isSlugBad } from "@/lib/opportunity-slug";
import { normaliseOpportunityWrite } from "@/lib/opportunity-fields";
import type { OpportunityPayload } from "@/lib/opportunity-payload";
import { validPartnerProfileId } from "@/lib/organiser-link";
import { isAggregated, missingOutreachDetails } from "@/lib/claim-outreach";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

interface OutreachRow {
  id: string;
  origin: string | null;
  profile_id: string | null;
  claim_email: string | null;
  claim_contact_name: string | null;
  claim_current_tool: string | null;
}

/** Aggregated listings can't go live until we know who to contact and how they take applications. */
function incomplete(r: OutreachRow): string[] {
  if (!isAggregated({ origin: r.origin as "scraper" | "submission" | "admin", profile_id: r.profile_id })) return [];
  return missingOutreachDetails({
    email: r.claim_email ?? "",
    contactName: r.claim_contact_name ?? "",
    currentTool: r.claim_current_tool ?? "",
  });
}

export async function saveOutreachDetails(
  id: string,
  d: { email: string; contactName: string; currentTool: string }
): Promise<{ error?: string }> {
  await guard();
  const missing = missingOutreachDetails(d);
  if (missing.length > 0) return { error: `Add the ${missing.join(", ")}.` };
  const admin = createAdminClient();
  const { error } = await admin
    .from("opportunities")
    .update({
      claim_email: d.email.trim().toLowerCase(),
      claim_contact_name: d.contactName.trim(),
      claim_current_tool: d.currentTool.trim(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/opportunities/queue");
  return {};
}

export async function approveOpportunity(id: string): Promise<{ error?: string }> {
  await guard();
  const admin = createAdminClient();

  // Fetch the opportunity so we can generate/fix a slug if it's missing or bad
  // (e.g. "-2027" — generated back when title/organiser were still blank).
  const { data: opp } = await admin
    .from("opportunities")
    .select("slug, title, organiser, deadline, id, origin, profile_id, claim_email, claim_contact_name, claim_current_tool")
    .eq("id", id)
    .single();

  if (opp) {
    const missing = incomplete(opp as OutreachRow);
    if (missing.length > 0) return { error: `Add the ${missing.join(", ")} before approving.` };
  }

  const updates: Record<string, unknown> = { status: "published", is_active: true };
  if (opp && isSlugBad(opp.slug)) {
    updates.slug = toSlug(opp.title ?? "", opp.organiser ?? null, opp.deadline ?? null);
  }

  await admin.from("opportunities").update(updates).eq("id", id);
  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
  return {};
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

/** Approves everything that has its outreach details; returns the ids left behind. */
export async function approveAll(ids: string[]): Promise<{ approved: string[]; skipped: string[] }> {
  await guard();
  const admin = createAdminClient();

  // Fetch all to generate slugs for any that are missing one.
  const { data: opps } = await admin
    .from("opportunities")
    .select("id, slug, title, organiser, deadline, origin, profile_id, claim_email, claim_contact_name, claim_current_tool")
    .in("id", ids);

  const ready = (opps ?? []).filter((o) => incomplete(o as OutreachRow).length === 0);
  const skipped = (opps ?? []).filter((o) => incomplete(o as OutreachRow).length > 0).map((o) => o.id);
  const approved = ready.map((o) => o.id);
  if (approved.length === 0) return { approved, skipped };

  // Generate/fix slugs in parallel for missing-or-bad ones, then bulk-approve all.
  const slugUpdates = ready
    .filter((o) => isSlugBad(o.slug))
    .map((o) => admin
      .from("opportunities")
      .update({ slug: toSlug(o.title ?? "", o.organiser ?? null, o.deadline ?? null) })
      .eq("id", o.id)
    );

  await Promise.all([
    ...slugUpdates,
    admin.from("opportunities").update({ status: "published", is_active: true }).in("id", approved),
  ]);

  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/[id]", "page");
  return { approved, skipped };
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

export async function updateQueueOpportunity(id: string, fields: OpportunityPayload) {
  await guard();
  const admin = createAdminClient();

  // The same normalisation every other editor goes through: link rows, source,
  // contact email and foreign-currency entry fees.
  const data: Record<string, unknown> = await normaliseOpportunityWrite({
    ...fields,
    title: fields.title.trim(),
    organiser: fields.organiser.trim(),
  });

  if ("organiser_profile_id" in data) {
    const pid = await validPartnerProfileId(data.organiser_profile_id as string | null | undefined);
    data.organiser_profile_id = pid;
    if (pid) data.profile_id = pid;
  }

  const { error } = await admin.from("opportunities").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/opportunities/queue");
}