import { createClient } from "@/lib/supabase/server";
import { LandingHero } from "@/components/partners/LandingHero";
import { AudienceCards } from "@/components/partners/AudienceCards";
import { FeatureRows } from "@/components/partners/FeatureRows";
import { PricingTiers } from "@/components/partners/PricingTiers";
import { LandingTestimonial } from "@/components/partners/LandingTestimonial";
import { ActivationsColumn } from "@/components/partners/ActivationsColumn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners — Patronage",
  description:
    "List opportunities for artists across Aotearoa and Australia, or work with us on activations — hoardings, billboards, and surfaces that turn existing budgets into commissioned public art.",
};

export type ActivationType = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export default async function PartnersPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: activationTypes },
    { count: oppCount },
    { count: artistCount },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("activation_types")
      .select("id, title, description, image_url, sort_order, is_active")
      .order("sort_order"),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["artist", "owner"]),
  ]);

  let isAdmin = false;
  let pipelineFirstRoundUsed = false;

  if (user) {
    const [{ data: profile }, { count: paidCount }] = await Promise.all([
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("pipeline_entry_payments")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", user.id)
        .eq("status", "paid"),
    ]);
    isAdmin = ["admin", "owner"].includes(profile?.role ?? "");
    pipelineFirstRoundUsed = (paidCount ?? 0) > 0;
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <LandingHero
        opportunityCount={oppCount ?? 0}
        artistCount={artistCount ?? 0}
      />

      <AudienceCards />

      <FeatureRows />

      <PricingTiers
        pipelineFirstRoundUsed={pipelineFirstRoundUsed}
        isLoggedIn={!!user}
      />

      <LandingTestimonial />

      {/* Activations section — enquiry form with existing ActivationsColumn */}
      <div id="activations" className="border-b border-black">
        <div className="max-w-[1280px] mx-auto px-6 py-16 space-y-8">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Activations</p>
            <h2 className="text-2xl font-semibold tracking-tight">Commission artists for surfaces you own.</h2>
            <p className="text-sm text-stone-500 max-w-lg leading-relaxed pt-1">
              Partner with us to turn existing budgets — hoardings, vehicles, packaging,
              screens — into commissioned public art with full impact reporting.
            </p>
          </div>
          <ActivationsColumn
            activationTypes={(activationTypes ?? []) as ActivationType[]}
            isAdmin={isAdmin}
            hideHeader
          />
        </div>
      </div>
    </div>
  );
}
