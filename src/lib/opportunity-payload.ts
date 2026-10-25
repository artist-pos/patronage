import type { OpportunityFormData } from "@/components/opportunities/OpportunityForm";

export type OpportunityPayload = ReturnType<typeof buildOpportunityPayload>;

/**
 * OpportunityFormData -> the columns every editor saves. One mapping, used by the
 * Scraper Queue editor, the admin modal and the partner edit form, so a field is
 * stored the same way wherever it was typed. The server runs the result through
 * normaliseOpportunityWrite() (lib/opportunity-fields).
 */
export function buildOpportunityPayload(
  d: OpportunityFormData,
  opts: {
    /** Keep these when a blank title/organiser is submitted. */
    fallback?: { title: string; organiser: string };
    /** Pipeline settings to save; null/absent leaves a non-pipeline listing with none. */
    pipelineConfig?: object | null;
    /** Featured flag and the recurring schedule: admin only. */
    admin?: boolean;
  } = {}
) {
  const appLinks = d.applicationLinks.filter((l) => l.url.trim() || l.label.trim());
  const fee = d.entryFee !== "" ? parseFloat(d.entryFee) : null;

  return {
    title: d.title.trim() || opts.fallback?.title || "",
    organiser: d.organiser.trim() || opts.fallback?.organiser || "",
    ...(d.organiserLinkTouched ? { organiser_profile_id: d.organiserProfileId } : {}),
    caption: d.caption.trim() || null,
    full_description: d.fullDescription.trim() || null,
    url: appLinks.find((l) => l.url.trim())?.url.trim() || null,
    application_links: appLinks,
    contact_email: d.contactEmail.trim() || null,
    type: d.type,
    country: d.country,
    city: d.city.trim() || null,
    opens_at: d.opensAt || null,
    deadline: d.deadline || null,
    funding_range: d.fundingRange.trim() || null,
    featured_image_url: d.featuredImageUrl.trim() || null,
    secondary_image_url: d.secondaryImageUrl.trim() || null,
    sub_categories: d.selectedDisciplines.length > 0 ? d.selectedDisciplines : null,
    career_stage: d.selectedCareerStages.length > 0 ? d.selectedCareerStages : null,
    tags: d.selectedTags.length > 0 ? d.selectedTags : null,
    entry_fee: fee,
    entry_fee_currency: d.entryFeeCurrency || "NZD",
    grant_type: d.grantType.trim() || null,
    recipients_count: d.recipientsCount ? parseInt(d.recipientsCount) : null,
    artist_payment_type: d.artistPaymentType || null,
    travel_support: d.travelSupport,
    travel_support_details: d.travelSupportDetails.trim() || null,
    routing_type: d.routingType,
    source: d.source || null,
    source_url: d.sourceUrl.trim() || null,
    show_badges_in_submission: d.showBadges,
    pipeline_config: d.routingType === "pipeline" ? (opts.pipelineConfig ?? null) : null,
    ...(opts.admin
      ? {
          claim_email: d.claimEmail.trim() || null,
          claim_contact_name: d.claimContactName.trim() || null,
          claim_current_tool: d.claimCurrentTool.trim() || null,
          is_featured: d.isFeatured,
          is_recurring: d.isRecurring,
          recurrence_pattern: d.isRecurring && d.recurrencePattern ? d.recurrencePattern : null,
          recurrence_open_day: d.isRecurring && d.recurrenceOpenDay ? parseInt(d.recurrenceOpenDay) : null,
          recurrence_close_day: d.isRecurring && d.recurrenceCloseDay ? parseInt(d.recurrenceCloseDay) : null,
          recurrence_end_date: d.isRecurring && d.recurrenceEndDate ? d.recurrenceEndDate : null,
        }
      : {}),
  };
}
