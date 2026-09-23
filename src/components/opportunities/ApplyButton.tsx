"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OppTypeEnum, PipelineConfig, CustomField, Artwork } from "@/types/database";

export type AvailableWork = Pick<Artwork, "id" | "url" | "thumb_url" | "title" | "caption" | "price_cents" | "is_poa" | "price_currency" | "description" | "medium" | "dimensions">;

export interface OpportunityForApply {
  id: string;
  title: string;
  organiser: string;
  type: OppTypeEnum;
  routing_type: "external" | "pipeline";
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
  custom_fields: CustomField[];
  country?: string;
  city?: string | null;
  caption?: string | null;
  full_description?: string | null;
  funding_range?: string | null;
  funding_amount?: number | null;
  deadline?: string | null;
  opens_at?: string | null;
  entry_fee?: number | null;
  entry_fee_currency?: string | null;
  artist_payment_type?: string | null;
  travel_support?: boolean | null;
  travel_support_details?: string | null;
  sub_categories?: string[] | null;
  featured_image_url?: string | null;
}

interface Props {
  opportunityId: string;
  opportunitySlug?: string | null;
}

/**
 * The actual application lives at /opportunities/[id]/apply — a real page,
 * not a modal, since the form itself (profile completion, work picker,
 * questions, T&Cs) is too much content for a 90vh overlay to give proper
 * hierarchy to. This button is just the click-to-navigate trigger; UserCTA
 * (in the opportunity page) already did the eligibility/auth check server-
 * side before deciding to render it at all.
 */
export function ApplyButton({ opportunityId, opportunitySlug }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const href = `/opportunities/${opportunitySlug ?? opportunityId}/apply`;
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(href)}`);
      return;
    }
    router.push(href);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors disabled:opacity-50"
    >
      {loading ? "Loading…" : "Apply with Patronage →"}
    </button>
  );
}
