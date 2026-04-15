"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyOpportunitySubmission } from "@/lib/email";
import { Resend } from "resend";

// ── Admin: update an activation type row ─────────────────────────────────────

export async function updateActivationType(
  id: string,
  data: {
    title?: string;
    description?: string;
    image_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify admin/owner role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "owner"].includes(profile.role ?? "")) {
    return { error: "Not authorised." };
  }

  const { error } = await supabase
    .from("activation_types")
    .update(data)
    .eq("id", id);

  if (error) return { error: error.message };
  return {};
}

export async function submitActivationEnquiry(data: {
  name: string;
  organisation: string;
  email: string;
  interests: string[];
  message: string;
}): Promise<{ error?: string }> {
  const name = data.name.trim();
  const email = data.email.trim();
  const message = data.message.trim();
  if (!name || !email || !message) return { error: "Name, email, and message are required." };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Patronage <hello@patronage.nz>";
  if (!key) return { error: "Email not configured." };

  const resend = new Resend(key);
  const interestList = data.interests.length > 0 ? data.interests.join(", ") : "Not specified";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;">New activation enquiry</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;font-weight:600;width:140px;">Name</td><td>${name}</td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Organisation</td><td>${data.organisation || "Not provided"}</td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Interests</td><td>${interestList}</td></tr>
  </table>
  <div style="margin-top:16px;padding:12px;background:#f9f9f9;border-left:3px solid #000;">
    <p style="margin:0;font-size:14px;line-height:1.6;">${message.replace(/\n/g, "<br>")}</p>
  </div>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from,
    to: "hello@patronage.nz",
    replyTo: email,
    subject: `Activation enquiry — ${name}${data.organisation ? ` (${data.organisation})` : ""}`,
    html,
  });

  if (error) return { error: (error as { message?: string }).message ?? "Failed to send." };
  return {};
}

export interface SubmissionState {
  success?: boolean;
  error?: string;
}

export async function submitOpportunityAction(
  _prev: SubmissionState,
  formData: FormData
): Promise<SubmissionState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const title = (formData.get("title") as string)?.trim();
  const organiser = (formData.get("organiser") as string)?.trim();
  if (!title || !organiser) return { error: "Title and organiser are required." };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };
  if (organiser.length > 100) return { error: "Organiser name must be 100 characters or fewer." };

  const opens_at = (formData.get("opens_at") as string) || null;
  const deadline = (formData.get("deadline") as string) || null;
  const recipientsRaw = formData.get("recipients_count") as string;
  const subCatsRaw = (formData.get("sub_categories") as string)?.trim();
  const subCategories = subCatsRaw
    ? subCatsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const careerStageRaw = (formData.get("career_stage") as string)?.trim();
  const careerStage = careerStageRaw
    ? careerStageRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const tagsRaw = (formData.get("tags") as string)?.trim();
  const tags = tagsRaw
    ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const captionRaw = (formData.get("caption") as string)?.trim();

  const entryFeeRaw = formData.get("entry_fee") as string;
  const entryFeeCurrency = ((formData.get("entry_fee_currency") as string) || "NZD").trim().toUpperCase();
  const travelSupportRaw = formData.get("travel_support") as string;
  const routingType = (formData.get("routing_type") as string) || "external";
  const customFieldsRaw = (formData.get("custom_fields") as string) || "[]";
  const showBadgesRaw = (formData.get("show_badges_in_submission") as string) ?? "true";
  const pipelineConfigRaw = (formData.get("pipeline_config") as string) || "null";
  const isFeaturedRaw = (formData.get("is_featured") as string) ?? "false";
  const isRecurringRaw = (formData.get("is_recurring") as string) ?? "false";
  const recurrencePattern = (formData.get("recurrence_pattern") as string)?.trim() || null;
  const recurrenceEndDate = (formData.get("recurrence_end_date") as string)?.trim() || null;

  let customFields = [];
  try { customFields = JSON.parse(customFieldsRaw); } catch { customFields = []; }

  let pipelineConfig = null;
  try { pipelineConfig = JSON.parse(pipelineConfigRaw); } catch { pipelineConfig = null; }

  const localAmount = entryFeeRaw !== "" && entryFeeRaw != null ? parseFloat(entryFeeRaw) : null;
  let entryFeeNZD = localAmount;
  if (localAmount !== null && entryFeeCurrency !== "NZD") {
    try {
      const rateRes = await fetch(`https://api.frankfurter.app/latest?from=${entryFeeCurrency}&to=NZD`);
      const rateData = await rateRes.json() as { rates?: { NZD?: number } };
      const rate = rateData.rates?.NZD ?? 1;
      entryFeeNZD = Math.round(localAmount * rate * 100) / 100;
    } catch {
      // fallback: store local amount as-is
    }
  }

  const { error } = await supabase.from("opportunities").insert({
    status: "pending",
    is_active: false,
    title,
    organiser,
    caption: captionRaw ? captionRaw.slice(0, 160) : null,
    full_description: (formData.get("full_description") as string)?.trim() || null,
    type: (formData.get("type") as string) || "Grant",
    country: (formData.get("country") as string) || "NZ",
    city: (formData.get("city") as string)?.trim() || null,
    opens_at: opens_at || null,
    deadline: deadline || null,
    url: (formData.get("url") as string)?.trim() || null,
    funding_range: (formData.get("funding_range") as string)?.trim() || null,
    entry_fee: entryFeeNZD,
    entry_fee_currency: entryFeeCurrency !== "NZD" ? entryFeeCurrency : null,
    entry_fee_local: entryFeeCurrency !== "NZD" ? localAmount : null,
    sub_categories: subCategories,
    career_stage: careerStage,
    tags,
    featured_image_url: (formData.get("featured_image_url") as string)?.trim() || null,
    grant_type: (formData.get("grant_type") as string)?.trim() || null,
    recipients_count: recipientsRaw ? parseInt(recipientsRaw) : null,
    submitter_email: (formData.get("submitter_email") as string)?.trim() || null,
    profile_id: user?.id ?? null,
    travel_support: travelSupportRaw === "true" ? true : null,
    travel_support_details: (formData.get("travel_support_details") as string)?.trim() || null,
    routing_type: routingType,
    custom_fields: customFields,
    show_badges_in_submission: showBadgesRaw === "true",
    pipeline_config: pipelineConfig,
    is_featured: isFeaturedRaw === "true",
    is_recurring: isRecurringRaw === "true",
    recurrence_pattern: recurrencePattern,
    recurrence_end_date: recurrenceEndDate,
  });

  if (error) return { error: error.message };

  notifyOpportunitySubmission({
    title,
    organiser,
    type: (formData.get("type") as string) || "Grant",
    submitterEmail: (formData.get("submitter_email") as string)?.trim() || null,
    isFeatured: isFeaturedRaw === "true",
    isPipeline: routingType === "pipeline",
    adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/admin`,
  }).catch(console.error);

  return { success: true };
}
