import { createClient } from "@/lib/supabase/server";
import { PartnerTierSelector } from "@/components/partners/PartnerTierSelector";
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

  const [{ data: { user } }, { data: activationTypes }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("activation_types")
      .select("id, title, description, image_url, sort_order, is_active")
      .order("sort_order"),
  ]);

  let partnerName: string | null = null;
  let isAdmin = false;
  // Has the partner already used (paid for) a pipeline round? Drives the
  // "first round free" copy — returning partners owe $200 instead.
  let pipelineFirstRoundUsed = false;

  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, username, role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("pipeline_entry_payments")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", user.id)
        .eq("status", "paid"),
    ]);
    partnerName = profile?.full_name ?? profile?.username ?? null;
    isAdmin = ["admin", "owner"].includes(profile?.role ?? "");
    pipelineFirstRoundUsed = (count ?? 0) > 0;
  }

  return (
    <div className="max-w-[1552px] mx-auto">

      {/* ── Full-width hero ──────────────────────────────────────────────── */}
      <div className="px-6 py-16 border-b border-black space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          For partners
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-2xl leading-tight">
          List opportunities for artists across Aotearoa and Australia.
        </h1>
        <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
          Or work with us on activations — hoardings, billboards, and surfaces that turn
          existing budgets into commissioned public art with full impact reporting.
        </p>
      </div>

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="px-6 py-16">
        <PartnerTierSelector
          isLoggedIn={!!user}
          partnerName={partnerName}
          activationTypes={(activationTypes ?? []) as ActivationType[]}
          isAdmin={isAdmin}
          pipelineFirstRoundUsed={pipelineFirstRoundUsed}
        />
      </div>

    </div>
  );
}
