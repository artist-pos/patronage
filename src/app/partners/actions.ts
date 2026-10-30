"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession } from "@/lib/stripe";
import {
  FEATURED_LISTING_PLANS,
  PIPELINE_ACTIVATION_PRICE_CENTS,
  PRICING_CURRENCY,
  grossUpForStripe,
} from "@/lib/commerce-pricing";
import { notifyOpportunitySubmission } from "@/lib/email";
import { getOpportunitySource } from "@/lib/opportunity-sources";
import { CAPTION_MAX, normaliseOpportunityWrite } from "@/lib/opportunity-fields";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isSubmittedTooFast } from "@/lib/form-timing";
import { isTorExit, recordBlocked } from "@/lib/bot-guard";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";
import { isAdmin } from "@/lib/admin";
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
  turnstileToken?: string;
  loadedAt?: number;
  [HONEYPOT_FIELD]?: string;
}): Promise<{ error?: string }> {
  // Bots that blindly fill every field trip the honeypot — pretend success
  // so they don't retry with a cleaner payload. Same treatment for a
  // submission that arrived faster than a human could fill the form.
  if (data[HONEYPOT_FIELD] || isSubmittedTooFast(data.loadedAt)) return {};

  const name = data.name.trim();
  const email = data.email.trim();
  const message = data.message.trim();
  if (!name || !email || !message) return { error: "Name, email, and message are required." };

  const ip = await getClientIp();
  if (await isTorExit(ip)) {
    await recordBlocked("form_blocked", { reason: "tor", form: "activation_enquiry" });
    return {};
  }
  if (!(await checkRateLimit(`activation-enquiry:${ip}`, 3, 3600))) {
    return { error: "Too many enquiries from this network. Please try again later." };
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return { error: "Verification failed. Please refresh and try again." };
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Patronage <hello@patronage.nz>";
  if (!key) return { error: "Email not configured." };

  const resend = new Resend(key);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const organisation = data.organisation.trim();
  const interestList = data.interests.length > 0 ? esc(data.interests.join(", ")) : "Not specified";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;">New activation enquiry</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;font-weight:600;width:140px;">Name</td><td>${esc(name)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Organisation</td><td>${organisation ? esc(organisation) : "Not provided"}</td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Interests</td><td>${interestList}</td></tr>
  </table>
  <div style="margin-top:16px;padding:12px;background:#f9f9f9;border-left:3px solid #000;">
    <p style="margin:0;font-size:14px;line-height:1.6;">${esc(message).replace(/\n/g, "<br>")}</p>
  </div>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from,
    to: "hello@patronage.nz",
    replyTo: email,
    subject: `Activation enquiry from ${name}${organisation ? ` (${organisation})` : ""}`,
    html,
  });

  if (error) return { error: (error as { message?: string }).message ?? "Failed to send." };
  return {};
}

/**
 * Introduction request for an unclaimed (shadow) partner profile. Nobody owns
 * the profile, so a DM would land in a thread no one reads — this goes to the
 * Patronage inbox instead, where it doubles as a warm lead for claiming it.
 */
export async function requestPartnerIntroduction(data: {
  profileId: string;
  name: string;
  email: string;
  message: string;
  /** "claim" = the sender says they belong to the organisation and wants the page. */
  kind?: "introduction" | "claim";
  turnstileToken?: string;
  loadedAt?: number;
  [HONEYPOT_FIELD]?: string;
}): Promise<{ error?: string }> {
  if (data[HONEYPOT_FIELD] || isSubmittedTooFast(data.loadedAt)) return {};
  const isClaim = data.kind === "claim";

  const name = data.name.trim().slice(0, 120);
  const email = data.email.trim().slice(0, 200);
  const message = data.message.trim().slice(0, 4000);
  if (!name || !email || !message) return { error: "Name, email, and message are required." };

  const ip = await getClientIp();
  if (await isTorExit(ip)) {
    await recordBlocked("form_blocked", { reason: "tor", form: "partner_introduction" });
    return {};
  }
  if (!(await checkRateLimit(`partner-intro:${ip}`, 3, 3600))) {
    return { error: "Too many requests from this network. Please try again later." };
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return { error: "Verification failed. Please refresh and try again." };
  }

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("profiles")
    .select("full_name, username, account_status, role")
    .eq("id", data.profileId)
    .maybeSingle();
  if (!partner || partner.role !== "partner") return { error: "Partner not found." };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Patronage <hello@patronage.nz>";
  if (!key) return { error: "Email not configured." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const partnerName = partner.full_name ?? partner.username ?? "a partner";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;">${isClaim ? "Claim request" : "Introduction request"}: ${esc(partnerName)}</h2>
  <p style="font-size:13px;color:#555;margin:0 0 16px;">
    ${isClaim
      ? "Someone says they belong to this unclaimed partner. Check their email domain against the organisation before sending a claim link."
      : "Sent from the profile of an unclaimed partner. Send them a claim link and make the introduction."}
    Profile: <a href="${site}/${esc(partner.username ?? "")}">${site}/${esc(partner.username ?? "")}</a>
  </p>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;font-weight:600;width:140px;">Name</td><td>${esc(name)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Signed in</td><td>${user ? "Yes" : "No"}</td></tr>
  </table>
  <div style="margin-top:16px;padding:12px;background:#f9f9f9;border-left:3px solid #000;">
    <p style="margin:0;font-size:14px;line-height:1.6;">${esc(message).replace(/\n/g, "<br>")}</p>
  </div>
</body>
</html>`;

  const { error } = await new Resend(key).emails.send({
    from,
    to: "hello@patronage.nz",
    replyTo: email,
    subject: `${isClaim ? "Claim request" : "Introduction request"} for ${partnerName} from ${name}`,
    html,
  });

  if (error) return { error: (error as { message?: string }).message ?? "Failed to send." };
  return {};
}

export interface SubmissionState {
  success?: boolean;
  error?: string;
  /** Set when the submission requires payment (featured and/or pipeline
   *  beyond the partner's first free round). The form should redirect. */
  checkoutUrl?: string;
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
  // Attribution is registry-keyed — anything else is stored as "not sourced".
  const sourceRaw = (formData.get("source") as string)?.trim() || null;
  const sourceKey = getOpportunitySource(sourceRaw) ? sourceRaw : null;
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

  // Application links arrive as JSON; the same normaliser every editor uses
  // cleans them, derives `url`, validates the contact email and converts a
  // foreign-currency entry fee to NZD.
  let applicationLinksRaw: unknown = [];
  try { applicationLinksRaw = JSON.parse((formData.get("application_links") as string) || "[]"); } catch { applicationLinksRaw = []; }
  const localAmount = entryFeeRaw !== "" && entryFeeRaw != null ? parseFloat(entryFeeRaw) : null;
  const normalised = await normaliseOpportunityWrite<{
    application_links: unknown[];
    url: string | null;
    contact_email: string | null;
    entry_fee: number | null;
    entry_fee_currency: string | null;
    entry_fee_local?: number | null;
  }>({
    application_links: Array.isArray(applicationLinksRaw) ? applicationLinksRaw : [],
    url: (formData.get("url") as string)?.trim() || null,
    contact_email: (formData.get("contact_email") as string) || null,
    entry_fee: localAmount,
    entry_fee_currency: entryFeeCurrency,
  });

  const isFeatured = isFeaturedRaw === "true";
  const isPipeline = routingType === "pipeline";

  // Defence-in-depth: the form gates submission behind sign-in, but a direct
  // POST could otherwise publish a Featured/Pipeline listing without paying.
  if (!user && (isFeatured || isPipeline)) {
    return { error: "Sign in to submit a Featured or Pipeline listing." };
  }

  // An admin listing someone else's opportunity: it belongs to nobody until the
  // organisation claims it, and needs claim outreach details at review.
  const byAdmin = !!user && !isFeatured && !isPipeline && (await isAdmin());

  const { data: inserted, error } = await supabase.from("opportunities").insert({
    status: "pending",
    is_active: false,
    title,
    organiser,
    origin: byAdmin ? "admin" : "submission",
    caption: captionRaw ? captionRaw.slice(0, CAPTION_MAX) : null,
    full_description: (formData.get("full_description") as string)?.trim() || null,
    type: (formData.get("type") as string) || "Grant",
    country: (formData.get("country") as string) || "NZ",
    city: (formData.get("city") as string)?.trim() || null,
    opens_at: opens_at || null,
    deadline: deadline || null,
    url: normalised.url,
    application_links: normalised.application_links,
    contact_email: normalised.contact_email,
    artist_payment_type: (formData.get("artist_payment_type") as string)?.trim() || null,
    funding_range: (formData.get("funding_range") as string)?.trim() || null,
    entry_fee: normalised.entry_fee,
    entry_fee_currency: normalised.entry_fee_currency,
    entry_fee_local: normalised.entry_fee_local,
    sub_categories: subCategories,
    career_stage: careerStage,
    tags,
    featured_image_url: (formData.get("featured_image_url") as string)?.trim() || null,
    secondary_image_url: (formData.get("secondary_image_url") as string)?.trim() || null,
    grant_type: (formData.get("grant_type") as string)?.trim() || null,
    recipients_count: recipientsRaw ? parseInt(recipientsRaw) : null,
    submitter_email: (formData.get("submitter_email") as string)?.trim() || null,
    profile_id: byAdmin ? null : user?.id ?? null,
    travel_support: travelSupportRaw === "true" ? true : travelSupportRaw === "false" ? false : null,
    travel_support_details: (formData.get("travel_support_details") as string)?.trim() || null,
    routing_type: routingType,
    source: sourceKey,
    source_url: sourceKey ? (formData.get("source_url") as string)?.trim() || null : null,
    custom_fields: customFields,
    show_badges_in_submission: showBadgesRaw === "true",
    pipeline_config: pipelineConfig,
    is_featured: isFeatured,
    is_recurring: isRecurringRaw === "true",
    recurrence_pattern: recurrencePattern,
    recurrence_end_date: recurrenceEndDate,
  }).select("id").single();

  if (error || !inserted) return { error: error?.message ?? "Couldn't create listing." };

  notifyOpportunitySubmission({
    title,
    organiser,
    type: (formData.get("type") as string) || "Grant",
    submitterEmail: (formData.get("submitter_email") as string)?.trim() || null,
    isFeatured,
    isPipeline,
    adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/admin`,
  }).catch(console.error);

  // Paid add-ons trigger a single combined Stripe checkout. Anonymous
  // submissions skip checkout — their flagged tier is downgraded to free
  // until they sign in and pay from the listing edit page.
  if (!user) return { success: true };

  const featuredPlan = isFeatured ? FEATURED_LISTING_PLANS[0] : null;

  // First pipeline round per partner is free. Detect prior paid pipeline
  // payments by this partner; if none, this round is on the house.
  let pipelineFeeApplies = false;
  if (isPipeline) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("pipeline_entry_payments")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", user.id)
      .eq("status", "paid");
    pipelineFeeApplies = (count ?? 0) > 0;
  }

  if (!featuredPlan && !pipelineFeeApplies) return { success: true };

  const admin = createAdminClient();
  const lineItems: Array<{
    amountCents: number;
    currency: string;
    productName: string;
    productDescription?: string;
  }> = [];
  const metadata: Record<string, string> = { opportunity_id: inserted.id };

  if (featuredPlan) {
    const { data: payment, error: payErr } = await admin
      .from("featured_listing_payments")
      .insert({
        opportunity_id: inserted.id,
        partner_id: user.id,
        amount_cents: featuredPlan.amountCents,
        currency: PRICING_CURRENCY,
        feature_days: featuredPlan.days,
      })
      .select("id")
      .single();
    if (payErr || !payment) {
      return { error: payErr?.message ?? "Couldn't create featured payment." };
    }
    metadata.featured_payment_id = payment.id;
    metadata.feature_days = String(featuredPlan.days);
    lineItems.push({
      amountCents: featuredPlan.amountCents,
      currency: PRICING_CURRENCY,
      productName: `Featured placement: ${title}`,
      productDescription: `Promotes this opportunity in featured slots for ${featuredPlan.days} days.`,
    });
  }

  if (pipelineFeeApplies) {
    const { data: payment, error: payErr } = await admin
      .from("pipeline_entry_payments")
      .insert({
        opportunity_id: inserted.id,
        partner_id: user.id,
        amount_cents: PIPELINE_ACTIVATION_PRICE_CENTS,
        currency: PRICING_CURRENCY,
      })
      .select("id")
      .single();
    if (payErr || !payment) {
      return { error: payErr?.message ?? "Couldn't create pipeline payment." };
    }
    metadata.pipeline_payment_id = payment.id;
    lineItems.push({
      amountCents: PIPELINE_ACTIVATION_PRICE_CENTS,
      currency: PRICING_CURRENCY,
      productName: `Publishing fee: ${title}`,
      productDescription:
        "Publishes your open call on Patronage with the full application pipeline.",
    });
  }

  // Stripe processing-fee passthrough — gross-up over the combined base.
  const baseTotal = lineItems.reduce((sum, l) => sum + l.amountCents, 0);
  const { stripeFeeCents } = grossUpForStripe(baseTotal);
  lineItems.push({
    amountCents: stripeFeeCents,
    currency: PRICING_CURRENCY,
    productName: "Processing fee",
    productDescription:
      "Covers third-party card processing (Stripe). Reflects Stripe's actual cost (NZ Commerce Commission requirement).",
  });

  try {
    const session = await createCheckoutSession({
      purpose: "partner_submission",
      mode: "payment",
      buyerEmail: user.email ?? "",
      lineItems,
      metadata,
      successPath: `/partner/opportunities/${inserted.id}/edit?submission=success`,
      cancelPath: `/partner/opportunities/${inserted.id}/edit?submission=cancelled`,
    });
    if (metadata.featured_payment_id) {
      await admin
        .from("featured_listing_payments")
        .update({ stripe_session_id: session.sessionId })
        .eq("id", metadata.featured_payment_id);
    }
    if (metadata.pipeline_payment_id) {
      await admin
        .from("pipeline_entry_payments")
        .update({ stripe_session_id: session.sessionId })
        .eq("id", metadata.pipeline_payment_id);
    }
    return { success: true, checkoutUrl: session.url };
  } catch (err) {
    // Roll back the unfunded payment rows so the partner can retry from the
    // edit page without dangling 'pending' records.
    if (metadata.featured_payment_id) {
      await admin.from("featured_listing_payments").delete().eq("id", metadata.featured_payment_id);
    }
    if (metadata.pipeline_payment_id) {
      await admin.from("pipeline_entry_payments").delete().eq("id", metadata.pipeline_payment_id);
    }
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }
}
